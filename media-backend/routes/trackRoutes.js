const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Track = require("../models/Track");
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const ffmpeg = require('fluent-ffmpeg');
const requireAuth = require("../middleware/auth");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const User = require('../models/User');
const { ethers } = require("ethers");
const QRCode = require("qrcode");
const { deployMusicReuseContract } = require("../utils/blockchainReuse");


ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
const { Readable } = require("stream");


const router = express.Router();

// GridFS
let gfs;
const conn = mongoose.connection;
conn.once("open", () => {
    gfs = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: "uploads" });
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * POST /api/tracks/metadata
 */
const os = require("os");
const auth = require("../middleware/auth");

router.post("/metadata", upload.single("file"), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: "Nenhum ficheiro enviado" });
        }

        const tempPath = path.join(os.tmpdir(), req.file.originalname);
        fs.writeFileSync(tempPath, req.file.buffer);

        const hash =
            "0x" + crypto.createHash("sha256").update(req.file.buffer).digest("hex");

        ffmpeg.ffprobe(tempPath, (err, data) => {
            fs.unlinkSync(tempPath);
            if (err) {
                console.error("Erro no ffprobe:", err);
                return res.status(500).json({ error: "Erro ao extrair metadados" });
            }

            const format = req.file.mimetype;
            const size = req.file.size;
            const duration = Math.round(data.format.duration || 0);
            const genre = data.format.tags?.genre || "unknown";

            const metadata = {
                format,
                size,
                duration,
                genre,
                hash,
                sc4m: { version: "1.0", usage: "music-rights" },
                imaf: { version: "1.0", track: req.file.originalname },
            };

            res.json(metadata);
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao gerar metadados" });
    }
});


/**
 * POST /api/tracks/upload
 */
router.post(
    "/upload",
    requireAuth,
    upload.fields([{ name: "file", maxCount: 1 }, { name: "cover", maxCount: 1 }]),
    async (req, res) => {
        try {
            const { title, artist, visibility, metadata, contractAddress } = req.body;
            if (!req.files?.file) {
                return res.status(400).json({ error: "Ficheiro de áudio obrigatório" });
            }

            const audioFile = req.files.file[0];
            const coverFile = req.files.cover ? req.files.cover[0] : null;

            const fileId = new mongoose.Types.ObjectId();
            const coverId = coverFile ? new mongoose.Types.ObjectId() : null;

            const uploadStream = gfs.openUploadStreamWithId(fileId, audioFile.originalname, {
                contentType: audioFile.mimetype,
            });
            uploadStream.end(audioFile.buffer);

            if (coverFile) {
                const coverStream = gfs.openUploadStreamWithId(coverId, coverFile.originalname, {
                    contentType: coverFile.mimetype,
                });
                coverStream.end(coverFile.buffer);
            }

            uploadStream.on("finish", async () => {
                let parsedMetadata = {};
                try {
                    parsedMetadata = JSON.parse(metadata || "{}");
                } catch {
                    parsedMetadata = {};
                }

                if (req.body.genre) {
                    parsedMetadata.genre = req.body.genre;
                }

                try {
                    if (!parsedMetadata.basePrice) {
                        parsedMetadata.basePrice = "1000000000000000";
                    } else {
                        parsedMetadata.basePrice = BigInt(parsedMetadata.basePrice).toString();
                    }
                } catch {
                    parsedMetadata.basePrice = "1000000000000000";
                }

                if (!parsedMetadata.creator) {
                    parsedMetadata.creator = req.user.ethWallet || "0x0000000000000000000000000000000000000000";
                }

                let coholdersArray = [];
                if (req.body.coholders) {
                    try {
                        coholdersArray = JSON.parse(req.body.coholders);
                    } catch (err) {
                        console.warn("⚠️ Erro a parsear coholders:", err);
                    }
                }

                const trackData = {
                    title,
                    artist,
                    visibility,
                    fileId,
                    coverId,
                    metadata: parsedMetadata,
                    contractAddress,
                    user: req.user.id,
                };

                if (coholdersArray.length > 0) {
                    trackData.coholders = coholdersArray;
                }

                const track = new Track(trackData);
                await track.save();
                res.json({ success: true, track });
            });


            uploadStream.on("error", (err) => {
                console.error("Erro no upload:", err);
                res.status(500).json({ error: "Erro no upload do ficheiro" });
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Erro no upload" });
        }
    }
);

router.get("/mine", requireAuth, async (req, res) => {
    try {
        const tracks = await Track.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(tracks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao buscar músicas do utilizador" });
    }
});

router.put(
    "/:id",
    requireAuth,
    upload.fields([{ name: "file", maxCount: 1 }, { name: "cover", maxCount: 1 }]),
    async (req, res) => {
        try {
            const { title, artist, visibility } = req.body;
            const track = await Track.findOne({ _id: req.params.id, user: req.user.id });
            if (!track) return res.status(404).json({ error: "Música não encontrada" });

            if (title) track.title = title;
            if (artist) track.artist = artist;
            if (visibility) track.visibility = visibility;

            if (req.files?.file) {
                const audioFile = req.files.file[0];
                const newFileId = new mongoose.Types.ObjectId();

                const audioStream = gfs.openUploadStreamWithId(newFileId, audioFile.originalname, {
                    contentType: audioFile.mimetype,
                });
                audioStream.end(audioFile.buffer);

                if (track.fileId) {
                    try { await gfs.delete(new mongoose.Types.ObjectId(track.fileId)); } catch { }
                }

                track.fileId = newFileId;
            }

            if (req.files?.cover) {
                const coverFile = req.files.cover[0];
                const newCoverId = new mongoose.Types.ObjectId();

                const coverStream = gfs.openUploadStreamWithId(newCoverId, coverFile.originalname, {
                    contentType: coverFile.mimetype,
                });
                coverStream.end(coverFile.buffer);

                if (track.coverId) {
                    try { await gfs.delete(new mongoose.Types.ObjectId(track.coverId)); } catch { }
                }

                track.coverId = newCoverId;
            }

            await track.save();
            res.json({ success: true, track });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Erro ao editar música" });
        }
    }
);


router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const track = await Track.findOne({ _id: req.params.id, user: req.user.id });
        if (!track) return res.status(404).json({ error: "Música não encontrada" });

        if (track.fileId) {
            await gfs.delete(new mongoose.Types.ObjectId(track.fileId));
        }
        if (track.coverId) {
            await gfs.delete(new mongoose.Types.ObjectId(track.coverId));
        }

        await Track.deleteOne({ _id: track._id });
        res.json({ success: true, message: "Música apagada" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao apagar música" });
    }
});

router.get("/:id/cover", async (req, res) => {
    try {
        const track = await Track.findById(req.params.id);
        if (!track || !track.coverId) return res.status(404).send("Sem capa");

        const downloadStream = gfs.openDownloadStream(track.coverId);
        downloadStream.on("error", () => res.status(404).send("Erro a carregar capa"));
        downloadStream.pipe(res);
    } catch {
        res.status(500).send("Erro interno");
    }
});

router.get("/:id/contract-pdf", requireAuth, async (req, res) => {
    try {
        const track = await Track.findOne({ _id: req.params.id, user: req.user.id });
        if (!track) return res.status(404).json({ error: "Música não encontrada" });

        const md = track.metadata || {};
        const blue = "#00a2fd";
        const dark = "#091a2b";
        const white = "#ffffff"

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=soundslice-${track.title}.pdf`);

        const doc = new PDFDocument({
            size: [400, 700],
            margin: 0,
        });

        doc.pipe(res);

        // === Fundo azul ===
        doc.rect(0, 150, 400, 480).fill(blue);

        // === Topo escuro ===
        doc.rect(0, 0, 400, 150).fill(dark);

        // === Logo ===
        const logoPath = path.join(__dirname, "../images/icon.png");
        try {
            doc.image(logoPath, 160, 20, { width: 80 });
        } catch { }

        // === Nome SoundSlice ===
        doc.fillColor("white").fontSize(30).font("Helvetica-Bold").text("SoundSlice", 0, 100, {
            align: "center",
        });

        // === Subtítulo Smart Contract ===
        doc.roundedRect(120, 140, 160, 25, 6).fillColor(white).fill();
        doc.fillColor(dark).fontSize(12).text("Smart Contract", 0, 145, { align: "center" });

        // === Conteúdo principal ===
        doc.moveDown(5);
        doc.fillColor(dark).font("Helvetica-Bold").fontSize(16).text(track.title, {
            align: "center",
        });
        doc.moveDown(0.3);
        doc.font("Helvetica").fontSize(12).fillColor("white").text(`Artista: ${track.artist}`, {
            align: "center",
        });

        // === Dados da música ===
        doc.moveDown(1.5);
        doc.font("Helvetica-Bold").fontSize(13).fillColor("white").text("Dados da música", 40);
        doc.moveDown(0.5);
        doc.font("Helvetica").fontSize(11).list([
            `Título: ${track.title}`,
            `Artista: ${track.artist}`,
            `Género: ${md.genre || "N/A"}`,
            `Formato: ${md.format || "N/A"}`,
            `Duração: ${md.duration || 0} segundos`,
            `Titulares: ${md.holders ? md.holders.length : req.user.firstname}`,
        ]);

        // === Dados do contrato ===
        doc.moveDown(1);
        doc.font("Helvetica-Bold").fontSize(13).fillColor("white").text("Dados do Contrato", 40);
        doc.moveDown(0.5);
        const baseEth = md.basePrice
            ? `${ethers.formatEther(md.basePrice.toString())} ETH`
            : "N/A";
        doc.font("Helvetica").fontSize(11).list([
            `Endereço do Contrato: ${track.contractAddress || "N/A"}`,
            `Preço Base: ${baseEth}`,
            `Hash: ${md.hash || "N/A"}`,
            `Tamanho: ${md.size || "N/A"} bytes`,
            `Rede: Hardhat Local`,
        ]);

        // === Rodapé ===
        doc.rect(0, 640, 400, 60).fill(dark);
        doc.fillColor("white").fontSize(12).text("Processado por SoundSlice", 0, 665, {
            align: "center",
        });

        // === QR code (opcional) ===
        if (track.contractAddress) {
            const qr = await QRCode.toDataURL(track.contractAddress);
            const qrBuffer = Buffer.from(qr.split(",")[1], "base64");
            doc.image(qrBuffer, 160, 540, { width: 80 });
        }

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao gerar PDF estilizado" });
    }
});


// GET /api/tracks/:id/file 
router.get("/:id/file", requireAuth, async (req, res) => {
    try {
        const track = await Track.findById(req.params.id);
        if (!track || !track.fileId) return res.status(404).send("Ficheiro não encontrado");

        const fileId = new mongoose.Types.ObjectId(track.fileId);

        const files = await conn.db.collection("uploads.files").find({ _id: track.fileId }).toArray();
        if (!files || files.length === 0) return res.status(404).send("Ficheiro não encontrado");

        if (track.visibility !== "public") {
            if (!req.user) return res.status(401).send("Não autenticado");

            const isOwner = track.user.toString() === req.user.id;
            const isReuser = track.reusedFrom && track.user.toString() === req.user.id;

            if (!isOwner && !isReuser) {
                return res.status(403).send("Sem permissão");
            }
        }

        const file = files[0];
        const fileSize = file.length;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize || end >= fileSize) {
                res.status(416).send("Range not satisfiable");
                return;
            }

            const chunkSize = end - start + 1;
            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": file.contentType || "audio/mpeg"
            });

            gfs.openDownloadStream(track.fileId, { start, end }).pipe(res);
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": file.contentType || "audio/mpeg",
                "Accept-Ranges": "bytes"
            });
            gfs.openDownloadStream(track.fileId).pipe(res);
        }
    } catch (err) {
        console.error("Erro no streaming:", err);
        res.status(500).send("Erro no streaming do ficheiro");
    }
});

router.get("/:id/file/public", async (req, res) => {
    try {
        const track = await Track.findById(req.params.id);
        if (!track || !track.fileId) {
            return res.status(404).send("Ficheiro não encontrado");
        }

        if (track.visibility !== "public") {
            return res.status(403).send("Música não é pública");
        }

        const fileId = new mongoose.Types.ObjectId(track.fileId);
        const files = await conn.db.collection("uploads.files").find({ _id: track.fileId }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).send("Ficheiro não encontrado");
        }

        const file = files[0];
        const fileSize = file.length;
        const range = req.headers.range;

        const headersBase = {
            "Accept-Ranges": "bytes",
            "Content-Type": file.contentType || "audio/mpeg",
            "Content-Disposition": "inline"
        };

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize || end >= fileSize) {
                return res.status(416).send("Range not satisfiable");
            }

            const chunkSize = end - start + 1;
            res.writeHead(206, {
                ...headersBase,
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Content-Length": chunkSize
            });

            gfs.openDownloadStream(track.fileId, { start, end }).pipe(res);
        } else {
            res.writeHead(200, {
                ...headersBase,
                "Content-Length": fileSize
            });
            gfs.openDownloadStream(track.fileId).pipe(res);
        }
    } catch (err) {
        console.error("Erro no streaming público:", err);
        res.status(500).send("Erro no streaming do ficheiro");
    }
});


// GET /api/tracks/feed
router.get("/feed", async (req, res) => {
    try {
        const { q, genre, sort } = req.query;
        let filter = { visibility: "public" };

        if (req.user) {
            filter.user = { $ne: req.user.id };
        }

        if (q) {
            filter.$or = [
                { title: new RegExp(q, "i") },
                { artist: new RegExp(q, "i") }
            ];
        }

        if (genre) {
            filter["metadata.genre"] = genre;
        }

        let query = Track.find(filter);

        if (sort === "title") query.sort({ title: 1 });
        else if (sort === "popular") query.sort({ totalReuses: -1 });
        else query.sort({ createdAt: -1 });

        const tracks = await query.exec();

        res.json(tracks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao carregar feed" });
    }
});


// POST /api/tracks/:id/reuse/analyze
router.post("/:id/reuse/analyze", requireAuth, upload.single("file"), async (req, res) => {
    try {
        const track = await Track.findById(req.params.id);
        if (!track) return res.status(404).json({ error: "Música original não encontrada" });

        if (!req.file) return res.status(400).json({ error: "Ficheiro não enviado" });

        const newHash = "0x" + crypto.createHash("sha256").update(req.file.buffer).digest("hex");

        const percent = Math.floor(Math.random() * 60) + 20;

        const basePrice = track.metadata?.basePrice || 1000000000000000;
        const value = BigInt(basePrice) * BigInt(percent) / BigInt(100);

        res.json({
            originalId: track._id,
            percent,
            value: value.toString(),
            contractAddress: track.contractAddress
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao analisar reutilização" });
    }
});

// POST /api/tracks/:id/reuse/confirm
router.post("/:id/reuse/confirm", requireAuth, async (req, res) => {
    try {
        const { start, end, percent, snippetId, snippetName, snippetHash, paymentTxHash } = req.body;
        console.log("🧠 req.user recebido:", req.user);
        const track = await Track.findById(req.params.id).populate("user");
        if (!track) return res.status(404).json({ error: "Música original não encontrada" });

        const basePrice = BigInt(track.metadata?.basePrice || 1000000000000000n);
        const value = (basePrice * BigInt(percent)) / 100n;

        const snippetObjectId = new mongoose.Types.ObjectId(snippetId);
        currentUser = req.user;
        const fullName = [currentUser.firstname, currentUser.lastname].filter(Boolean).join(" ");
        const reusedTrack = new Track({
            title: track.title + " (Reuso)",
            artist: track.artist || "Desconhecido",
            visibility: "private",
            reusedFrom: track._id,
            reusePercentage: percent,
            fileId: snippetObjectId,
            coverId: track.coverId || null,
            user: req.user.id,
            type: "reuse",
            metadata: {
                format: "audio/mpeg",
                duration: end - start,
                basePrice: value.toString(),
                originalBasePrice: track.metadata?.basePrice?.toString() || "0",
                percent,
                sc4m: {
                    schema: "https://schema.soundslice.dev/sc4m.json",
                    version: "1.0",
                    usage: "music-reuse",
                    originalId: track._id.toString(),
                    creatorWallet: track.user?.ethWallet || "0x0000000000000000000000000000000000000000",
                    value: value.toString(),
                    paymentTxHash: paymentTxHash || null,
                },
                imaf: {
                    schema: "https://schema.soundslice.dev/imaf.json",
                    version: "1.0",
                    reuseOf: track._id.toString(),
                    track: snippetName || `snippet-${snippetId}.mp3`,
                    snippetId: snippetObjectId.toString(),
                    start,
                    end,
                    percent,
                    snippetHash,
                },
            },
        });

        await reusedTrack.save();
        const snippetDurationSec = Math.round(end - start);
        if (process.env.SERVER_PRIVATE_KEY) {
            console.log("A fazer deploy do contrato MusicReuse...");
            const deployResult = await deployMusicReuseContract({
                reuseId: reusedTrack._id.toString(),
                originalId: track._id.toString(),
                originalTitle: track.title,
                originalCreator: track.user?.firstname.lastname || "Desconhecido",
                creatorWallet: track.user?.ethWallet || "0x0000000000000000000000000000000000000000",
                reuserName: fullName || "Desconhecido",
                reuserWallet: req.user.ethWallet || "0x0000000000000000000000000000000000000000",
                reusePercent: percent,
                valueEth: ethers.formatEther(value.toString()),
                originalFileHash: track.metadata?.hash || "0x00",
                snippetHash: snippetHash || "0x00",
                format: "mp3",
                genre: track.metadata?.genre || "unknown",
                snippetDuration: snippetDurationSec,
            });

            if (deployResult.success) {
                console.log(`Contrato MusicReuse criado: ${deployResult.address}`);

                if (!reusedTrack.metadata.sc4m) reusedTrack.metadata.sc4m = {};

                reusedTrack.metadata.sc4m.contractAddress = deployResult.address;
                reusedTrack.metadata.sc4m.txHash = deployResult.txHash;
                reusedTrack.metadata.sc4m.chainId = deployResult.chainId;

                await reusedTrack.markModified("metadata.sc4m");
                await reusedTrack.save();

                console.log("Dados do contrato guardados no MongoDB!");
            } else {
                console.error("Erro ao deployar contrato MusicReuse:", deployResult.error);
            }
        }

        track.totalReuses = (track.totalReuses || 0) + 1;
        await track.save();

        res.json(JSON.parse(JSON.stringify({
            success: true,
            reusedTrack
        }, (_, value) => (typeof value === "bigint" ? value.toString() : value))));

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao confirmar reutilização" });
    }
});

// POST /api/tracks/:id/reuse/select
router.post("/:id/reuse/select", requireAuth, async (req, res) => {
    try {
        const { start, end } = req.body;
        const track = await Track.findById(req.params.id).populate("user");

        if (!track || !track.fileId) {
            return res.status(404).json({ error: "Música não encontrada" });
        }

        const duration = track.metadata?.duration || 1;
        const length = end - start;
        const percent = Math.min(100, Math.max(1, Math.round((length / duration) * 100)));

        const basePrice = BigInt(track.metadata?.basePrice || 1000000000000000n);
        const value = (basePrice * BigInt(percent)) / 100n;

        const payTo = track.user?.ethWallet || "0x0000000000000000000000000000000000000000";

        const tempInput = path.join(os.tmpdir(), `${track._id}-${Date.now()}.mp3`);
        const snippetPath = path.join(os.tmpdir(), `snippet-${Date.now()}.mp3`);

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
        const downloadStream = bucket.openDownloadStream(track.fileId);
        const writeStream = fs.createWriteStream(tempInput);

        await new Promise((resolve, reject) => {
            downloadStream.pipe(writeStream);
            downloadStream.on("error", reject);
            writeStream.on("finish", resolve);
        });

        ffmpeg(tempInput)
            .setStartTime(start)
            .setDuration(length)
            .audioCodec("libmp3lame")
            .on("end", async () => {
                try {
                    const snippetId = new mongoose.Types.ObjectId();
                    const uploadStream = bucket.openUploadStreamWithId(snippetId, `snippet-${Date.now()}.mp3`, {
                        contentType: "audio/mpeg",
                    });

                    const readStream = fs.createReadStream(snippetPath);
                    readStream.pipe(uploadStream);

                    uploadStream.on("finish", () => {
                        const buffer = fs.readFileSync(snippetPath);
                        const hash = "0x" + crypto.createHash("sha256").update(buffer).digest("hex");

                        res.json({
                            originalId: track._id,
                            start,
                            end,
                            percent,
                            snippetId: uploadStream.id.toString(),
                            snippetName: uploadStream.filename,
                            value: value.toString(),
                            payTo,
                            hash,
                        });

                        fs.unlinkSync(tempInput);
                        fs.unlinkSync(snippetPath);
                    });
                } catch (err) {
                    console.error("Erro ao guardar snippet:", err);
                    res.status(500).json({ error: "Erro ao guardar snippet" });
                }
            })
            .on("error", (err) => {
                console.error("Erro FFmpeg:", err);
                res.status(500).json({ error: "Erro ao gerar snippet" });
            })
            .save(snippetPath);
    } catch (err) {
        console.error("Erro geral:", err);
        res.status(500).json({ error: "Erro na seleção de trecho" });
    }
});

// GET /api/tracks/:id/reuse/contract-pdf
router.get("/:id/reuse/contract-pdf", requireAuth, async (req, res) => {
    try {
        const track = await Track.findById(req.params.id)
            .populate("user", "firstname lastname ethWallet")
            .populate({
                path: "reusedFrom",
                populate: { path: "user", select: "firstname lastname ethWallet" },
            });

        if (!track) return res.status(404).json({ error: "Música não encontrada" });

        const reuseAddress =
            track.metadata?.sc4m?.contractAddress || track.reuseContract?.address;
        if (!reuseAddress)
            return res.status(400).json({ error: "Contrato de reuso não encontrado" });

        const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC);
        const abi = [
            "function reuseId() view returns (string)",
            "function originalTitle() view returns (string)",
            "function reuserName() view returns (string)",
            "function reusePercent() view returns (uint256)",
            "function valuePaid() view returns (uint256)",
            "function format() view returns (string)",
            "function genre() view returns (string)",
            "function snippetDuration() view returns (uint256)",
            "function timestamp() view returns (uint256)"
        ];
        const contract = new ethers.Contract(reuseAddress, abi, provider);

        const [
            reuseId,
            originalTitle,
            reuserName,
            reusePercent,
            valuePaid,
            format,
            genre,
            snippetDuration,
            timestamp
        ] = await Promise.all([
            contract.reuseId(),
            contract.originalTitle(),
            contract.reuserName(),
            contract.reusePercent(),
            contract.valuePaid(),
            contract.format(),
            contract.genre(),
            contract.snippetDuration(),
            contract.timestamp()
        ]);

        const originalArtist = track.reusedFrom?.artist || "Desconhecido";
        const originalCreator = track.reusedFrom?.user
            ? `${track.reusedFrom.user.firstname || ""} ${track.reusedFrom.user.lastname || ""}`.trim()
            : "Desconhecido";

        const reuserFullName = `${track.user.firstname || ""} ${track.user.lastname || ""}`.trim();

        const PDFDocument = require("pdfkit");
        const doc = new PDFDocument({ size: [400, 700], margin: 0 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=reuse-${track.title}.pdf`);
        doc.pipe(res);

        const blue = "#00a2fd";
        const dark = "#091a2b";
        const white = "#ffffff";

        // Cabeçalho
        doc.rect(0, 0, 400, 160).fill(dark);
        const logoPath = path.join(__dirname, "../images/icon.png");
        try { doc.image(logoPath, 150, 25, { width: 100 }); } catch { }
        doc.fillColor(white).font("Helvetica-Bold").fontSize(30).text("SoundSlice", 0, 110, { align: "center" });

        doc.rect(0, 160, 400, 30).fill(white);
        doc.fillColor(dark).font("Helvetica-Bold").fontSize(12).text("Smart Contract — Reutilização Musical", 0, 170, { align: "center" });

        doc.rect(0, 190, 400, 450).fill(blue);
        doc.fillColor(white).font("Helvetica-Bold").fontSize(18).text(originalTitle || track.title, 0, 220, { align: "center" });

        // === Dados da Música ===
        doc.moveDown(2).font("Helvetica-Bold").fontSize(14).fillColor(white).text("🎵 Dados da Música", 40);
        doc.moveDown(0.5);
        doc.font("Helvetica").fontSize(11).list([
            `Título Original: ${originalTitle || "N/A"}`,
            `Artista Original: ${originalArtist}`,
            `Criador Original: ${originalCreator}`,
            `Reutilizador: ${reuserFullName}`,
            `Género: ${track.metadata?.genre || "N/A"}`,
            `Formato: ${format || "N/A"}`,
            `Duração do Excerto: ${snippetDuration} segundos`,
            `Percentagem Reutilizada: ${reusePercent}%`,
            `Valor Pago: ${ethers.formatEther(valuePaid)} ETH`,
        ]);

        // === Dados do Contrato ===
        doc.moveDown(1);
        doc.font("Helvetica-Bold").fontSize(14).fillColor(white).text("📜 Dados do Contrato", 40);
        doc.moveDown(0.5);
        doc.font("Helvetica").fontSize(11).list([
            `Endereço do Contrato: ${reuseAddress}`,
            `Wallet do Criador: ${track.reusedFrom?.user?.ethWallet || "N/A"}`,
            `Wallet do Reutilizador: ${track.user?.ethWallet || "N/A"}`,
            `Data de Criação: ${new Date(Number(timestamp) * 1000).toLocaleString()}`,
            `Rede: Hardhat Local`,
        ]);

        // === QR code ===
        const QRCode = require("qrcode");
        const qrData = await QRCode.toDataURL(reuseAddress);
        const qrBuffer = Buffer.from(qrData.split(",")[1], "base64");
        doc.image(qrBuffer, 160, 560, { width: 80 });

        // Rodapé
        doc.rect(0, 640, 400, 60).fill(dark);
        doc.fillColor("white").fontSize(12).text("Processado por SoundSlice", 0, 665, { align: "center" });
        doc.end();
    } catch (err) {
        console.error("Erro ao gerar PDF de reuso:", err);
        res.status(500).json({ error: "Erro ao gerar contrato PDF" });
    }
});



// GET /api/tracks/snippet/:id
router.get("/snippet/:id", async (req, res) => {
    try {
        const snippetId = new mongoose.Types.ObjectId(req.params.id);
        const downloadStream = gfs.openDownloadStream(snippetId);

        res.set("Content-Type", "audio/mpeg");
        downloadStream.on("error", () => res.status(404).send("Excerto não encontrado"));
        downloadStream.pipe(res);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao carregar excerto");
    }
});



router.get("/:id", async (req, res) => {
    try {
        const track = await Track.findById(req.params.id)
            .populate("user", "firstname lastname email");

        if (!track) {
            return res.status(404).json({ error: "Música não encontrada" });
        }

        const totalReuses = await Track.countDocuments({ reusedFrom: track._id });

        res.json({
            ...track.toObject(),
            ownerName: track.user
                ? `${track.user.firstname} ${track.user.lastname || ""}`.trim()
                : "Desconhecido",
            stats: { totalReuses }
        });
    } catch (err) {
        console.error("Erro ao buscar detalhes da música:", err);
        res.status(500).json({ error: "Erro ao carregar música" });
    }
});

module.exports = router;
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const crypto = require("crypto");
const requireAuth = require("../middleware/auth");
const { GridFSBucket } = require("mongodb");
const { deployMusicMixContract } = require("../utils/blockchainMix");
const path = require("path");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { ethers } = require("ethers");
const Track = require("../models/track.js");
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post("/export", requireAuth, upload.single("file"), async (req, res) => {
    try {
        let snippets = [];
        if (req.body.snippets) {
            try {
                snippets = JSON.parse(req.body.snippets);
            } catch (e) {
                console.warn("Snippets inválidos recebidos:", req.body.snippets);
                snippets = [];
            }
        }

        const title = req.body.title || "Mix sem nome";
        if (!req.file) return res.status(400).send("Falta o ficheiro mix");

        const currentUser = req.user;
        const fullName = [currentUser.firstname, currentUser.lastname].filter(Boolean).join(" ");
        const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
        const uploadStream = bucket.openUploadStream(req.file.originalname, {
            contentType: req.file.mimetype,
            metadata: { type: "mix" },
        });

        uploadStream.end(req.file.buffer);

        uploadStream.on("finish", async () => {
            try {
                console.log("Upload concluído, ID do ficheiro:", uploadStream.id);
                let totalValueEth = 0;
                const reusedSnippets = [];

                for (const s of snippets) {
                    let valueEth = 0;
                    try {
                        const reusedTrack = await Track.findById(s.id);
                        if (reusedTrack?.metadata?.basePrice) {
                            const wei = BigInt(reusedTrack.metadata.basePrice);
                            valueEth = parseFloat(ethers.formatEther(wei));
                        }
                    } catch (e) {
                        console.warn("Erro ao buscar preço base para track", s.id);
                    }

                    totalValueEth += valueEth;
                    reusedSnippets.push({
                        trackId: s.id,
                        title: s.title,
                        artist: s.artist,
                        creatorName: s.creatorName || s.artist || fullName,
                        creatorWallet: s.creatorWallet || "0x0000000000000000000000000000000000000000",
                        start: s.start,
                        end: s.end,
                        percent: s.percent || 0,
                        snippetId: s.snippetId,
                        valueEth: valueEth.toFixed(6),
                        totalValueWei: ethers.parseEther(totalValueEth.toFixed(6)).toString(),
                    });
                }
                const metadata = {
                    format: req.file.mimetype,
                    size: req.file.size,
                    duration: snippets.reduce((acc, s) => acc + (s.end - s.start), 0),
                    hash: "0x" + crypto.createHash("sha256").update(req.file.buffer).digest("hex"),
                    basePrice: "0",
                    totalValueEth: totalValueEth.toFixed(6),
                    sc4m: {
                        version: "1.0",
                        usage: "music-mix",
                        reusedSnippets
                    },
                    imaf: {
                        version: "1.0",
                        mix: {
                            tracks: snippets.map(s => ({
                                id: s.id,
                                title: s.title,
                                start: s.start,
                                end: s.end,
                                url: s.url,
                            })),
                        },
                    },
                    creator: currentUser.ethWallet || currentUser._id.toString(),
                };

                const track = await Track.create({
                    title,
                    artist: fullName || "Desconhecido",
                    visibility: "private",
                    fileId: uploadStream.id,
                    metadata,
                    user: currentUser._id,
                    totalReuses: 0,
                    type: "mix",
                });

                console.log("Track criada com sucesso:", track._id);

                if (process.env.SERVER_PRIVATE_KEY) {
                    console.log("A fazer deploy do contrato MusicMix...");

                    const deployResult = await deployMusicMixContract({
                        mixId: track._id.toString(),
                        mixTitle: track.title,
                        mixCreator: currentUser.firstname + " " + (currentUser.lastname || ""),
                        mixWallet: currentUser.ethWallet || "0x0000000000000000000000000000000000000000",
                        format: metadata.format,
                        genre: metadata.genre || "unknown",
                        sources: metadata.sc4m.reusedSnippets.map(s => ({
                            originalId: s.id,
                            title: s.title,
                            creatorName: s.artist,
                            creatorWallet: s.creatorWallet || "0x0000000000000000000000000000000000000000",
                            reusePercent: s.percent || 0,
                            valueShare: s.valueEth || 0
                        }))
                    });

                    if (deployResult.success) {
                        console.log(`Contrato MusicMix criado: ${deployResult.address}`);
                        track.metadata.sc4m.contractAddress = deployResult.address;
                        track.metadata.sc4m.txHash = deployResult.txHash;

                        track.markModified("metadata.sc4m");

                        await track.save();
                        console.log("Track atualizada com contractAddress:", deployResult.address);
                    } else {
                        console.error("Erro ao criar contrato MusicMix:", deployResult.error);
                    }
                }

                res.json({ success: true, trackId: track._id });
            } catch (err) {
                console.error("Erro ao criar Track:", err);
                res.status(500).send("Erro ao criar track do mix");
            }
        });

        uploadStream.on("error", (err) => {
            console.error("Erro upload GridFS:", err);
            res.status(500).send("Erro ao guardar ficheiro mix");
        });
    } catch (err) {
        console.error("Erro export mix:", err);
        res.status(500).send("Erro ao exportar mix");
    }
});

router.get("/:id/contract-pdf", requireAuth, async (req, res) => {
    try {
        const track = await Track.findById(req.params.id);
        if (!track || track.type !== "mix") {
            return res.status(404).json({ error: "Mix não encontrado" });
        }

        const title = track.title || "Mix sem nome";
        const creator = `${track.artist || "Desconhecido"}`;
        const duration = track.metadata?.duration?.toFixed(2) || "N/A";
        const contractAddress = track.metadata?.sc4m?.contractAddress || "N/A";
        const txHash = track.metadata?.sc4m?.txHash || "N/A";
        const chainId = track.metadata?.sc4m?.chainId || "31337 (Hardhat)";
        const reused = track.metadata?.sc4m?.reusedSnippets || [];
        const createdAt = track.createdAt
            ? new Date(track.createdAt).toLocaleString("pt-PT")
            : "N/A";

        const totalValueEth = track.metadata?.totalValueEth
            ? `${track.metadata.totalValueEth} ETH`
            : "—";

        const doc = new PDFDocument({ size: [420, 740], margin: 0 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=mix-${title.replace(/\s+/g, "_")}.pdf`
        );
        doc.pipe(res);

        const blue = "#00a2fd";
        const dark = "#091a2b";
        const white = "#ffffff";

        // Cabeçalho
        doc.rect(0, 0, 420, 160).fill(dark);
        const logoPath = path.join(__dirname, "../images/icon.png");
        try {
            doc.image(logoPath, 160, 25, { width: 100 });
        } catch { }
        doc
            .fillColor(white)
            .font("Helvetica-Bold")
            .fontSize(30)
            .text("SoundSlice", 0, 110, { align: "center" });

        // Subtítulo
        doc.rect(0, 160, 420, 30).fill(white);
        doc
            .fillColor(dark)
            .font("Helvetica-Bold")
            .fontSize(12)
            .text("Smart Contract — Mix Musical", 0, 170, { align: "center" });

        // Corpo azul
        doc.rect(0, 190, 420, 490).fill(blue);
        doc
            .fillColor(white)
            .font("Helvetica-Bold")
            .fontSize(18)
            .text(title, 0, 210, { align: "center" });

        // === Dados do Mix ===
        doc.moveDown(2);
        doc.font("Helvetica-Bold").fontSize(14).fillColor(white).text("Dados do Mix", 40);
        doc.moveDown(0.5);
        doc.font("Helvetica").fontSize(11).list([
            `Título do Mix: ${title}`,
            `Criador: ${creator}`,
            `Data de criação: ${createdAt}`,
            `Duração total: ${duration} segundos`,
            `Valor total de licenças: ${totalValueEth}`,
            `Número do contrato: ${contractAddress}`,
            `Tx Hash: ${txHash}`,
            `Rede: ${chainId}`,
        ]);

        // === Snippets reutilizados ===
        doc.moveDown(1);
        doc.font("Helvetica-Bold").fontSize(14).fillColor(white).text("Snippets Reutilizados", 40);
        doc.moveDown(0.5);

        reused.forEach((s, i) => {
            doc
                .font("Helvetica-Bold")
                .fontSize(11)
                .fillColor(white)
                .text(`${i + 1}. ${s.title} (${s.percent || "N/A"}%)`, { indent: 20 });

            doc
                .font("Helvetica")
                .fontSize(10)
                .text(`Criador: ${s.artist || s.creatorName || "Desconhecido"}`, { indent: 30 })
                .text(`Intervalo: ${s.start || 0}s -> ${s.end || 0}s`, { indent: 30 })
                .moveDown(0.6);
        });

        // === QR Code ===
        const qrData = await QRCode.toDataURL(contractAddress);
        const qrBuffer = Buffer.from(qrData.split(",")[1], "base64");
        doc.moveDown(1.5);
        doc.image(qrBuffer, 165, doc.y, { width: 90 });
        doc.moveDown(0.5);


        // Rodapé
        doc.rect(0, 690, 420, 50).fill(dark);
        doc
            .fillColor("white")
            .fontSize(11)
            .text("Processado automaticamente por SoundSlice", 0, 710, { align: "center" });

        doc.end();
    } catch (err) {
        console.error("Erro ao gerar contrato PDF do mix:", err);
        res.status(500).json({ error: "Falha ao gerar PDF" });
    }
});

module.exports = router;

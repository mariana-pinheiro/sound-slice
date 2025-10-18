// controllers/mixController.js
import Track from "../models/Track";
import { conn } from "../config/db.js";
import { uploadToGridFS } from "../utils/gridfs.js";
import { ethers } from "ethers";
import fs from "fs";
import { measureTransaction } from "../utils/measureTransaction.js";


import MusicMixArtifact from "../blockchain/artifacts/contracts/MusicMix.sol/MusicMix.json" assert { type: "json" };

export const exportMix = async (req, res) => {
  try {
    const { title, snippets } = req.body;
    const userId = req.user.id;

    const file = req.file;
    const fileId = await uploadToGridFS(file);

    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const factory = new ethers.ContractFactory(
      MusicMixArtifact.abi,
      MusicMixArtifact.bytecode,
      wallet
    );

    const contract = await measureTransaction(
      factory.deploy(title, userId),
      "deployMusicMix"
    );

    const contractAddress = contract.target;
    console.log("MusicMix deployado com sucesso:", contractAddress);

    const newTrack = new Track({
      title,
      user: userId,
      type: "mix",
      snippets: JSON.parse(snippets),
      fileId,
      contractAddress,
    });
    await newTrack.save();

    return res.json({ trackId: newTrack._id, contractAddress });
  } catch (err) {
    console.error("Erro ao exportar mix:", err);
    res.status(500).json({ error: err.message });
  }
};

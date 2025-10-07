// scripts/redeployContracts.js
import mongoose from "mongoose";
import { ethers } from "ethers";
import Track from "../models/Track";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve("./.env") });


const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");


const deployer = await provider.getSigner(0);

import fs from "fs";
const artifactPath = path.resolve(
  "../smart-contracts/artifacts/contracts/MusicRights.sol/MusicRights.json"
);
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const { abi, bytecode } = artifact;

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Ligado ao MongoDB");

  const tracks = await Track.find({ type: "original" });
  console.log(`Encontradas ${tracks.length} músicas originais.`);

  for (const track of tracks) {
    try {
      console.log(`A fazer deploy de: ${track.title}`);

      const title = track.title || "Sem título";
      const artist = track.artist || "Desconhecido";
      const fileHash = track.metadata?.hash
        ? (track.metadata.hash.startsWith("0x")
          ? track.metadata.hash.slice(0, 66)
          : "0x" + track.metadata.hash.slice(0, 64))
        : ethers.ZeroHash;


      const basePrice = track.metadata?.basePrice
        ? ethers.parseEther(track.metadata.basePrice.toString())
        : 0;

      const format = track.metadata?.format || "mp3";
      const genre = track.metadata?.genre || "N/A";
      const duration = track.metadata?.duration || 0;
      const extra = JSON.stringify(track.metadata || {});
      const holders = [track.metadata?.sc4m?.creator || (await deployer.getAddress())];
      const shares = [100];

      const factory = new ethers.ContractFactory(abi, bytecode, deployer);
      const contract = await factory.deploy(
        title,
        artist,
        fileHash,
        basePrice,
        format,
        genre,
        duration,
        extra,
        holders,
        shares
      );

      await contract.waitForDeployment();
      const address = await contract.getAddress();

      track.contractAddress = address;
      await track.save();

      console.log(`Novo contrato: ${address}`);
    } catch (err) {
      console.error(`Erro a redeployar ${track.title}:`, err.message);
    }
  }

  console.log("Redeploy concluído com sucesso!");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Erro geral:", err);
  process.exit(1);
});

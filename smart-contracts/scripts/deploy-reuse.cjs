// scripts/deploy-reuse.cjs
import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("A fazer deploy com a conta:", deployer.address);

  const dataPath = new URL("./reuseData.json", import.meta.url).pathname;
  const rawData = fs.readFileSync(dataPath, "utf8");
  const json = JSON.parse(rawData);

  const MusicReuse = await ethers.getContractFactory("MusicReuse");

  const deployData = {
    reuseId: json.reuseId,
    originalId: json.originalId,
    originalTitle: json.originalTitle,
    originalCreator: json.originalCreator,
    creatorWallet: json.creatorWallet,
    reuserName: json.reuserName,
    reuserWallet: json.reuserWallet,
    reusePercent: json.reusePercent,
    valuePaid: ethers.parseEther(json.valuePaidETH),
    originalFileHash: ethers.keccak256(ethers.toUtf8Bytes(json.originalFileHash)),
    snippetHash: ethers.keccak256(ethers.toUtf8Bytes(json.snippetHash)),
    format: json.format,
    genre: json.genre,
    snippetDuration: json.snippetDuration
  };

  console.log("Deploying contract with data:", deployData);

  const musicReuse = await MusicReuse.deploy(deployData);
  await musicReuse.waitForDeployment();

  console.log("Deploy concluído em:", await musicReuse.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

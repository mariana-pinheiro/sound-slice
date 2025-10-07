// scripts/deploy.cjs
const hre = require("hardhat");

async function main() {
  const [deployer, addr1] = await hre.ethers.getSigners();

  console.log("A fazer deploy com a conta:", deployer.address);

  const MusicRights = await hre.ethers.getContractFactory("MusicRights");

  const title = "Minha Musica";
  const artist = "Artista X";
  const fileHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ficheiro.mp3"));
  const basePrice = hre.ethers.parseEther("1");
  const format = "mp3";
  const genre = "Rock";
  const duration = 180;
  const extra = "extra metadata JSON";
  const holders = [deployer.address, addr1.address];
  const shares = [70, 30];

  const musicRights = await MusicRights.deploy(
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

  await musicRights.waitForDeployment();
  console.log("Deploy concluído:", await musicRights.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

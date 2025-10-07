// scripts/read-contracts.cjs
const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  const contractAddress = "0x9E545E3C0baAB3E08CdfD552C960A1050f373042";

  const abi = [
    "function owner() view returns (address)",
    "function title() view returns (string)",
    "function artist() view returns (string)",
    "function fileHash() view returns (bytes32)",
    "function basePrice() view returns (uint256)",
    "function format() view returns (string)",
    "function genre() view returns (string)",
    "function duration() view returns (uint256)",
    "function extra() view returns (string)",
    "function getHolders() view returns (address[], uint256[])",
    "function totalReuses() view returns (uint256)"
  ];

  const contract = new ethers.Contract(contractAddress, abi, provider);

  console.log("Informações do contrato:");

  console.log("Owner:", await contract.owner());
  console.log("Título:", await contract.title());
  console.log("Artista:", await contract.artist());
  console.log("Hash:", await contract.fileHash());
  console.log("Preço base (wei):", (await contract.basePrice()).toString());
  console.log("Formato:", await contract.format());
  console.log("Género:", await contract.genre());
  console.log("Duração (s):", (await contract.duration()).toString());
  console.log("Extra metadata:", await contract.extra());

  const [holders, shares] = await contract.getHolders();
  console.log("👥 Titulares:");
  holders.forEach((h, i) => {
    console.log(`   - ${h} (${shares[i]}%)`);
  });

  console.log("Total de reutilizações:", (await contract.totalReuses()).toString());
}

main().catch((err) => {
  console.error("Erro ao ler contrato:", err);
  process.exit(1);
});

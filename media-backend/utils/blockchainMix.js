const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function deployMusicMixContract(params) {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC);
    const wallet = new ethers.Wallet(process.env.SERVER_PRIVATE_KEY, provider);

    const artifactPath = path.join(
      __dirname,
      "..",
      "..",
      "smart-contracts",
      "artifacts",
      "contracts",
      "MusicMix.sol",
      "MusicMix.json"
    );

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    const sources = (params.sources || []).map((s) => ({
      originalId: s.originalId || "unknown",
      title: s.title || "untitled",
      creatorName: s.creatorName || "Desconhecido",
      creatorWallet: s.creatorWallet || "0x0000000000000000000000000000000000000000",
      reusePercent: BigInt(s.reusePercent || 0),
      valueShare: ethers.parseEther(String(s.valueShare || "0")),
    }));

    console.log("A fazer deploy do contrato MusicMix...");

    const contract = await factory.deploy(
      params.mixId,
      params.mixTitle,
      params.mixCreator,
      params.mixWallet,
      params.format || "mp3",
      params.genre || "unknown",
      sources
    );

    await contract.waitForDeployment();
    const address = await contract.getAddress();
    const txHash = contract.deploymentTransaction().hash;

    console.log(`MusicMix deployado com sucesso: ${address}`);

    return {
      success: true,
      address,
      txHash,
      chainId: (await provider.getNetwork()).chainId,
    };
  } catch (err) {
    console.error("Erro no deployMusicMixContract:", err);
    return { success: false, error: err.message };
  }
}

module.exports = { deployMusicMixContract };

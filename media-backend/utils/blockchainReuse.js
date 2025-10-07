// utils/blockchainReuse.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function deployMusicReuseContract(params) {
  try {
    console.log("A fazer deploy do contrato MusicReuse...");

    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC);
    const wallet = new ethers.Wallet(process.env.SERVER_PRIVATE_KEY, provider);

    const artifactPath = path.join(
      __dirname,
      "..",
      "..",
      "smart-contracts",
      "artifacts",
      "contracts",
      "MusicReuse.sol",
      "MusicReuse.json"
    );

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    function ensureBytes32(value, fallbackLabel) {
      if (typeof value !== "string" || !value.startsWith("0x") || value.length !== 66) {
        console.warn(`Hash inválido (${fallbackLabel}), a gerar um novo hash...`);
        return ethers.keccak256(ethers.toUtf8Bytes(fallbackLabel || "fallback"));
      }
      return value;
    }

    const safeOriginalHash = ensureBytes32(params.originalFileHash, "original");
    const safeSnippetHash = ensureBytes32(params.snippetHash, "snippet");

    const valuePaid =
      typeof params.valueEth === "string" || typeof params.valueEth === "number"
        ? ethers.parseEther(params.valueEth.toString())
        : ethers.parseEther("0.001");

    const contract = await factory.deploy({
      reuseId: params.reuseId || "unknown",
      originalId: params.originalId || "unknown",
      originalTitle: params.originalTitle || "Untitled",
      originalCreator: params.originalCreator || "Desconhecido",
      creatorWallet: params.creatorWallet || ethers.ZeroAddress,
      reuserName: params.reuserName || "Desconhecido",
      reuserWallet: params.reuserWallet || ethers.ZeroAddress,
      reusePercent: BigInt(params.reusePercent || 0),
      valuePaid,
      originalFileHash: safeOriginalHash,
      snippetHash: safeSnippetHash,
      format: params.format || "mp3",
      genre: params.genre || "unknown",
      snippetDuration: BigInt(params.snippetDuration || 0),
    });

    await contract.waitForDeployment();

    const address = await contract.getAddress();
    const txHash = contract.deploymentTransaction().hash;

    console.log(`MusicReuse deployado com sucesso: ${address}`);

    return {
      success: true,
      address,
      txHash,
      chainId: (await provider.getNetwork()).chainId,
    };
  } catch (err) {
    console.error("Erro no deployMusicReuseContract:", err);
    return { success: false, error: err.message };
  }
}

module.exports = { deployMusicReuseContract };

// services/onchain.js
const { ethers } = require("ethers");

const REGISTRY_ABI = [
  "function registerReuse(bytes32,address,uint256,uint256,bytes32,string,bytes32) external returns (uint256)",
];

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer   = new ethers.Wallet(process.env.SERVER_PRIVATE_KEY, provider);
const registry = new ethers.Contract(process.env.REGISTRY_ADDRESS, REGISTRY_ABI, signer);

async function registerReuseOnChain({ originalId, buyer, percent, valueWei, snippetHash, snippetId, paymentTxHash }) {
  const tx = await registry.registerReuse(
    ethers.id(originalId),             
    buyer,
    BigInt(percent),
    BigInt(valueWei),
    snippetHash,                     
    snippetId,                         
    paymentTxHash                     
  );
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, chainId: (await provider.getNetwork()).chainId };
}

module.exports = { registerReuseOnChain };

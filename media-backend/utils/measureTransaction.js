import fs from "fs";

export async function measureTransaction(promiseOrTx, label = "unknown") {
  const t_submit = Date.now();
  try {
    // Aguarda o que foi passado (pode ser uma transação ou um contrato)
    const result = await promiseOrTx;
    let txHash, gasUsed, contractAddress;

    // 🚀 Caso 1: o que recebemos é uma transação (TransactionResponse)
    if (result.wait) {
      const receipt = await result.wait();
      gasUsed = receipt.gasUsed?.toString() || "N/A";
      txHash = receipt.hash || receipt.transactionHash || "N/A";
      contractAddress = receipt.contractAddress || null;
    }

    // 🚀 Caso 2: o que recebemos é um contrato (Contract)
    else if (result.deploymentTransaction) {
      const tx = await result.deploymentTransaction();
      const receipt = await tx.wait();
      gasUsed = receipt.gasUsed?.toString() || "N/A";
      txHash = tx.hash || "N/A";
      contractAddress = result.target || result.address || null;
    }

    else {
      throw new Error("Objeto passado ao measureTransaction não é válido.");
    }

    const t_mined = Date.now();
    const latency = (t_mined - t_submit) / 1000;

    const log = {
      label,
      txHash,
      contractAddress,
      gasUsed,
      latency,
      timestamp: new Date().toISOString(),
    };

    fs.appendFileSync("blockchain_metrics.log", JSON.stringify(log) + "\n");
    console.log(`📊 ${label} — Latência: ${latency.toFixed(2)}s, Gas: ${gasUsed}`);

    return result;
  } catch (err) {
    fs.appendFileSync(
      "blockchain_metrics.log",
      JSON.stringify({ label, error: err.message }) + "\n"
    );
    console.error(`❌ Erro na transação (${label}):`, err.message);
    throw err;
  }
}

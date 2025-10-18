import fs from "fs";
import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("⏱️ Teste de desempenho do contrato MusicMix", function () {
  this.timeout(60000); // até 60s de timeout

  it("Deve medir o tempo de execução e gas do deploy e da função", async function () {
    const [owner] = await ethers.getSigners();
    const MusicMix = await ethers.getContractFactory("MusicMix");

    console.log("🚀 Início do deploy do MusicMix...");
    const t0 = Date.now();

    // ======== DEPLOY ========
    const contract = await MusicMix.deploy(
      "mix001",
      "Mix de Teste",
      "Autor Teste",
      owner.address,
      "mp3",
      "rock",
      []
    );
    await contract.waitForDeployment();

    const t1 = Date.now();
    const deployTime = ((t1 - t0) / 1000).toFixed(3);
    console.log(`✅ Deploy concluído em ${deployTime}s`);

    // ======== EXECUÇÃO DE FUNÇÃO ========
    console.log("🎵 A executar uma função do contrato...");
    const t2 = Date.now();

    const id = await contract.mixId(); // ou outra função do contrato

    const t3 = Date.now();
    const execTime = ((t3 - t2) / 1000).toFixed(3);
    console.log(`📊 Execução concluída em ${execTime}s`);
    console.log(`🔖 mixId retornado: ${id}`);

    expect(await contract.mixCreator()).to.equal("Autor Teste");

    // ======== RESULTADOS ========
    const deployTx = await contract.deploymentTransaction();
    const receipt = await deployTx.wait();
    console.log("⛽ Gas usado no deploy:", receipt.gasUsed.toString());

    const log = {
      contract: "MusicMix",
      deployTime: Number(deployTime),
      execTime: Number(execTime),
      gasUsed: receipt.gasUsed.toString(),
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync("performance_results.log", JSON.stringify(log) + "\n");
  });
});

// test/MusicReuse.js
import pkg from "hardhat";
const { ethers } = pkg;
import fs from "fs";

describe("⏱️ Teste de desempenho do contrato MusicReuse", function () {
  it("Deve medir o tempo de execução e gas do deploy e da função", async function () {
    const [owner] = await ethers.getSigners();
    const startDeploy = performance.now();

    const MusicReuse = await ethers.getContractFactory("MusicReuse");

    const data = {
      reuseId: "reuse001",
      originalId: "original001",
      originalTitle: "Original Song",
      originalCreator: "Mariana",
      creatorWallet: owner.address,
      reuserName: "Utilizador B",
      reuserWallet: owner.address,
      reusePercent: 25,
      valuePaid: ethers.parseEther("0.01"),
      originalFileHash:
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      snippetHash:
        "0x0000000000000000000000000000000000000000000000000000000000000002",
      format: "mp3",
      genre: "pop",
      snippetDuration: 30,
    };

    // 🚀 Deploy
    const contract = await MusicReuse.deploy(data);
    await contract.waitForDeployment();
    const deployEnd = performance.now();
    const deployTime = (deployEnd - startDeploy) / 1000;
    console.log(`🚀 Deploy concluído em ${deployTime.toFixed(3)}s`);

    // 🎵 Função pública (originalTitle)
    const startExec = performance.now();
    const title = await contract.originalTitle();
    const endExec = performance.now();
    const execTime = (endExec - startExec) / 1000;
    console.log(`🎵 Execução concluída em ${execTime.toFixed(3)}s`);
    console.log(`🔖 originalTitle retornado: ${title}`);

    // ⛽ Gas usado
    const receipt = await contract.deploymentTransaction().wait();
    const gasUsed = receipt.gasUsed.toString();
    console.log(`⛽ Gas usado no deploy: ${gasUsed}`);

    // 💾 Guardar resultados
    const result = {
      contract: "MusicReuse",
      deployTime,
      execTime,
      gasUsed,
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync("performance_results.log", JSON.stringify(result) + "\n");
    console.log("✅ Métricas guardadas em performance_results.log");
  });
});

import pkg from "hardhat";
const { ethers } = pkg;
import { expect } from "chai";

describe("⏱️ Teste de desempenho do contrato MusicRights", function () {
  it("Deve medir latência, tempo de deploy, execução e gas", async function () {
    const deployTimes = [];
    const execTimes = [];
    const latencies = [];
    const gasUsedValues = [];

    const iterations = 10;
    for (let i = 0; i < iterations; i++) {
      const [owner] = await ethers.getSigners();
      const MusicRights = await ethers.getContractFactory("MusicRights");

      const startLatency = performance.now();
      const contract = await MusicRights.deploy(
        "Song Title",
        "Artist Name",
        ethers.encodeBytes32String("hash123"),
        1000,
        "mp3",
        "Pop",
        180,
        "{}",
        [owner.address],
        [100]
      );
      const deployTx = await contract.deploymentTransaction().wait();
      const endLatency = performance.now();

      const latency = (endLatency - startLatency) / 1000; // segundos
      const deployTime = deployTx.timestamp ? 0 : latency / 2; // aproximado
      const gasUsed = Number(deployTx.gasUsed?.toString() || 0);

      // Executar uma função simples (title) para medir tempo de execução
      const startExec = performance.now();
      const title = await contract.title();
      const endExec = performance.now();
      const execTime = (endExec - startExec) / 1000;

      latencies.push(latency);
      deployTimes.push(deployTime);
      execTimes.push(execTime);
      gasUsedValues.push(gasUsed);

      console.log(
        `Execução ${i + 1}: latência=${latency.toFixed(3)}s, deploy=${deployTime.toFixed(
          3
        )}s, execução=${execTime.toFixed(3)}s, gas=${gasUsed}`
      );
    }

    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = arr => Math.sqrt(mean(arr.map(x => (x - mean(arr)) ** 2)));

    console.log("\n📊 MusicRights");
    console.log(`⏱️ Latência média: ${mean(latencies).toFixed(3)} ± ${std(latencies).toFixed(3)} s`);
    console.log(`⚙️ Deploy médio:   ${mean(deployTimes).toFixed(3)} ± ${std(deployTimes).toFixed(3)} s`);
    console.log(`🎵 Execução média: ${mean(execTimes).toFixed(3)} ± ${std(execTimes).toFixed(3)} s`);
    console.log(`⛽ Gas médio:      ${mean(gasUsedValues).toFixed(0)} ± ${std(gasUsedValues).toFixed(0)} gas`);
  });
});

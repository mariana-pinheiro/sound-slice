import fs from "fs";

function mean(arr) { return arr.reduce((a,b)=>a+b,0)/arr.length; }
function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map(x => (x - m) ** 2)));
}

function analyze(file, labelField, valueField) {
  const data = fs.readFileSync(file, "utf-8").trim().split("\n")
    .map(l => JSON.parse(l))
    .filter(l => l[valueField] !== undefined);
  const values = data.map(l => parseFloat(l[valueField]));
  return { mean: mean(values), std: stddev(values), n: values.length };
}

const latency = analyze("blockchain_metrics.log", "label", "latency");
const gas = analyze("blockchain_metrics.log", "label", "gasUsed");
const deploy = analyze("performance_results.log", "contract", "deployTime");
const exec = analyze("performance_results.log", "contract", "execTime");

console.log("📊 Métricas calculadas:");
console.log(`⏱️ Latência: ${latency.mean.toFixed(3)} ± ${latency.std.toFixed(3)} s (${latency.n} execuções)`);
console.log(`⚙️ Deploy:   ${deploy.mean.toFixed(3)} ± ${deploy.std.toFixed(3)} s (${deploy.n} execuções)`);
console.log(`🎵 Execução: ${exec.mean.toFixed(3)} ± ${exec.std.toFixed(3)} s (${exec.n} execuções)`);
console.log(`⛽ Gas usado: ${gas.mean.toFixed(0)} ± ${gas.std.toFixed(0)} gas`);

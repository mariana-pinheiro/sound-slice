document.getElementById("audioFile").addEventListener("change", function (e) {
  const file = e.target.files[0];
  const audioPlayer = document.getElementById("audioPlayer");

  if (file) {
    const url = URL.createObjectURL(file);
    audioPlayer.src = url;
    audioPlayer.load();
  }
});

document.getElementById("calculate").addEventListener("click", function () {
  const start = parseFloat(document.getElementById("startTime").value);
  const end = parseFloat(document.getElementById("endTime").value);
  const duration = end - start;

  if (isNaN(duration) || duration <= 0) {
    document.getElementById("result").textContent = "Intervalo inválido.";
    return;
  }

  const price = (duration * 0.05).toFixed(2);
  document.getElementById("result").textContent = `Valor a pagar: €${price}`;
});


const express = require("express");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = 5500;

app.listen(PORT, () => {
  console.log(`Servidor a correr em http://localhost:${PORT}`);
});

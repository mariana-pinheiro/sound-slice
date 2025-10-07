document.getElementById("mediaInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
  
    // Simular metadados
    const metadata = {
      nomeFicheiro: file.name,
      tipo: file.type,
      tamanho: file.size + " bytes",
      autor: "Autor Desconhecido (simulado)",
      licenca: "CC-BY 4.0",
      did: "did:example:123456789abcdefghi"
    };
  
    document.getElementById("metadataDisplay").textContent = JSON.stringify(metadata, null, 2);
  });
  
  function simulateReuse() {
    const contract = {
      reusedFrom: "did:example:123456789abcdefghi",
      newOwner: "did:user:abc123",
      usage: "Exibição pública + modificação permitida",
      royalty: "2.5%",
      timestamp: new Date().toISOString()
    };
  
    document.getElementById("contractDisplay").textContent = JSON.stringify(contract, null, 2);
  }
  
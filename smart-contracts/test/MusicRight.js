import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("MusicRights", function () {
  let musicRights;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const MusicRights = await ethers.getContractFactory("MusicRights");

    musicRights = await MusicRights.deploy(
      "Minha Musica",                  // _title
      "Artista X",                     // _artist
      ethers.keccak256(ethers.toUtf8Bytes("ficheiro.mp3")), // _fileHash
      ethers.parseEther("1"),          // _basePrice (1 ETH = 100%)
      "mp3",                           // _format
      "Rock",                          // _genre
      180,                             // _duration (segundos)
      "extra metadata JSON",           // _extra
      [owner.address, addr1.address],  // titulares
      [70, 30]                         // percentagens SC4M
    );
    await musicRights.waitForDeployment();
  });

  it("Deve guardar corretamente o título e o artista", async function () {
    expect(await musicRights.title()).to.equal("Minha Musica");
    expect(await musicRights.artist()).to.equal("Artista X");
  });

  it("Deve registar um reuse e distribuir pagamentos", async function () {
    const tx = await musicRights.connect(addr2).registerReuse(50, {
      value: ethers.parseEther("0.5") 
    });
    await tx.wait();

    const reuse = await musicRights.getReuse(0);
    expect(reuse[1]).to.equal(50);
  });
});
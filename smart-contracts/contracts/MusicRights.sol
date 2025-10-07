// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MusicRights {
    address public owner;
    string public title;
    string public artist;
    bytes32 public fileHash;    // hash SHA256 do ficheiro
    uint256 public basePrice;  // preço base em wei
    string public format;     
    string public genre;     
    uint256 public duration;   // segundos
    string public extra;       // JSON de metadados adicionais

    address[] public holders;  // co-titulares
    uint256[] public shares;   // percentagens correspondentes

    struct Reuse {
        address user;
        uint256 percentage;
        uint256 timestamp;
        uint256 valuePaid;
    }

    Reuse[] public reuses;

    constructor(
        string memory _title,
        string memory _artist,
        bytes32 _fileHash,
        uint256 _basePrice,
        string memory _format,
        string memory _genre,
        uint256 _duration,
        string memory _extra,
        address[] memory _holders,
        uint256[] memory _shares
    ) {
        require(_holders.length == _shares.length, "Titulares e percentagens desalinhados");
        uint256 totalShare = 0;
        for (uint256 i = 0; i < _shares.length; i++) {
            totalShare += _shares[i];
        }
        require(totalShare == 100, "As percentagens devem somar 100");

        owner = msg.sender;
        title = _title;
        artist = _artist;
        fileHash = _fileHash;
        basePrice = _basePrice;
        format = _format;
        genre = _genre;
        duration = _duration;
        extra = _extra;
        holders = _holders;
        shares = _shares;
    }

    function registerReuse(uint256 _percentage) public payable {
        uint256 expectedPayment = (basePrice * _percentage) / 100;
        require(msg.value >= expectedPayment, "Valor insuficiente enviado");

        reuses.push(Reuse({
            user: msg.sender,
            percentage: _percentage,
            timestamp: block.timestamp,
            valuePaid: msg.value
        }));

        // distribuir pagamentos proporcionalmente pelos titulares
        for (uint256 i = 0; i < holders.length; i++) {
            uint256 part = (msg.value * shares[i]) / 100;
            payable(holders[i]).transfer(part);
        }
    }

    function getReuse(uint256 index) public view returns (address, uint256, uint256, uint256) {
        Reuse memory r = reuses[index];
        return (r.user, r.percentage, r.timestamp, r.valuePaid);
    }

    function totalReuses() public view returns (uint256) {
        return reuses.length;
    }

    function getHolders() public view returns (address[] memory, uint256[] memory) {
        return (holders, shares);
    }
}

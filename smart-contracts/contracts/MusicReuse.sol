// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Music Reuse - Contrato inteligente para reutilização de faixas
/// @author Mariana
/// @notice Regista e protege os direitos de reutilização de excertos musicais

contract MusicReuse {
    // 🔹 Dados básicos
    string public originalId;
    string public originalTitle;
    string public originalCreator;
    address public creatorWallet;

    // 🔹 Reuso
    string public reuseId;
    string public reuserName;
    address public reuserWallet;

    uint256 public reusePercent;
    uint256 public valuePaid;
    uint256 public timestamp;

    // 🔹 Hashes e integridade
    bytes32 public originalFileHash;
    bytes32 public snippetHash;

    // 🔹 Blockchain info
    string public format;
    string public genre;
    uint256 public snippetDuration;

    struct ReuseData {
        string reuseId;
        string originalId;
        string originalTitle;
        string originalCreator;
        address creatorWallet;
        string reuserName;
        address reuserWallet;
        uint256 reusePercent;
        uint256 valuePaid;
        bytes32 originalFileHash;
        bytes32 snippetHash;
        string format;
        string genre;
        uint256 snippetDuration;
    }

    event ReuseRegistered(
        string reuseId,
        string originalId,
        string originalTitle,
        string reuserName,
        uint256 reusePercent,
        uint256 valuePaid,
        bytes32 snippetHash,
        uint256 timestamp
    );

    constructor(ReuseData memory data) {
        reuseId = data.reuseId;
        originalId = data.originalId;
        originalTitle = data.originalTitle;
        originalCreator = data.originalCreator;
        creatorWallet = data.creatorWallet;

        reuserName = data.reuserName;
        reuserWallet = data.reuserWallet;

        reusePercent = data.reusePercent;
        valuePaid = data.valuePaid;
        originalFileHash = data.originalFileHash;
        snippetHash = data.snippetHash;
        format = data.format;
        genre = data.genre;
        snippetDuration = data.snippetDuration;

        timestamp = block.timestamp;

        emit ReuseRegistered(
            data.reuseId,
            data.originalId,
            data.originalTitle,
            data.reuserName,
            data.reusePercent,
            data.valuePaid,
            data.snippetHash,
            timestamp
        );
    }
}

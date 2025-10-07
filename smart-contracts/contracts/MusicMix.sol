// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Music Mix - Contrato inteligente para mixagem de várias faixas musicais
/// @author Mariana
/// @notice Regista a autoria e os direitos de um mix criado a partir de várias músicas

contract MusicMix {
    struct Source {
        string originalId;       // ID da música original (MongoDB ou MusicRights)
        string title;            // Título da música original
        string creatorName;      // Nome do criador original
        address creatorWallet;   // Wallet do criador original
        uint256 reusePercent;    // Percentagem usada no mix
        uint256 valueShare;      // Valor correspondente (em wei)
    }

    string public mixId;         // ID interno do mix
    string public mixTitle;      // Título do mix
    string public mixCreator;    // Nome do criador do mix
    address public mixWallet;    // Wallet do criador do mix
    string public format;        // Ex: mp3
    string public genre;         // Ex: Pop, Jazz, etc.
    uint256 public timestamp;    // Quando foi criado

    Source[] public sources;     // Lista de músicas originais reutilizadas

    event MixRegistered(
        string mixId,
        string mixTitle,
        address mixWallet,
        uint256 totalSources,
        uint256 timestamp
    );

    constructor(
        string memory _mixId,
        string memory _mixTitle,
        string memory _mixCreator,
        address _mixWallet,
        string memory _format,
        string memory _genre,
        Source[] memory _sources
    ) {
        mixId = _mixId;
        mixTitle = _mixTitle;
        mixCreator = _mixCreator;
        mixWallet = _mixWallet;
        format = _format;
        genre = _genre;

        for (uint256 i = 0; i < _sources.length; i++) {
            sources.push(_sources[i]);
        }

        timestamp = block.timestamp;

        emit MixRegistered(_mixId, _mixTitle, _mixWallet, _sources.length, timestamp);
    }

    /// @notice Devolve todas as músicas usadas no mix
    function getSources() public view returns (Source[] memory) {
        return sources;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

error Nft__NeedMoreEthSent();

contract Nft is ERC721URIStorage {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;
    uint256 internal immutable mintFee;

    event NftMinted(address indexed minter, uint256 tokenId);

    constructor(uint256 _mintFee) ERC721("Payoon Tokens", "BPN") {
        mintFee = _mintFee;
    }

    function createToken(string memory _tokenURI) external payable {
        if (msg.value < mintFee) {
            revert Nft__NeedMoreEthSent();
        }
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        emit NftMinted(msg.sender, tokenId);
    }
}

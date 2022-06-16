// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

error NftMarketplace__TokenIdExists(address nftAddress, uint256 tokenId);
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NowOwner();
error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
error NftMarketplace__NoProceeds();
error NftMarketplace__TransferFailed();

contract NftMarketplace is ReentrancyGuard {
    struct MarketItem {
        address seller;
        uint256 price;
    }

    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemCancelled(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId
    );

    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    mapping(address => mapping(uint256 => MarketItem)) private marketItems;
    mapping(address => uint256) private addressProceeds;

    modifier notListed(address nftAddress, uint256 tokenId) {
        MarketItem memory item = marketItems[nftAddress][tokenId];
        if (item.price > 0) {
            revert NftMarketplace__TokenIdExists(nftAddress, tokenId);
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {
        MarketItem memory item = marketItems[nftAddress][tokenId];
        if (item.price <= 0) {
            revert NftMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721 nftContract = IERC721(nftAddress);
        address owner = nftContract.ownerOf(tokenId);
        if (spender != owner) {
            revert NftMarketplace__NowOwner();
        }
        _;
    }

    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    ) external notListed(nftAddress, tokenId) isOwner(nftAddress, tokenId, msg.sender) {
        if (price <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }
        IERC721 nftContract = IERC721(nftAddress);
        if (nftContract.getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedForMarketplace();
        }
        marketItems[nftAddress][tokenId] = MarketItem(msg.sender, price);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    function cancelListing(address nftAddress, uint256 tokenId)
        external
        isListed(nftAddress, tokenId)
        isOwner(nftAddress, tokenId, msg.sender)
    {
        delete (marketItems[nftAddress][tokenId]);
        emit ItemCancelled(msg.sender, nftAddress, tokenId);
    }

    function buyItem(address nftAddress, uint256 tokenId)
        external
        payable
        isListed(nftAddress, tokenId)
        nonReentrant
    {
        MarketItem memory item = marketItems[nftAddress][tokenId];
        if (msg.value < item.price) {
            revert NftMarketplace__PriceNotMet(nftAddress, tokenId, item.price);
        }
        addressProceeds[item.seller] += msg.value;
        delete (marketItems[nftAddress][tokenId]);
        IERC721(nftAddress).safeTransferFrom(item.seller, msg.sender, tokenId);
        emit ItemBought(msg.sender, nftAddress, tokenId, item.price);
    }

    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    )
        external
        isListed(nftAddress, tokenId)
        nonReentrant
        isOwner(nftAddress, tokenId, msg.sender)
    {
        marketItems[nftAddress][tokenId].price = newPrice;
        emit ItemListed(msg.sender, nftAddress, tokenId, newPrice);
    }

    function withdrawProceeds() external {
        uint256 proceeds = addressProceeds[msg.sender];
        if (proceeds <= 0) {
            revert NftMarketplace__NoProceeds();
        }
        addressProceeds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        if (!success) {
            revert NftMarketplace__TransferFailed();
        }
    }

    function getMarketItem(address nftAddress, uint256 tokenId)
        external
        view
        returns (MarketItem memory)
    {
        return marketItems[nftAddress][tokenId];
    }

    function getAddressProceeds(address seller) external view returns (uint256) {
        return addressProceeds[seller];
    }
}

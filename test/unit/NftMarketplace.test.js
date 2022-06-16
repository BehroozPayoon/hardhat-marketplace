const { expect, assert } = require("chai")
const { network, ethers, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip()
    : describe("Nft Marketplace Unit Tests", function () {
          let nftMarketplace, nftMarketplaceContract, nft, nftContract
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 1

          beforeEach(async () => {
              accounts = await ethers.getSigners() // could also do with getNamedAccounts
              deployer = accounts[0]
              user = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplaceContract = await ethers.getContract("NftMarketplace")
              nftMarketplace = nftMarketplaceContract.connect(deployer)
              nftContract = await ethers.getContract("Nft")
              nft = await nftContract.connect(deployer)
              await nft.createToken("https://test.com", { value: PRICE })
              await nft.approve(nftMarketplaceContract.address, TOKEN_ID)
          })

          describe("listItem", function () {
              it("emits an event after listing an item", async function () {
                  expect(await nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)).to.emit(
                      "ItemListed"
                  )
              })
              it("exclusively items that haven't been listed", async function () {
                  await nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  const error = `NftMarketplace__TokenIdExists("${nft.address}", ${TOKEN_ID})`
                  await expect(
                      nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error)
              })
              it("exclusively allows owners to list", async function () {
                  nftMarketplace = nftMarketplaceContract.connect(user)
                  await nft.approve(user.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NowOwner")
              })
              it("needs approval to list item", async function () {
                  await nft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotApprovedForMarketplace")
              })
              it("updates listing with seller and price", async function () {
                  await nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  const item = await nftMarketplace.getMarketItem(nft.address, TOKEN_ID)
                  assert(item.price.toString() == PRICE.toString())
                  assert(item.seller.toString() == deployer.address)
              })
          })

          describe("cancelListing", async function () {
              it("reverts if there is no lisitng", async function () {
                  const error = `NftMarketplace__NotListed("${nft.address}", ${TOKEN_ID})`
                  await expect(
                      nftMarketplace.cancelListing(nft.address, TOKEN_ID)
                  ).to.be.revertedWith(error)
              })
              it("reverts if anyone but the owner tries to call", async function () {
                  await nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplaceContract.connect(user)
                  await nft.approve(user.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.cancelListing(nft.address, TOKEN_ID)
                  ).to.be.revertedWith("NftMarketplace__NowOwner")
              })
              it("emits event and remove listing", async function () {
                  await nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  expect(await nftMarketplace.cancelListing(nft.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  )
                  const item = await nftMarketplace.getMarketItem(nft.address, TOKEN_ID)
                  assert(item.price.toString() == "0")
              })
          })

          describe("buyItem", function () {
              it("reverts if the item isnt listed", async function () {
                  await expect(nftMarketplace.buyItem(nft.address, TOKEN_ID)).to.be.revertedWith(
                      "NftMarketplace__NotListed"
                  )
              })
              it("reverts if the price isnt met", async function () {
                  await nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  await expect(nftMarketplace.buyItem(nft.address, TOKEN_ID)).to.be.revertedWith(
                      "NftMarketplace__PriceNotMet"
                  )
              })
              it("transfers the nft to the buyer and updates internal proceeds record", async function () {
                  await nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplaceContract.connect(user)
                  expect(
                      await nftMarketplace.buyItem(nft.address, TOKEN_ID, { value: PRICE })
                  ).to.emit("ItemBought")
                  const newOwner = await nft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketplace.getAddressProceeds(
                      deployer.address
                  )
                  assert(newOwner.toString() == user.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })
          })

          describe("updateListing", function () {
              it("must be owner and listed", async function () {
                  await expect(
                      nftMarketplace.updateListing(nft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotListed")
                  await nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplaceContract.connect(user)
                  await expect(
                      nftMarketplace.updateListing(nft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NowOwner")
              })
              it("updates the price of the item", async function () {
                  const updatedPrice = ethers.utils.parseEther("0.2")
                  await nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  expect(
                      await nftMarketplace.updateListing(nft.address, TOKEN_ID, updatedPrice)
                  ).to.emit("ItemListed")
                  const listing = await nftMarketplace.getMarketItem(nft.address, TOKEN_ID)
                  assert(listing.price.toString() == updatedPrice.toString())
              })
          })

          describe("withdrawProceeds", function () {
              it("doesn't allow 0 proceed withdrawls", async function () {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith("NoProceeds")
              })
              it("withdraws proceeds", async function () {
                  await nftMarketplace.listItem(nft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplaceContract.connect(user)
                  await nftMarketplace.buyItem(nft.address, TOKEN_ID, { value: PRICE })
                  nftMarketplace = nftMarketplaceContract.connect(deployer)

                  const deployerProceedsBefore = await nftMarketplace.getAddressProceeds(
                      deployer.address
                  )
                  const deployerBalanceBefore = await deployer.getBalance()
                  const txResponse = await nftMarketplace.withdrawProceeds()
                  const transactionReceipt = await txResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const deployerBalanceAfter = await deployer.getBalance()

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerProceedsBefore.add(deployerBalanceBefore).toString()
                  )
              })
          })
      })

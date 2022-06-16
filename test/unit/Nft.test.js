const { assert } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Unit Tests", function () {
          let nft, deployer

          beforeEach(async function () {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              await deployments.fixture(["nft"])
              nft = await ethers.getContract("Nft")
          })

          describe("constructor", () => {
              it("sets starting values correctly", async function () {
                  const mintFee = await nft.getMintFee()
                  assert.equal(mintFee, networkConfig[network.config.chainId]["mintFee"])
              })
          })

          describe("Mint nft", () => {
              it("allow user to mint nft and set tokenId and tokenURI correctly", async function () {
                  const mintFee = await nft.getMintFee()
                  const txResponse = await nft.createToken("https://test.com", {
                      value: mintFee.toString(),
                  })
                  await txResponse.wait(1)
                  const tokenURI = await nft.tokenURI(1)
                  const tokenCounter = await nft.getTokenCounter()

                  assert.equal(tokenURI, "https://test.com")
                  assert.equal(tokenCounter.toString(), "1")
              })
          })
      })

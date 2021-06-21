import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import { solidity } from "ethereum-waffle"
import { BigNumber, utils } from 'ethers'
import { ethers } from 'hardhat'
import { ERC20Stub, ERC20Stub__factory, Pool, Pool__factory } from '../typechain'

chai.use(solidity).use(chaiAsPromised)
const { expect } = chai

describe("Pool", async () => {

  let owner: SignerWithAddress
  let lp1: SignerWithAddress
  let lp2: SignerWithAddress

  let weth:ERC20Stub

  let sut:Pool

  beforeEach(async () => {

    let signers = await ethers.getSigners()
    owner = signers[0]
    lp1 = signers[1]
    lp2 = signers[2]

    const erc20Factory = (await ethers.getContractFactory('ERC20Stub', owner)) as ERC20Stub__factory
    weth = await erc20Factory.deploy("Wrapped ETH", "WETH")
    await weth.deployed()
    expect(weth.address).to.properAddress

    const poolFactory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory
    sut = await poolFactory.deploy(weth.address)
    await sut.deployed()
    expect(sut.address).to.properAddress

    await weth.setBalance(lp1.address, utils.parseUnits("1000"))
    await weth.connect(lp1).approve(sut.address, ethers.constants.MaxUint256)

    await weth.setBalance(lp2.address, utils.parseUnits("1000"))
    await weth.connect(lp2).approve(sut.address, ethers.constants.MaxUint256)

  })

  describe("A liquidy Provider", async () => {

    it("should be able to deposit", async () => {
      await sut.connect(lp1).deposit(utils.parseUnits("500"))
      expect(await sut.connect(lp1).balance()).to.be.eq(utils.parseUnits("500"))
    })

    it("shouldn't have balance if it didn't deposit", async () => {
      await sut.connect(lp1).deposit(utils.parseUnits("500"))
      expect(await sut.connect(lp2).balance()).to.be.eq(utils.parseUnits("0"))
    })

  })

  describe("Underlying Balance", async () => {

    it("should start with balance zero", async () => {
      expect(await weth.balanceOf(sut.address)).to.be.eq(utils.parseUnits("0"))
    })

    it("should have a balance equals to the sum of all its deposits", async () => {
      await sut.connect(lp1).deposit(utils.parseUnits("200"))
      await sut.connect(lp2).deposit(utils.parseUnits("1000"))
      expect(await weth.balanceOf(sut.address)).to.be.eq(utils.parseUnits("1200"))
    })

  })

})

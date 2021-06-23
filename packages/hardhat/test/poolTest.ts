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
  let uniswap: string

  let weth: ERC20Stub

  let sut: Pool

  beforeEach(async () => {

    let signers = await ethers.getSigners()
    owner = signers[0]
    lp1 = signers[1]
    lp2 = signers[2]

    uniswap = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

    const erc20Factory = (await ethers.getContractFactory('ERC20Stub', owner)) as ERC20Stub__factory
    weth = await erc20Factory.deploy("Wrapped ETH", "WETH")
    await weth.deployed()
    expect(weth.address).to.properAddress

    const poolFactory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory
    sut = await poolFactory.deploy(weth.address)
    await sut.deployed()
    expect(sut.address).to.properAddress

    await weth.setBalance(owner.address, utils.parseUnits("1000000"))
    await weth.connect(owner).approve(sut.address, ethers.constants.MaxUint256)

    await weth.setBalance(lp1.address, utils.parseUnits("1000"))
    await weth.connect(lp1).approve(sut.address, ethers.constants.MaxUint256)

    await weth.setBalance(lp2.address, utils.parseUnits("1000"))
    await weth.connect(lp2).approve(sut.address, ethers.constants.MaxUint256)

    await weth.setBalance(uniswap, utils.parseUnits("0"))

  })

  describe("Deposit", async () => {

    it("should allow liquidity provider to deposit", async () => {

      await sut.connect(lp1).deposit(utils.parseUnits("450"))

      expect(await sut.balance()).to.be.eq(utils.parseUnits("450"))
      expect(await sut.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("450"))
      expect(await sut.shareOf(lp1.address)).to.be.eq(utils.parseUnits("100", 0))

      expect(await weth.balanceOf(sut.address)).to.be.eq(utils.parseUnits("450"))
      expect(await weth.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("550"))

    })

    it("should allow multiple liquidity providers to deposit", async () => {

      await sut.connect(lp1).deposit(utils.parseUnits("200"))
      await sut.connect(lp2).deposit(utils.parseUnits("400"))

      expect(await sut.balance()).to.be.eq(utils.parseUnits("600"))
      expect(await sut.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("200"))
      expect(await sut.balanceOf(lp2.address)).to.be.eq(utils.parseUnits("400"))

      expect(await sut.shareOf(lp1.address)).to.be.eq(utils.parseUnits("33", 0))
      expect(await sut.shareOf(lp2.address)).to.be.eq(utils.parseUnits("66", 0))

      expect(await weth.balanceOf(sut.address)).to.be.eq(utils.parseUnits("600"))
      expect(await weth.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("800"))
      expect(await weth.balanceOf(lp2.address)).to.be.eq(utils.parseUnits("600"))

    })

    it("shouldn't change other liquidity provider balances", async () => {

        await sut.connect(lp1).deposit(utils.parseUnits("200"))
        expect(await sut.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("200"))

        await sut.connect(lp2).deposit(utils.parseUnits("800"))
        expect(await sut.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("200"))
        expect(await sut.balanceOf(lp2.address)).to.be.eq(utils.parseUnits("800"))

    })

  })

  describe("Borrow", async () => {

    it("shouldn't allow borrow zero", async () => {
      await expect(sut.borrow(utils.parseUnits("0"), owner.address)).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Pool: borrow amount should be greater than zero'");
    })

    it("should allow borrow", async () => {

      await sut.connect(lp1).deposit(utils.parseUnits("300"))
      await sut.borrow(utils.parseUnits("100"), uniswap)

      expect(await sut.borrowed()).to.be.eq(utils.parseUnits("100"))
      expect(await weth.balanceOf(uniswap)).to.be.eq(utils.parseUnits("100"))

    })

    it("shouldn't change balance", async () => {

      await sut.connect(lp1).deposit(utils.parseUnits("300"))
      await sut.borrow(utils.parseUnits("100"), uniswap)

      expect(await sut.balance()).to.be.eq(utils.parseUnits("300"))

    })

  })

  describe("Repay", async () => {

    it("shouldn't allow repay amount zero", async () => {
      await expect(sut.repay(utils.parseUnits("0"), utils.parseUnits("1"))).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Pool: repay amount should be greater than zero'");
    })

    it("shouldn't allow repay interest zero", async () => {
      await expect(sut.repay(utils.parseUnits("1"), utils.parseUnits("0"))).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Pool: repay interest should be greater than zero'");
    })

    it("shouldn't allow repay more than borrowed", async () => {

      await sut.connect(lp1).deposit(utils.parseUnits("300"))
      await sut.borrow(utils.parseUnits("200"), uniswap)

      await expect(sut.repay(utils.parseUnits("300"), utils.parseUnits("10"))).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Pool: repay amount should be equals or lower than borrowed'");

    })

    it("should add interest to balance", async () => {

      await sut.connect(lp1).deposit(utils.parseUnits("500"))
      await sut.borrow(utils.parseUnits("500"), uniswap)

      expect(await sut.balance()).to.be.eq(utils.parseUnits("500"))

      await sut.repay(utils.parseUnits("500"), utils.parseUnits("20"))

      expect(await sut.balance()).to.be.eq(utils.parseUnits("520"))

    })

    it("should subtract amount to borrowed", async () => {

      await sut.connect(lp1).deposit(utils.parseUnits("400"))
      await sut.borrow(utils.parseUnits("200"), uniswap)

      expect(await sut.borrowed()).to.be.eq(utils.parseUnits("200"))

      await sut.repay(utils.parseUnits("100"), utils.parseUnits("20"))

      expect(await sut.borrowed()).to.be.eq(utils.parseUnits("100"))

    })

  })

  describe("Withdaw", async () => {

    it("shouldn't allow liquidity provider to withdraw zero", async () => {
      await expect(sut.connect(lp1).withdraw(utils.parseUnits("0"))).eventually.to.rejectedWith(Error, "Pool: withdraw amount should be greater than zero'")
    })

    it("shouldn't allow liquidity provider to withdraw more balance", async () => {
      await sut.connect(lp1).deposit(utils.parseUnits("400"))
      await expect(sut.connect(lp1).withdraw(utils.parseUnits("500"))).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Pool: withdraw amount greater than balance'")
    })

    it("shouldn't allow liquidity provider to withdraw more than its balance", async () => {
      await sut.connect(lp1).deposit(utils.parseUnits("400"))
      await sut.connect(lp2).deposit(utils.parseUnits("400"))
      await expect(sut.connect(lp1).withdraw(utils.parseUnits("500"))).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Pool: withdraw amount greater than sender balance'")
    })

    it("should allow liquidity provider to withdraw", async () => {

      // Setup
      await sut.connect(lp1).deposit(utils.parseUnits("200"))

      expect(await sut.balance()).to.be.eq(utils.parseUnits("200"))
      expect(await sut.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("200"))
      expect(await sut.shareOf(lp1.address)).to.be.eq(utils.parseUnits("100", 0))

      expect(await weth.balanceOf(sut.address)).to.be.eq(utils.parseUnits("200"))
      expect(await weth.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("800"))

      // Withdrawal
      await sut.connect(lp1).withdraw(utils.parseUnits("200"))
      expect(await sut.balance()).to.be.eq(utils.parseUnits("0"))
      expect(await sut.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("0"))
      expect(await sut.shareOf(lp1.address)).to.be.eq(utils.parseUnits("0"))

      expect(await weth.balanceOf(sut.address)).to.be.eq(utils.parseUnits("0"))
      expect(await weth.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("1000"))

    })

    it("should allow liquidity provider to partially withdraw", async () => {

      // Setup
      await sut.connect(lp1).deposit(utils.parseUnits("500"))

      expect(await sut.balance()).to.be.eq(utils.parseUnits("500"))
      expect(await sut.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("500"))
      expect(await sut.shareOf(lp1.address)).to.be.eq(utils.parseUnits("100", 0))

      expect(await weth.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("500"))

      // Withdrawal
      await sut.connect(lp1).withdraw(utils.parseUnits("200"))
      expect(await sut.balance()).to.be.eq(utils.parseUnits("300"))
      expect(await sut.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("300"))
      expect(await sut.shareOf(lp1.address)).to.be.eq(utils.parseUnits("100", 0))

      expect(await weth.balanceOf(sut.address)).to.be.eq(utils.parseUnits("300"))
      expect(await weth.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("700"))

    })

    it("shouldn't change other liquidity provider balances", async () => {

        await sut.connect(lp1).deposit(utils.parseUnits("800"))
        await sut.connect(lp2).deposit(utils.parseUnits("700"))

        expect(await sut.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("800"))
        expect(await sut.balanceOf(lp2.address)).to.be.eq(utils.parseUnits("700"))

        await sut.connect(lp1).withdraw(utils.parseUnits("450"))
        expect(await sut.balanceOf(lp1.address)).to.be.eq(utils.parseUnits("350"))
        expect(await sut.balanceOf(lp2.address)).to.be.eq(utils.parseUnits("700"))

    })

  })

  describe("BalanceOf", async () => {

    it("should return zero for a liquidity provider without deposits ", async () => {
      await sut.connect(lp1).deposit(utils.parseUnits("500"))
      expect(await sut.balanceOf(lp2.address)).to.be.eq(utils.parseUnits("0"))
      expect(await weth.balanceOf(lp2.address)).to.be.eq(utils.parseUnits("1000"))
    })

  })

  describe("Underlying Balance", async () => {

    it("should start with zero", async () => {
      expect(await weth.balanceOf(sut.address)).to.be.eq(utils.parseUnits("0"))
    })

    it("should be equals to the sum of all its deposits", async () => {
      await sut.connect(lp1).deposit(utils.parseUnits("200"))
      await sut.connect(lp2).deposit(utils.parseUnits("1000"))
      expect(await weth.balanceOf(sut.address)).to.be.eq(utils.parseUnits("1200"))
    })

  })

})

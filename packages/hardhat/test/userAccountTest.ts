import { ethers } from 'hardhat'
import { use, expect } from "chai"
import { solidity } from "ethereum-waffle"
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ERC20Stub, ERC20Stub__factory, ERC20__factory, UserAccount, UserAccount__factory } from '../typechain'
import { utils } from 'ethers'

use(solidity)

describe("User Accounts", async () => {

    let owner: SignerWithAddress
    let trader: SignerWithAddress
    let userAccount: UserAccount
    let weth: ERC20Stub
    let lusd: ERC20Stub

    before(async () => {
        /* before tests */
        const signers = await ethers.getSigners()
        owner = signers[0]
        trader = signers[1]

        console.log(`Trader address: ${trader.address}`)

        const erc20Factory = (await ethers.getContractFactory('ERC20Stub', owner)) as ERC20Stub__factory
        weth = await erc20Factory.deploy("Wrapped ETH", "WETH")
        await weth.deployed()
        expect(weth.address).to.properAddress
        lusd = await erc20Factory.deploy("Liquity USD", "LUSD")
        await lusd.deployed()
        expect(lusd.address).to.properAddress

        const userAccountFactory = (await ethers.getContractFactory('UserAccount', owner)) as UserAccount__factory
        userAccount = await userAccountFactory.deploy(lusd.address, weth.address)
        await userAccount.deployed()
        expect(userAccount.address).to.properAddress
    })

    it("support trader deposits", async () => {
        await weth.mint(trader.address, utils.parseUnits("100"))
        await lusd.mint(trader.address, utils.parseUnits("25000"))
        await weth.connect(trader).approve(userAccount.address, utils.parseUnits("100"))
        await lusd.connect(trader).approve(userAccount.address, utils.parseUnits("25000"))
        const traderAccount = userAccount.connect(trader)

        // initial deposit
        await traderAccount.deposit(weth.address, utils.parseUnits("10"))
        await traderAccount.deposit(lusd.address, utils.parseUnits("1000"))

        expect(await weth.balanceOf(trader.address)).to.be.eq(utils.parseUnits("90"))
        expect(await lusd.balanceOf(trader.address)).to.be.eq(utils.parseUnits("24000"))

        expect(await traderAccount.wallet(weth.address)).to.be.eq(utils.parseUnits("10"))
        expect(await traderAccount.wallet(lusd.address)).to.be.eq(utils.parseUnits("1000"));

        // subsequent deposit
        await traderAccount.deposit(weth.address, utils.parseUnits("5"))
        await traderAccount.deposit(lusd.address, utils.parseUnits("500"))

        expect(await weth.balanceOf(trader.address)).to.be.eq(utils.parseUnits("85"))
        expect(await lusd.balanceOf(trader.address)).to.be.eq(utils.parseUnits("23500"))

        expect(await traderAccount.wallet(weth.address)).to.be.eq(utils.parseUnits("15"))
        expect(await traderAccount.wallet(lusd.address)).to.be.eq(utils.parseUnits("1500"));
    })
})
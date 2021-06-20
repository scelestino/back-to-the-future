import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import { solidity } from "ethereum-waffle"
import { BigNumber, utils } from 'ethers'
import { ethers } from 'hardhat'
import { ERC20Stub, ERC20Stub__factory, UserAccount, UserAccount__factory, FutureStub__factory } from '../typechain'
import fc from 'fast-check';

chai.use(solidity).use(chaiAsPromised)
const { expect } = chai

describe("User Accounts", async () => {

    let owner: SignerWithAddress
    let trader1: SignerWithAddress
    let trader2: SignerWithAddress
    let userAccount: UserAccount
    let weth: ERC20Stub
    let lusd: ERC20Stub
    let userAccountFactory: UserAccount__factory
    let futureFactory: FutureStub__factory
    let signers: SignerWithAddress[]

    before(async () => {
        /* before tests */
        signers = await ethers.getSigners()
        owner = signers[0]
        trader1 = signers[1]
        trader2 = signers[2]

        const erc20Factory = (await ethers.getContractFactory('ERC20Stub', owner)) as ERC20Stub__factory
        weth = await erc20Factory.deploy("Wrapped ETH", "WETH")
        await weth.deployed()
        expect(weth.address).to.properAddress
        lusd = await erc20Factory.deploy("Liquity USD", "LUSD")
        await lusd.deployed()
        expect(lusd.address).to.properAddress

        userAccountFactory = (await ethers.getContractFactory('UserAccount', owner)) as UserAccount__factory
        futureFactory = (await ethers.getContractFactory('FutureStub', owner)) as FutureStub__factory
    })

    beforeEach(async () => {
        userAccount = await userAccountFactory.deploy()
        await userAccount.deployed()
        expect(userAccount.address).to.properAddress

        for (let i = 1; i <= 2; i++) {
            const trader = signers[i];
            await weth.setBalance(trader.address, utils.parseUnits("100"))
            await lusd.setBalance(trader.address, utils.parseUnits("25000"))
            await weth.connect(trader).approve(userAccount.address, utils.parseUnits("100"))
            await lusd.connect(trader).approve(userAccount.address, utils.parseUnits("25000"))   
        }
    })

    describe("Account wallets", async () => {
        it("should support trader deposits", async () => {
            const trader1Account = userAccount.connect(trader1)
            const trader2Account = userAccount.connect(trader2)

            // trader1 initial deposit
            await trader1Account.deposit(weth.address, utils.parseUnits("10"))
            await trader1Account.deposit(lusd.address, utils.parseUnits("1000"))

            expect(await weth.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("90"))
            expect(await lusd.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("24000"))
            expect(await weth.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("10"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("1000"))

            expect(await trader1Account.wallet(weth.address)).to.be.eq(utils.parseUnits("10"))
            expect(await trader1Account.wallet(lusd.address)).to.be.eq(utils.parseUnits("1000"))

            // trader2 deposit
            await trader2Account.deposit(weth.address, utils.parseUnits("50"))
            await trader2Account.deposit(lusd.address, utils.parseUnits("9500"))

            expect(await weth.balanceOf(trader2.address)).to.be.eq(utils.parseUnits("50"))
            expect(await lusd.balanceOf(trader2.address)).to.be.eq(utils.parseUnits("15500"))
            expect(await weth.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("60"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("10500"))

            expect(await trader2Account.wallet(weth.address)).to.be.eq(utils.parseUnits("50"))
            expect(await trader2Account.wallet(lusd.address)).to.be.eq(utils.parseUnits("9500"))

            // subsequent trader1 deposit
            await trader1Account.deposit(weth.address, utils.parseUnits("5"))
            await trader1Account.deposit(lusd.address, utils.parseUnits("500"))

            expect(await weth.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("85"))
            expect(await lusd.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("23500"))
            expect(await weth.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("65"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("11000"))

            expect(await trader1Account.wallet(weth.address)).to.be.eq(utils.parseUnits("15"))
            expect(await trader1Account.wallet(lusd.address)).to.be.eq(utils.parseUnits("1500"))
        })

        it("should support trader withdrawals", async () => {
            const traderAccount = userAccount.connect(trader1)
            const trader2Account = userAccount.connect(trader2)
            await traderAccount.deposit(weth.address, utils.parseUnits("10"))
            await traderAccount.deposit(lusd.address, utils.parseUnits("1000"))
            await trader2Account.deposit(weth.address, utils.parseUnits("50"))
            await trader2Account.deposit(lusd.address, utils.parseUnits("9500"))

            //first withdrawal
            await traderAccount.withdraw(weth.address, utils.parseUnits("4"))
            await traderAccount.withdraw(lusd.address, utils.parseUnits("400"))

            expect(await weth.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("94"))
            expect(await lusd.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("24400"))
            expect(await weth.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("56"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("10100"))

            expect(await traderAccount.wallet(weth.address)).to.be.eq(utils.parseUnits("6"))
            expect(await traderAccount.wallet(lusd.address)).to.be.eq(utils.parseUnits("600"))

            expect(await trader2Account.wallet(weth.address)).to.be.eq(utils.parseUnits("50"))
            expect(await trader2Account.wallet(lusd.address)).to.be.eq(utils.parseUnits("9500"))

            //second withdrawal
            await traderAccount.withdraw(weth.address, utils.parseUnits("1"))
            await traderAccount.withdraw(lusd.address, utils.parseUnits("100"))

            expect(await weth.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("95"))
            expect(await lusd.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("24500"))
            expect(await weth.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("55"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("10000"))

            expect(await traderAccount.wallet(weth.address)).to.be.eq(utils.parseUnits("5"))
            expect(await traderAccount.wallet(lusd.address)).to.be.eq(utils.parseUnits("500"))

            expect(await trader2Account.wallet(weth.address)).to.be.eq(utils.parseUnits("50"))
            expect(await trader2Account.wallet(lusd.address)).to.be.eq(utils.parseUnits("9500"))
        })

        it("should always keep a consistent state", async () => {
            await lusd.setBalance(trader1.address, utils.parseUnits("250000"))
            await lusd.connect(trader1).approve(userAccount.address, BigNumber.from(2).pow(255))   
            const traderAccount = userAccount.connect(trader1)

            const bnArb = fc.bigIntN(80).map(BigNumber.from).map(bn => bn.abs())

            await fc.assert(fc.asyncProperty(bnArb, fc.boolean(), async (amount, isDeposit) => {
                const traderTokenBalance = await lusd.balanceOf(trader1.address);
                const accountTokenBalance = await lusd.balanceOf(userAccount.address);
                const traderWalletBalance = await traderAccount.wallet(lusd.address);

                if(isDeposit) {
                    const deposit = traderAccount.deposit(lusd.address, amount);
                    if(amount.gt(traderTokenBalance)) {
                        await expect(deposit).to.eventually.be.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'ERC20: transfer amount exceeds balance'")
                    } else {
                        await deposit
                        expect(await lusd.balanceOf(trader1.address)).to.be.eq(traderTokenBalance.sub(amount))
                        expect(await lusd.balanceOf(userAccount.address)).to.be.eq(accountTokenBalance.add(amount))
                        expect(await traderAccount.wallet(lusd.address)).to.be.eq(traderWalletBalance.add(amount))
                    }
                } else {
                    const withdraw = traderAccount.withdraw(lusd.address, amount);
                    if(amount.gt(traderWalletBalance)) {
                        await expect(withdraw).to.eventually.be.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'UserAccount: not enough balance'")
                    } else {
                        await withdraw
                        expect(await lusd.balanceOf(trader1.address)).to.be.eq(traderTokenBalance.add(amount))
                        expect(await lusd.balanceOf(userAccount.address)).to.be.eq(accountTokenBalance.sub(amount))
                        expect(await traderAccount.wallet(lusd.address)).to.be.eq(traderWalletBalance.sub(amount))
                    } 
                }
            }), {endOnFailure: true, verbose: true})
        })
    })    

    describe("Account positions", async () => {
        it("should correctly open a long position", async () => {
            const expiry = new Date();
            expiry.setMonth(expiry.getMonth() + 3);
            const traderAccount = userAccount.connect(trader1)
            await traderAccount.deposit(lusd.address, utils.parseUnits("1000"));
            await traderAccount.deposit(weth.address, utils.parseUnits("1"));
            const future = await futureFactory.deploy(weth.address, lusd.address, expiry.getMilliseconds());
            await future.deployed()
            expect(future.address).to.properAddress
            await future.setRate(2500)

            await traderAccount.openPosition(future.address, utils.parseUnits("1"), 5)

            await traderAccount.openPosition(future.address, utils.parseUnits("-0.5"), 5)

            const noPositions = await traderAccount.noPositions(trader1.address);

            for (let i = 0; noPositions.gt(i); i++) {
                const position = await traderAccount.positions(trader1.address, i);
                
                console.log(`position${i}.leverage`, position.leverage)
                console.log(`position${i}.quantity`, utils.formatUnits(position.quantity))
                console.log(`position${i}.amount`, utils.formatUnits(position.amount))   
            }
        })
    })
})

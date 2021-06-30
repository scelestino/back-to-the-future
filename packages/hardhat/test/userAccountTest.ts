import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import {solidity} from "ethereum-waffle"
import {BigNumber, constants, utils} from 'ethers'
import {ethers} from 'hardhat'
import {
    ERC20Stub,
    ERC20Stub__factory,
    UserAccount,
    UserAccount__factory,
    FutureStub__factory,
    Pool,
    Pool__factory
} from '../typechain'
import fc from 'fast-check';

chai.use(solidity).use(chaiAsPromised)
const {expect} = chai
const {parseUnits, parseEther} = utils

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
    let lusdPool: Pool;
    let wethPool: Pool;
    let lender: SignerWithAddress

    before(async () => {
        /* before tests */
        signers = await ethers.getSigners()
        owner = signers[0]
        trader1 = signers[1]
        trader2 = signers[2]
        lender = signers[4]

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

        await lusd.setBalance(lender.address, parseUnits("250000"))
        await weth.setBalance(lender.address, parseUnits("250000"))


        const poolFactory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory
        wethPool = await poolFactory.deploy(weth.address, 0, 0, 0, 0)
        await wethPool.deployed()
        await weth.connect(lender).approve(wethPool.address, constants.MaxUint256)
        await wethPool.connect(lender).deposit(utils.parseUnits("10"))

        lusdPool = await poolFactory.deploy(lusd.address, 0, 0, 0, 0)
        await lusdPool.deployed()
        await lusd.connect(lender).approve(lusdPool.address, constants.MaxUint256)
        await lusdPool.connect(lender).deposit(utils.parseUnits("25000"))

        for (let i = 1; i <= 2; i++) {
            const trader = signers[i];
            await lusd.setBalance(trader.address, parseUnits("25000"))
            await lusd.connect(trader).approve(userAccount.address, parseUnits("25000"))
        }
    })

    describe("Account wallets", async () => {
        it("should support trader deposits", async () => {
            const trader1Account = userAccount.connect(trader1)
            const trader2Account = userAccount.connect(trader2)

            // trader1 initial deposit
            await trader1Account.deposit(lusd.address, parseUnits("1000"))

            expect(await lusd.balanceOf(trader1.address)).to.be.eq(parseUnits("24000"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(parseUnits("1000"))

            expect(await trader1Account.wallet(trader1.address, lusd.address)).to.be.eq(parseUnits("1000"))

            // trader2 deposit
            await trader2Account.deposit(lusd.address, parseUnits("9500"))

            expect(await lusd.balanceOf(trader2.address)).to.be.eq(parseUnits("15500"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(parseUnits("10500"))

            expect(await trader2Account.wallet(trader2.address, lusd.address)).to.be.eq(parseUnits("9500"))

            // subsequent trader1 deposit
            await trader1Account.deposit(lusd.address, parseUnits("500"))

            expect(await lusd.balanceOf(trader1.address)).to.be.eq(parseUnits("23500"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(parseUnits("11000"))

            expect(await trader1Account.wallet(trader1.address, lusd.address)).to.be.eq(parseUnits("1500"))
        })

        it("should support trader withdrawals", async () => {
            const traderAccount = userAccount.connect(trader1)
            const trader2Account = userAccount.connect(trader2)
            await traderAccount.deposit(lusd.address, parseUnits("1000"))
            await trader2Account.deposit(lusd.address, parseUnits("9500"))

            //first withdrawal
            await traderAccount.withdraw(lusd.address, parseUnits("400"))

            expect(await lusd.balanceOf(trader1.address)).to.be.eq(parseUnits("24400"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(parseUnits("10100"))

            expect(await traderAccount.wallet(trader1.address, lusd.address)).to.be.eq(parseUnits("600"))

            expect(await trader2Account.wallet(trader2.address, lusd.address)).to.be.eq(parseUnits("9500"))

            //second withdrawal
            await traderAccount.withdraw(lusd.address, parseUnits("100"))

            expect(await lusd.balanceOf(trader1.address)).to.be.eq(parseUnits("24500"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(parseUnits("10000"))

            expect(await traderAccount.wallet(trader1.address, lusd.address)).to.be.eq(parseUnits("500"))

            expect(await trader2Account.wallet(trader2.address, lusd.address)).to.be.eq(parseUnits("9500"))
        })

        it("should always keep a consistent state", async () => {
            await lusd.setBalance(trader1.address, parseUnits("250000"))
            await lusd.connect(trader1).approve(userAccount.address, constants.MaxUint256)
            const traderAccount = userAccount.connect(trader1)

            const bnArb = fc.bigIntN(80).map(BigNumber.from)

            await fc.assert(fc.asyncProperty(bnArb, fc.boolean(), async (amount, isDeposit) => {
                const traderTokenBalance = await lusd.balanceOf(trader1.address);
                const accountTokenBalance = await lusd.balanceOf(userAccount.address);
                const traderWalletBalance = await traderAccount.wallet(trader1.address, lusd.address);

                if (isDeposit) {
                    const deposit = traderAccount.deposit(lusd.address, amount);
                    if (amount.lte(0)) {
                        await expect(deposit).to.eventually.be.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'UserAccount: can't deposit a negative amount'")
                    } else if (amount.gt(traderTokenBalance)) {
                        await expect(deposit).to.eventually.be.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'ERC20: transfer amount exceeds balance'")
                    } else {
                        await deposit
                        expect(await lusd.balanceOf(trader1.address)).to.be.eq(traderTokenBalance.sub(amount))
                        expect(await lusd.balanceOf(userAccount.address)).to.be.eq(accountTokenBalance.add(amount))
                        expect(await traderAccount.wallet(trader1.address, lusd.address)).to.be.eq(traderWalletBalance.add(amount))
                    }
                } else {
                    const withdraw = traderAccount.withdraw(lusd.address, amount);
                    if (amount.lte(0)) {
                        await expect(withdraw).to.eventually.be.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'UserAccount: can't withdraw a negative amount'")
                    } else if (amount.gt(traderWalletBalance)) {
                        await expect(withdraw).to.eventually.be.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'UserAccount: not enough balance'")
                    } else {
                        await withdraw
                        expect(await lusd.balanceOf(trader1.address)).to.be.eq(traderTokenBalance.add(amount))
                        expect(await lusd.balanceOf(userAccount.address)).to.be.eq(accountTokenBalance.sub(amount))
                        expect(await traderAccount.wallet(trader1.address, lusd.address)).to.be.eq(traderWalletBalance.sub(amount))
                    }
                }
            }), {endOnFailure: true, verbose: true})
        })
    })

    describe("Account positions", async () => {
        const price = parseUnits("2500");

        [[parseEther("2"), parseUnits("-5000")],
            [parseEther("-2"), parseUnits("5000")]].forEach(([quantity, cost]) => {

            it(`should only accept placing orders if the purchasing power is enough qty=${quantity}`, async () => {
                const traderAccount = userAccount.connect(trader1)
                await traderAccount.deposit(lusd.address, parseUnits("2000"));
                const future = await futureFactory.deploy(wethPool.address, lusdPool.address);
                await future.deployed()
                expect(future.address).to.properAddress
                await future.setSpot(price)

                await traderAccount.placeOrder(future.address, quantity, price, 5)

                expect(await traderAccount.noFills(trader1.address)).to.be.eq(1);
                let fill = await traderAccount.fills(trader1.address, 0);

                expect(fill.leverage).to.be.eq(5)
                expect(fill.openQuantity).to.be.eq(quantity)
                expect(fill.openCost).to.be.eq(cost)

                const position = await traderAccount.position(trader1.address, future.address);
                expect(position.quantity).to.be.eq(quantity)
                expect(position.cost).to.be.eq(cost)
                // Used margin so far 2 * 2500 / 5 = 1000
                expect(await traderAccount.purchasingPower(trader1.address, lusd.address)).to.be.eq(parseUnits("1000"))

                await traderAccount.placeOrder(future.address, quantity, price, 5)

                expect(await traderAccount.noFills(trader1.address)).to.be.eq(2);
                fill = await traderAccount.fills(trader1.address, 1);

                expect(fill.leverage).to.be.eq(5)
                expect(fill.openQuantity).to.be.eq(quantity)
                expect(fill.openCost).to.be.eq(cost)

                const position2 = await traderAccount.position(trader1.address, future.address);
                expect(position2.quantity).to.be.eq(quantity.mul(2))
                expect(position2.cost).to.be.eq(cost.mul(2))
                // Used margin so far (2+2) * 2500 / 5 = 2000
                expect(await traderAccount.purchasingPower(trader1.address, lusd.address)).to.be.eq(0)

                // Fails as the total margin required is (2+2+2) * 2500 / 5 = 3000
                return expect(traderAccount.placeOrder(future.address, quantity, price, 5))
                    .to.be.eventually.rejectedWith(Error, "UserAccount: not enough purchasing power")
            })
        });

        [
            [parseEther("2"), parseUnits("-5200"), parseUnits("140"), parseUnits("-1"), parseUnits("2400"), parseUnits("-2600"), parseUnits("420")],
            [parseEther("-2"), parseUnits("4800"), parseUnits("60"), parseUnits("1"), parseUnits("-2600"), parseUnits("2400"), parseUnits("380")]
        ].forEach(([openQty, openCost, purchasingPower, closeQty, closeCost, openCost2, purchasingPower2]) => {
            it(`should allow opposite orders if they'll reduce an existing position qty=${openQty}`, async () => {
                const traderAccount = userAccount.connect(trader1)
                const deposit = parseUnits("1100");
                await traderAccount.deposit(lusd.address, deposit);
                const future = await futureFactory.deploy(wethPool.address, lusdPool.address);
                await future.deployed()
                expect(future.address).to.properAddress
                await future.setBidRate(parseUnits("2400"))
                await future.setSpot(parseUnits("2500"))
                await future.setAskRate(parseUnits("2600"))

                let traderPrice = await (openQty.gt(0) ? future.askRate() : future.bidRate())
                await traderAccount.placeOrder(future.address, openQty, traderPrice, 5)
                expect(await traderAccount.wallet(trader1.address, lusd.address)).to.be.eq(deposit)

                expect(await traderAccount.noFills(trader1.address)).to.be.eq(1);
                let fill = await traderAccount.fills(trader1.address, 0);

                expect(fill.leverage).to.be.eq(5)
                expect(fill.openQuantity).to.be.eq(openQty)
                expect(fill.openCost).to.be.eq(openCost)
                expect(fill.closeQuantity).to.be.eq(0)
                expect(fill.closeCost).to.be.eq(0)

                let position = await traderAccount.position(trader1.address, future.address);
                expect(position.quantity).to.be.eq(openQty)
                expect(position.cost).to.be.eq(openCost)
                expect(await traderAccount.purchasingPower(trader1.address, lusd.address)).to.be.eq(purchasingPower)

                traderPrice = await (closeQty.gt(0) ? future.askRate() : future.bidRate())
                await traderAccount.placeOrder(future.address, closeQty, traderPrice, 5)

                expect(await traderAccount.noFills(trader1.address)).to.be.eq(1);
                fill = await traderAccount.fills(trader1.address, 0);

                expect(fill.leverage).to.be.eq(5)
                expect(fill.openQuantity).to.be.eq(openQty.add(closeQty))
                expect(fill.openCost).to.be.eq(openCost2)
                expect(fill.closeQuantity).to.be.eq(closeQty)
                expect(fill.closeCost).to.be.eq(closeCost)

                position = await traderAccount.position(trader1.address, future.address);
                expect(position.quantity).to.be.eq(fill.openQuantity)
                expect(position.cost).to.be.eq(fill.openCost)

                //PnL == 200
                expect(await traderAccount.wallet(trader1.address, lusd.address)).to.be.eq(parseUnits("900"))
                expect(await traderAccount.purchasingPower(trader1.address, lusd.address)).to.be.eq(purchasingPower2)
            })
        });

        [
            [parseEther("2"), parseUnits("-5200"), parseUnits("140"), parseUnits("-2")],
            [parseEther("-2"), parseUnits("4800"), parseUnits("60"), parseUnits("2")]
        ].forEach(([openQty, openCost, purchasingPower, closeQty]) => {
            it(`should allow opposite orders if they'll close an existing position qty=${openQty}`, async () => {
                const traderAccount = userAccount.connect(trader1)
                const deposit = parseUnits("1100");
                await traderAccount.deposit(lusd.address, deposit);
                const future = await futureFactory.deploy(wethPool.address, lusdPool.address);
                await future.deployed()
                expect(future.address).to.properAddress
                await future.setBidRate(parseUnits("2400"))
                await future.setSpot(parseUnits("2500"))
                await future.setAskRate(parseUnits("2600"))

                let traderPrice = await (openQty.gt(0) ? future.askRate() : future.bidRate())
                await traderAccount.placeOrder(future.address, openQty, traderPrice, 5)
                expect(await traderAccount.wallet(trader1.address, lusd.address)).to.be.eq(deposit)

                expect(await traderAccount.noFills(trader1.address)).to.be.eq(1);
                let fill = await traderAccount.fills(trader1.address, 0);

                expect(fill.leverage).to.be.eq(5)
                expect(fill.openQuantity).to.be.eq(openQty)
                expect(fill.openCost).to.be.eq(openCost)
                expect(fill.closeQuantity).to.be.eq(0)
                expect(fill.closeCost).to.be.eq(0)

                let position = await traderAccount.position(trader1.address, future.address);
                expect(position.quantity).to.be.eq(openQty)
                expect(position.cost).to.be.eq(openCost)
                expect(await traderAccount.purchasingPower(trader1.address, lusd.address)).to.be.eq(purchasingPower)

                traderPrice = await (closeQty.gt(0) ? future.askRate() : future.bidRate())
                await traderAccount.placeOrder(future.address, closeQty, traderPrice, 5)

                expect(await traderAccount.noFills(trader1.address)).to.be.eq(0);

                position = await traderAccount.position(trader1.address, future.address);
                expect(position.quantity).to.be.eq(0)
                expect(position.cost).to.be.eq(0)

                //PnL == 400
                expect(await traderAccount.wallet(trader1.address, lusd.address)).to.be.eq(parseUnits("700"))
                expect(await traderAccount.purchasingPower(trader1.address, lusd.address)).to.be.eq(parseUnits("700"))
            })
        });

        [
            [parseEther("2"), parseUnits("-5200"), parseUnits("140"), parseUnits("-1"), parseUnits("420")],
            [parseEther("-2"), parseUnits("4800"), parseUnits("60"), parseUnits("1"), parseUnits("380")]
        ].forEach(([openQty, openCost, purchasingPower, closeQty, purchasingPower2]) => {
            it(`can reduce position till it's closed qty=${openQty}`, async () => {
                const traderAccount = userAccount.connect(trader1)
                const deposit = parseUnits("1100");
                await traderAccount.deposit(lusd.address, deposit);
                const future = await futureFactory.deploy(wethPool.address, lusdPool.address);
                await future.deployed()
                expect(future.address).to.properAddress
                await future.setBidRate(parseUnits("2400"))
                await future.setSpot(parseUnits("2500"))
                await future.setAskRate(parseUnits("2600"))

                let traderPrice = await (openQty.gt(0) ? future.askRate() : future.bidRate())
                await traderAccount.placeOrder(future.address, openQty, traderPrice, 5)
                expect(await traderAccount.wallet(trader1.address, lusd.address)).to.be.eq(deposit)

                expect(await traderAccount.noFills(trader1.address)).to.be.eq(1);

                let position = await traderAccount.position(trader1.address, future.address);
                expect(position.quantity).to.be.eq(openQty)
                expect(position.cost).to.be.eq(openCost)
                expect(await traderAccount.purchasingPower(trader1.address, lusd.address)).to.be.eq(purchasingPower)

                traderPrice = await (closeQty.gt(0) ? future.askRate() : future.bidRate())
                await traderAccount.placeOrder(future.address, closeQty, traderPrice, 5)

                expect(await traderAccount.noFills(trader1.address)).to.be.eq(1);

                position = await traderAccount.position(trader1.address, future.address);
                expect(position.quantity).to.be.eq(openQty.div(2))
                expect(position.cost).to.be.eq(openCost.div(2))

                //PnL == 200
                expect(await traderAccount.wallet(trader1.address, lusd.address)).to.be.eq(parseUnits("900"))
                expect(await traderAccount.purchasingPower(trader1.address, lusd.address)).to.be.eq(purchasingPower2)

                await traderAccount.placeOrder(future.address, closeQty, traderPrice, 5)

                expect(await traderAccount.noFills(trader1.address)).to.be.eq(0);

                position = await traderAccount.position(trader1.address, future.address);
                expect(position.quantity).to.be.eq(0)
                expect(position.cost).to.be.eq(0)

                //PnL == 400
                expect(await traderAccount.wallet(trader1.address, lusd.address)).to.be.eq(parseUnits("700"))
                expect(await traderAccount.purchasingPower(trader1.address, lusd.address)).to.be.eq(parseUnits("700"))
            })
        });

        // TODO add test (and impl) for when close fill is bigger than the existent position

        [[parseUnits("2"), parseUnits("1040")],
            [parseUnits("-2"), parseUnits("960")]].forEach(([quantity, purchasingPower]) => {

            it(`should use mark to market to calculate purchasing power qty=${quantity}`, async () => {
                const traderAccount = userAccount.connect(trader1)
                const deposit = parseUnits("2000");
                await traderAccount.deposit(lusd.address, deposit);
                const future = await futureFactory.deploy(wethPool.address, lusdPool.address);
                await future.deployed()
                expect(future.address).to.properAddress
                await future.setBidRate(parseUnits("2400"))
                await future.setSpot(parseUnits("2500"))
                await future.setAskRate(parseUnits("2600"))

                const traderPrice = await (quantity.gt(0) ? future.askRate() : future.bidRate())

                expect(await traderAccount.purchasingPower(trader1.address, lusd.address)).to.be.eq(deposit)
                await traderAccount.placeOrder(future.address, quantity, traderPrice, 5)
                expect(await traderAccount.purchasingPower(trader1.address, lusd.address)).to.be.eq(purchasingPower)
            })
        });
    })
})

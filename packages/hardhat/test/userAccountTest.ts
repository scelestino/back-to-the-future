import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import {solidity} from "ethereum-waffle"
import {BigNumber, utils} from 'ethers'
import {ethers} from 'hardhat'
import {ERC20Stub, ERC20Stub__factory, UserAccount, UserAccount__factory, FutureStub__factory} from '../typechain'
import fc from 'fast-check';

chai.use(solidity).use(chaiAsPromised)
const {expect} = chai
const { parseUnits } = utils

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
            await lusd.setBalance(trader.address, utils.parseUnits("25000"))
            await lusd.connect(trader).approve(userAccount.address, utils.parseUnits("25000"))
        }
    })

    describe("Account wallets", async () => {
        it("should support trader deposits", async () => {
            const trader1Account = userAccount.connect(trader1)
            const trader2Account = userAccount.connect(trader2)

            // trader1 initial deposit
            await trader1Account.deposit(lusd.address, utils.parseUnits("1000"))

            expect(await lusd.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("24000"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("1000"))

            expect(await trader1Account.wallet(lusd.address)).to.be.eq(utils.parseUnits("1000"))

            // trader2 deposit
            await trader2Account.deposit(lusd.address, utils.parseUnits("9500"))

            expect(await lusd.balanceOf(trader2.address)).to.be.eq(utils.parseUnits("15500"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("10500"))

            expect(await trader2Account.wallet(lusd.address)).to.be.eq(utils.parseUnits("9500"))

            // subsequent trader1 deposit
            await trader1Account.deposit(lusd.address, utils.parseUnits("500"))

            expect(await lusd.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("23500"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("11000"))

            expect(await trader1Account.wallet(lusd.address)).to.be.eq(utils.parseUnits("1500"))
        })

        it("should support trader withdrawals", async () => {
            const traderAccount = userAccount.connect(trader1)
            const trader2Account = userAccount.connect(trader2)
            await traderAccount.deposit(lusd.address, utils.parseUnits("1000"))
            await trader2Account.deposit(lusd.address, utils.parseUnits("9500"))

            //first withdrawal
            await traderAccount.withdraw(lusd.address, utils.parseUnits("400"))

            expect(await lusd.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("24400"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("10100"))

            expect(await traderAccount.wallet(lusd.address)).to.be.eq(utils.parseUnits("600"))

            expect(await trader2Account.wallet(lusd.address)).to.be.eq(utils.parseUnits("9500"))

            //second withdrawal
            await traderAccount.withdraw(lusd.address, utils.parseUnits("100"))

            expect(await lusd.balanceOf(trader1.address)).to.be.eq(utils.parseUnits("24500"))
            expect(await lusd.balanceOf(userAccount.address)).to.be.eq(utils.parseUnits("10000"))

            expect(await traderAccount.wallet(lusd.address)).to.be.eq(utils.parseUnits("500"))

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

                if (isDeposit) {
                    const deposit = traderAccount.deposit(lusd.address, amount);
                    if (amount.gt(traderTokenBalance)) {
                        await expect(deposit).to.eventually.be.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'ERC20: transfer amount exceeds balance'")
                    } else {
                        await deposit
                        expect(await lusd.balanceOf(trader1.address)).to.be.eq(traderTokenBalance.sub(amount))
                        expect(await lusd.balanceOf(userAccount.address)).to.be.eq(accountTokenBalance.add(amount))
                        expect(await traderAccount.wallet(lusd.address)).to.be.eq(traderWalletBalance.add(amount))
                    }
                } else {
                    const withdraw = traderAccount.withdraw(lusd.address, amount);
                    if (amount.gt(traderWalletBalance)) {
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

    describe.only("Account positions", async () => {
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 3);
      const price = utils.parseUnits("2500");

      [[utils.parseUnits("2"), utils.parseUnits("-5000")],
          [utils.parseUnits("-2"), utils.parseUnits("5000")]].forEach(([quantity, cost]) => {

          it(`should only accept placing orders if the available margin is enough qty=${quantity}`, async () => {
              const traderAccount = userAccount.connect(trader1)
              await traderAccount.deposit(lusd.address, utils.parseUnits("2000"));
              const future = await futureFactory.deploy(weth.address, lusd.address, expiry.getMilliseconds());
              await future.deployed()
              expect(future.address).to.properAddress
              await future.setRate(2500)

              await traderAccount.placeOrder(future.address, quantity, price, 5)

              expect(await traderAccount.noFills(trader1.address)).to.be.eq(1);
              let fill = await traderAccount.fills(trader1.address, 0);

              expect(fill.leverage).to.be.eq(5)
              expect(fill.quantity).to.be.eq(quantity)
              expect(fill.cost).to.be.eq(cost)

              let position = await traderAccount.position(trader1.address, future.address);
              expect(position.quantity).to.be.eq(quantity)
              expect(position.cost).to.be.eq(cost)
              expect(position.future).to.be.eq(future.address)
              // Used margin so far 2 * 2500 / 5 = 1000
              expect(position.margin).to.be.eq(utils.parseUnits("1000"))

              await traderAccount.placeOrder(future.address, quantity, price, 5)

              expect(await traderAccount.noFills(trader1.address)).to.be.eq(2);
              fill = await traderAccount.fills(trader1.address, 1);

              expect(fill.leverage).to.be.eq(5)
              expect(fill.quantity).to.be.eq(quantity)
              expect(fill.cost).to.be.eq(cost)

              position = await traderAccount.position(trader1.address, future.address);
              expect(position.quantity).to.be.eq(quantity.mul(2))
              expect(position.cost).to.be.eq(cost.mul(2))
              expect(position.future).to.be.eq(future.address)
              // Used margin so far (2+2) * 2500 / 5 = 2000
              expect(position.margin).to.be.eq(utils.parseUnits("2000"))

              // Fails as the total margin required is (2+2+2) * 2500 / 5 = 3000
              return expect(traderAccount.placeOrder(future.address, quantity, price, 5))
                  .to.be.eventually.rejectedWith(Error, "UserAccount: not enough available margin")
          })
      });

    [[parseUnits("2"), parseUnits("-5000"), parseUnits("-1"), parseUnits("2500")],
      [parseUnits("-2"), parseUnits("5000"), parseUnits("1"), parseUnits("-2500")]].forEach(([quantity, cost, quantity2, cost2]) => {

      it(`should allow opposite orders if they'll reduce an existing position qty=${quantity}`, async () => {
          const traderAccount = userAccount.connect(trader1)
          await traderAccount.deposit(lusd.address, parseUnits("1000"));
          const future = await futureFactory.deploy(weth.address, lusd.address, expiry.getMilliseconds());
          await future.deployed()
          expect(future.address).to.properAddress
          await future.setRate(2500)

          await traderAccount.placeOrder(future.address, quantity, price, 5)

          expect(await traderAccount.noFills(trader1.address)).to.be.eq(1);
          let fill = await traderAccount.fills(trader1.address, 0);

          expect(fill.leverage).to.be.eq(5)
          expect(fill.quantity).to.be.eq(quantity)
          expect(fill.cost).to.be.eq(cost)

          let position = await traderAccount.position(trader1.address, future.address);
          expect(position.quantity).to.be.eq(quantity)
          expect(position.cost).to.be.eq(cost)
          expect(position.future).to.be.eq(future.address)
          // Used margin so far 2 * 2500 / 5 = 1000
          expect(position.margin).to.be.eq(parseUnits("1000"))

          await traderAccount.placeOrder(future.address, quantity2, price, 5)

          expect(await traderAccount.noFills(trader1.address)).to.be.eq(2);
          fill = await traderAccount.fills(trader1.address, 1);

          expect(fill.leverage).to.be.eq(5)
          expect(fill.quantity).to.be.eq(quantity2)
          expect(fill.cost).to.be.eq(cost2)

          position = await traderAccount.position(trader1.address, future.address);
          expect(position.quantity).to.be.eq(quantity.div(2))
          expect(position.cost).to.be.eq(cost.add(cost2))
          expect(position.future).to.be.eq(future.address)
          // Used margin so far 1 * 2500 / 5 = 500
          expect(position.margin).to.be.eq(parseUnits("500"))
      })
    });
  })
})

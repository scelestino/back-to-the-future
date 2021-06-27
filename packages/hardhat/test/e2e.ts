import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import {solidity} from "ethereum-waffle"
import {constants, utils} from 'ethers'
import {ethers, network} from 'hardhat'
import {config as dotEnvConfig} from "dotenv";
import {
    Future,
    Future__factory,
    IERC20,
    IERC20__factory,
    IWETH9,
    IWETH9__factory,
    Pool,
    Pool__factory,
    TestSwapRouter__factory,
    UserAccount,
    UserAccount__factory
} from '../typechain'

chai.use(solidity).use(chaiAsPromised)
const {expect} = chai
const {parseEther, parseUnits} = utils

dotEnvConfig();
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";

const uniswapFactory = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const uniswapRouter = '0xE592427A0AEce92De3Edee1F18E0157C05861564'
const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

describe("E2E", async () => {
    let deployer: SignerWithAddress
    let lender: SignerWithAddress
    let trader1: SignerWithAddress
    let future: Future
    let usdt: IERC20;
    let weth: IWETH9;
    let usdtPool: Pool;
    let wethPool: Pool;
    let userAccount: UserAccount

    beforeEach(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
                    blockNumber: 12628614
                }
            }]
        })

        const signers = await ethers.getSigners()
        deployer = signers[0]
        trader1 = signers[2]
        lender = signers[5]
        const poolFactory = (await ethers.getContractFactory('Pool', deployer)) as Pool__factory

        //Lend 10 WETH to the WETH pool
        weth = IWETH9__factory.connect(wethAddress, deployer)
        await weth.connect(lender).deposit({value: parseEther("100")})
        expect(await weth.balanceOf(lender.address)).to.be.eq(parseEther("100"))
        wethPool = await poolFactory.deploy(weth.address)
        await wethPool.deployed()
        await weth.connect(lender).approve(wethPool.address, constants.MaxUint256)
        await wethPool.connect(lender).deposit(parseUnits("10"))
        expect(await weth.balanceOf(wethPool.address)).to.be.eq(parseEther("10"))

        usdt = IERC20__factory.connect(usdtAddress, deployer)
        const swapRouter = TestSwapRouter__factory.connect(uniswapRouter, deployer)

        // Buy ~25k USDT and lend it to the USDT pool
        await weth.connect(lender).approve(swapRouter.address, constants.MaxUint256)
        const _25k = parseUnits("25000", 6);
        await swapRouter.connect(lender).exactInputSingle({
            tokenIn: weth.address,
            tokenOut: usdt.address,
            fee: 500,
            recipient: lender.address,
            deadline: constants.MaxUint256,
            amountIn: parseEther("10"),
            amountOutMinimum: _25k,
            sqrtPriceLimitX96: 0
        })
        expect(await usdt.balanceOf(lender.address)).to.be.gte(_25k)
        usdtPool = await poolFactory.deploy(usdt.address)
        await usdtPool.deployed()
        await usdt.connect(lender).approve(usdtPool.address, constants.MaxUint256)
        await usdtPool.connect(lender).deposit(_25k)
        expect(await usdt.balanceOf(usdtPool.address)).to.be.eq(_25k)

        //Buy ~2.5k USDT for trader1
        await weth.connect(trader1).deposit({value: parseEther("100")})
        await weth.connect(trader1).approve(swapRouter.address, constants.MaxUint256)
        await swapRouter.connect(trader1).exactInputSingle({
            tokenIn: weth.address,
            tokenOut: usdt.address,
            fee: 500,
            recipient: trader1.address,
            deadline: constants.MaxUint256,
            amountIn: parseEther("1"),
            amountOutMinimum: parseUnits("2500", 6),
            sqrtPriceLimitX96: 0
        })
        expect(await usdt.balanceOf(trader1.address)).to.be.gte(parseUnits("2500", 6))

        //Deploy a WETH/USDT Future
        const futureFactory = (await ethers.getContractFactory('Future', deployer)) as Future__factory
        future = await futureFactory.deploy(wethPool.address, usdtPool.address, 500, uniswapFactory)
        await future.deployed()
        expect(future.address).to.properAddress

        //Deploy the UserAccount contract
        const userAccountFactory = (await ethers.getContractFactory('UserAccount', deployer)) as UserAccount__factory
        userAccount = await userAccountFactory.deploy()
        await userAccount.deployed()
        expect(userAccount.address).to.properAddress
    })

    describe("Users can trade", async () => {

        [
            [parseEther("2"), parseUnits("-5072.628169", 6), parseUnits("1007.532638", 6)],
            [parseEther("-2"), parseUnits("5065.001132", 6), parseUnits("953.817850", 6)]
        ]
            .forEach(([quantity, expectedCost, purchasingPower]) => {
                const isLong = quantity.gt(0);
                it(`trader goes ${isLong ? "long" : "short"}`, async () => {
                    const initialUsdtHoldings = await usdt.balanceOf(usdtPool.address);
                    const initialWethHoldings = await weth.balanceOf(wethPool.address);

                    const traderAccount = userAccount.connect(trader1)
                    await usdt.connect(trader1).approve(traderAccount.address, constants.MaxUint256)
                    const deposit = parseUnits("2000", 6);
                    await traderAccount.deposit(usdt.address, deposit);

                    const futurePrice = await (isLong ? future.ask() : future.bid())
                    const expectedFuturePrice = isLong ? parseUnits("2616.774573", 6) : parseUnits("2479.916631", 6)
                    expect(futurePrice).to.be.eq(expectedFuturePrice)

                    expect(await traderAccount.purchasingPower(trader1.address, usdt.address)).to.be.eq(deposit)
                    await traderAccount.placeOrder(future.address, quantity, futurePrice, 5)
                    expect(await traderAccount.purchasingPower(trader1.address, usdt.address)).to.be.eq(purchasingPower)

                    expect(await traderAccount.noFills(trader1.address)).to.be.eq(1);
                    const fill = await traderAccount.fills(trader1.address, 0);

                    expect(fill.leverage).to.be.eq(5)
                    expect(fill.quantity).to.be.eq(quantity)
                    expect(fill.cost).to.be.eq(expectedCost)

                    const position = await traderAccount.position(trader1.address, future.address);
                    expect(position.quantity).to.be.eq(quantity)
                    expect(position.cost).to.be.eq(expectedCost)

                    expect(await usdt.balanceOf(usdtPool.address)).to.be.eq(initialUsdtHoldings.add(expectedCost))
                    expect(await weth.balanceOf(wethPool.address)).to.be.eq(initialWethHoldings.add(quantity))

                    const futurePrice2 = await (isLong ? future.ask() : future.bid())
                    const expectedFuturePrice2 = isLong ? parseUnits("2618.095430", 6) : parseUnits("2478.666427", 6)
                    expect(futurePrice2).to.be.eq(expectedFuturePrice2)

                    return expect(traderAccount.placeOrder(future.address, quantity, futurePrice2, 5))
                        .to.be.eventually.rejectedWith(Error, "UserAccount: not enough purchasing power")
                })
            });
    })
})

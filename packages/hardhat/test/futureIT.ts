import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import {solidity} from "ethereum-waffle"
import {constants, utils} from 'ethers'
import {ethers, network} from 'hardhat'
import {
    Future,
    Future__factory,
    IERC20,
    IERC20__factory,
    IWETH9,
    IWETH9__factory,
    Pool,
    Pool__factory,
    TestSwapRouter__factory
} from '../typechain'
import {config as dotEnvConfig} from "dotenv";

chai.use(solidity).use(chaiAsPromised)
const {expect} = chai

dotEnvConfig();
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";

const uniswapFactory = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const uniswapRouter = '0xE592427A0AEce92De3Edee1F18E0157C05861564'
const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'

describe("Futures", async () => {

    describe("Future base/quote, pair quote/base", async () => {
        const daiAddress = '0x6b175474e89094c44da98b954eedeac495271d0f'

        let owner: SignerWithAddress
        let lender: SignerWithAddress
        let future: Future
        let dai: IERC20;
        let weth: IWETH9;
        let daiPool: Pool;
        let wethPool: Pool;

        before(async () => {
            await network.provider.request({
                method: "hardhat_reset",
                params: [{
                    forking: {
                        jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
                        blockNumber: 12628614
                    }
                }]
            })

            /* before tests */
            const signers = await ethers.getSigners()
            owner = signers[0]
            lender = signers[4]
            const poolFactory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory

            weth = IWETH9__factory.connect(wethAddress, lender)
            await weth.deposit({value: utils.parseEther("100")})
            expect(await weth.balanceOf(lender.address)).to.be.eq(utils.parseEther("100"))
            wethPool = await poolFactory.deploy(weth.address, 0,0,0,0)
            await wethPool.deployed()
            await weth.connect(lender).approve(wethPool.address, constants.MaxUint256)
            await wethPool.connect(lender).deposit(utils.parseUnits("10"))
            expect(await weth.balanceOf(wethPool.address)).to.be.eq(utils.parseEther("10"))

            dai = IERC20__factory.connect(daiAddress, lender)
            const swapRouter = TestSwapRouter__factory.connect(uniswapRouter, lender)
            await weth.connect(lender).approve(swapRouter.address, constants.MaxUint256)
            await swapRouter.exactInputSingle({
                tokenIn: weth.address,
                tokenOut: dai.address,
                fee: 500,
                recipient: lender.address,
                deadline: constants.MaxUint256,
                amountIn: utils.parseEther("10"),
                amountOutMinimum: utils.parseUnits("25000"),
                sqrtPriceLimitX96: 0
            })
            expect(await dai.balanceOf(lender.address)).to.be.gte(utils.parseUnits("25000"))
            daiPool = await poolFactory.deploy(dai.address, 0,0,0,0)
            await daiPool.deployed()
            await dai.connect(lender).approve(daiPool.address, constants.MaxUint256)
            await daiPool.connect(lender).deposit(utils.parseUnits("25000"))
            expect(await dai.balanceOf(daiPool.address)).to.be.eq(utils.parseUnits("25000"))

            const futureFactory = (await ethers.getContractFactory('Future', owner)) as Future__factory
            future = await futureFactory.deploy(wethPool.address, daiPool.address, 500, uniswapFactory)
            await future.deployed()
            expect(future.address).to.properAddress
        })

        describe("Futures can be priced", async () => {
            it("can compute the spot price", async () => {
                expect(await future.askQty()).to.be.eq(utils.parseUnits("9.575309008168353510"))
                expect(await future.askRate()).to.be.eq(utils.parseUnits("2610.881798036323892886"))
                expect(await future.spot()).to.be.eq(utils.parseUnits("2528.699078001282220713"))
                expect(await future.bidQty()).to.be.eq(utils.parseUnits("10"))
                expect(await future.bidRate()).to.be.eq(utils.parseUnits("2474.332047824254652968"))
            })
        });

        describe("Futures can be traded", async () => {
            it("can go long", async () => {
                const initialDaiHoldings = await dai.balanceOf(daiPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                const price = utils.parseUnits("2531");
                const quantity = utils.parseEther("1");

                await future.long(quantity, price)

                expect(await weth.balanceOf(wethPool.address)).to.be.eq(initialWethHoldings.add(quantity))
                expect(await dai.balanceOf(daiPool.address)).to.be.lt(initialDaiHoldings)
            })

            it("can go short", async () => {
                const initialDaiHoldings = await dai.balanceOf(daiPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                const price = utils.parseUnits("2525");
                const quantity = utils.parseEther("-1");

                await future.short(quantity, price)

                expect(await weth.balanceOf(wethPool.address)).to.be.eq(initialWethHoldings.add(quantity))
                expect(await dai.balanceOf(daiPool.address)).to.be.gt(initialDaiHoldings)
            })
        })
    })

    describe("Future base/quote, pair base/quote", async () => {
        const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

        let owner: SignerWithAddress
        let lender: SignerWithAddress
        let future: Future
        let usdt: IERC20;
        let weth: IWETH9;
        let usdtPool: Pool;
        let wethPool: Pool;

        before(async () => {
            await network.provider.request({
                method: "hardhat_reset",
                params: [{
                    forking: {
                        jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
                        blockNumber: 12628614
                    }
                }]
            })

            /* before tests */
            const signers = await ethers.getSigners()
            owner = signers[0]
            lender = signers[5]
            const poolFactory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory

            weth = IWETH9__factory.connect(wethAddress, lender)
            await weth.deposit({value: utils.parseEther("100")})
            expect(await weth.balanceOf(lender.address)).to.be.eq(utils.parseEther("100"))
            wethPool = await poolFactory.deploy(weth.address, 0,0,0,0)
            await wethPool.deployed()
            await weth.connect(lender).approve(wethPool.address, constants.MaxUint256)
            await wethPool.connect(lender).deposit(utils.parseUnits("10"))
            expect(await weth.balanceOf(wethPool.address)).to.be.eq(utils.parseEther("10"))

            usdt = IERC20__factory.connect(usdtAddress, lender)
            const swapRouter = TestSwapRouter__factory.connect(uniswapRouter, lender)
            await weth.connect(lender).approve(swapRouter.address, constants.MaxUint256)
            await swapRouter.exactInputSingle({
                tokenIn: weth.address,
                tokenOut: usdt.address,
                fee: 500,
                recipient: lender.address,
                deadline: constants.MaxUint256,
                amountIn: utils.parseEther("10"),
                amountOutMinimum: utils.parseUnits("25000", 6),
                sqrtPriceLimitX96: 0
            })
            expect(await usdt.balanceOf(lender.address)).to.be.gte(utils.parseUnits("25000", 6))
            usdtPool = await poolFactory.deploy(usdt.address, 0,0,0,0)
            await usdtPool.deployed()
            await usdt.connect(lender).approve(usdtPool.address, constants.MaxUint256)
            await usdtPool.connect(lender).deposit(utils.parseUnits("25000", 6))
            expect(await usdt.balanceOf(usdtPool.address)).to.be.eq(utils.parseUnits("25000", 6))

            const futureFactory = (await ethers.getContractFactory('Future', owner)) as Future__factory
            future = await futureFactory.deploy(wethPool.address, usdtPool.address, 500, uniswapFactory)
            await future.deployed()
            expect(future.address).to.properAddress
        })

        describe("Futures can be priced", async () => {
            it("can compute the spot price", async () => {
                expect(await future.askQty()).to.be.eq(utils.parseUnits("9.551337219952777378"))
                expect(await future.askRate()).to.be.eq(utils.parseUnits("2617.434546", 6))
                expect(await future.spot()).to.be.eq(utils.parseUnits("2535.045566", 6))
                expect(await future.bidQty()).to.be.eq(utils.parseUnits("10"))
                expect(await future.bidRate()).to.be.eq(utils.parseUnits("2480.542087", 6))
            })
        });

        describe("Futures can be traded", async () => {
            it("can go long", async () => {
                const initialUsdtHoldings = await usdt.balanceOf(usdtPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                const price = utils.parseUnits("2537", 6);
                const quantity = utils.parseEther("1");

                await future.long(quantity, price)

                expect(await weth.balanceOf(wethPool.address)).to.be.eq(initialWethHoldings.add(quantity))
                expect(await usdt.balanceOf(usdtPool.address)).to.be.lt(initialUsdtHoldings)
            })

            it("can go short", async () => {
                const initialUsdtHoldings = await usdt.balanceOf(usdtPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                const price = utils.parseUnits("2533", 6);
                const quantity = utils.parseEther("-1");

                await future.short(quantity, price)

                expect(await weth.balanceOf(wethPool.address)).to.be.eq(initialWethHoldings.add(quantity))
                expect(await usdt.balanceOf(usdtPool.address)).to.be.gt(initialUsdtHoldings)
            })
        })
    })
})

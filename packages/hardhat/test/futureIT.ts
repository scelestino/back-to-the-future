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
    ISwapRouter__factory
} from '../typechain'
import {config as dotEnvConfig} from "dotenv";

chai.use(solidity).use(chaiAsPromised)
const {expect} = chai
const {parseUnits} = utils


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

            /* before tests */
            const signers = await ethers.getSigners()
            owner = signers[0]
            lender = signers[4]
            const poolFactory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory

            weth = IWETH9__factory.connect(wethAddress, lender)
            await weth.deposit({value: utils.parseEther("100")})
            expect(await weth.balanceOf(lender.address)).to.be.eq(utils.parseEther("100"))
            wethPool = await poolFactory.deploy(weth.address, parseUnits("0.65"), 0, parseUnits("0.08"), parseUnits("1"))
            await wethPool.deployed()
            await weth.connect(lender).approve(wethPool.address, constants.MaxUint256)
            await wethPool.connect(lender).deposit(parseUnits("10"))
            expect(await weth.balanceOf(wethPool.address)).to.be.eq(utils.parseEther("10"))

            dai = IERC20__factory.connect(daiAddress, lender)
            const swapRouter = ISwapRouter__factory.connect(uniswapRouter, lender)
            await weth.connect(lender).approve(swapRouter.address, constants.MaxUint256)
            await swapRouter.exactInputSingle({
                tokenIn: weth.address,
                tokenOut: dai.address,
                fee: 500,
                recipient: lender.address,
                deadline: constants.MaxUint256,
                amountIn: utils.parseEther("10"),
                amountOutMinimum: parseUnits("25000"),
                sqrtPriceLimitX96: 0
            })
            expect(await dai.balanceOf(lender.address)).to.be.gte(parseUnits("25000"))
            daiPool = await poolFactory.deploy(dai.address, parseUnits("0.8"), 0, parseUnits("0.04"), parseUnits("0.75"))
            await daiPool.deployed()
            await dai.connect(lender).approve(daiPool.address, constants.MaxUint256)
            await daiPool.connect(lender).deposit(parseUnits("25000"))
            expect(await dai.balanceOf(daiPool.address)).to.be.eq(parseUnits("25000"))

            const futureFactory = (await ethers.getContractFactory('Future', owner)) as Future__factory
            future = await futureFactory.deploy(wethPool.address, daiPool.address, 500, uniswapFactory)
            await future.deployed()
            expect(future.address).to.properAddress
        })

        describe("Futures can be priced", async () => {
            it("can compute the prices and liquidity", async () => {
                await wethPool.borrow(parseUnits("1"), uniswapRouter)
                expect(await wethPool.borrowingRate()).to.be.eq(parseUnits("0.012307692307692307"))
                await daiPool.borrow(parseUnits("6250"), uniswapRouter)
                expect(await daiPool.borrowingRate()).to.be.eq(parseUnits("0.0125"))

                expect(await future.askQty()).to.be.eq(parseUnits("7.408534273953079204"))
                expect(await future.askRate()).to.be.eq(parseUnits("2530.864987143440756470"))
                expect(await future.spot()).to.be.eq(parseUnits("2528.699078001282220713"))
                expect(await future.bidQty()).to.be.eq(parseUnits("9"))
                expect(await future.bidRate()).to.be.eq(parseUnits("2526.568301571271227325"))
            })

            it("can quote the prices and liquidity", async () => {
                expect(await wethPool.borrowingRateAfterLoan(parseUnits("1"))).to.be.eq(parseUnits("0.012307692307692307"))
                expect(await daiPool.borrowingRateAfterLoan(parseUnits("7605.136698"))).to.be.eq(parseUnits("0.015210273396"))

                expect(await future.askQty()).to.be.eq(parseUnits("9.886506550933825000"))
                expect(await future.quoteAskRate(parseUnits("3"))).to.be.eq(parseUnits("2531.328246209070503319"))
                expect(await future.spot()).to.be.eq(parseUnits("2528.699078001282220713"))
                expect(await future.bidQty()).to.be.eq(parseUnits("10"))
                expect(await future.quoteBidRate(parseUnits("1"))).to.be.eq(parseUnits("2526.568301571271227325"))
            })
        });

        describe("Futures can be traded", async () => {
            it("can go long", async () => {
                await daiPool.borrow(parseUnits("6250", 6), uniswapRouter)
                const initialDaiHoldings = await dai.balanceOf(daiPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                const price = parseUnits("2543");
                const quantity = utils.parseEther("1");

                await future.long(quantity, price)

                expect(await weth.balanceOf(wethPool.address)).to.be.eq(initialWethHoldings.add(quantity))
                expect(await dai.balanceOf(daiPool.address)).to.be.lt(initialDaiHoldings)
            })

            it("can go short", async () => {
                await wethPool.borrow(parseUnits("1"), uniswapRouter)
                const initialDaiHoldings = await dai.balanceOf(daiPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                const price = parseUnits("2496");
                const quantity = utils.parseEther("1");

                await future.short(quantity, price)

                expect(await weth.balanceOf(wethPool.address)).to.be.gt(initialWethHoldings.sub(quantity))
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

            /* before tests */
            const signers = await ethers.getSigners()
            owner = signers[0]
            lender = signers[5]
            const poolFactory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory

            weth = IWETH9__factory.connect(wethAddress, lender)
            await weth.deposit({value: utils.parseEther("100")})
            expect(await weth.balanceOf(lender.address)).to.be.eq(utils.parseEther("100"))
            wethPool = await poolFactory.deploy(weth.address, parseUnits("0.65"), 0, parseUnits("0.08"), parseUnits("1"))
            await wethPool.deployed()
            await weth.connect(lender).approve(wethPool.address, constants.MaxUint256)
            await wethPool.connect(lender).deposit(parseUnits("10"))
            expect(await weth.balanceOf(wethPool.address)).to.be.eq(utils.parseEther("10"))

            usdt = IERC20__factory.connect(usdtAddress, lender)
            const swapRouter = ISwapRouter__factory.connect(uniswapRouter, lender)
            await weth.connect(lender).approve(swapRouter.address, constants.MaxUint256)
            await swapRouter.exactInputSingle({
                tokenIn: weth.address,
                tokenOut: usdt.address,
                fee: 500,
                recipient: lender.address,
                deadline: constants.MaxUint256,
                amountIn: utils.parseEther("10"),
                amountOutMinimum: parseUnits("25000", 6),
                sqrtPriceLimitX96: 0
            })
            expect(await usdt.balanceOf(lender.address)).to.be.gte(parseUnits("25000", 6))
            usdtPool = await poolFactory.deploy(usdt.address, parseUnits("0.8"), 0, parseUnits("0.04"), parseUnits("0.75"))
            await usdtPool.deployed()
            await usdt.connect(lender).approve(usdtPool.address, constants.MaxUint256)
            await usdtPool.connect(lender).deposit(parseUnits("25000", 6))
            expect(await usdt.balanceOf(usdtPool.address)).to.be.eq(parseUnits("25000", 6))

            const futureFactory = (await ethers.getContractFactory('Future', owner)) as Future__factory
            future = await futureFactory.deploy(wethPool.address, usdtPool.address, 500, uniswapFactory)
            await future.deployed()
            expect(future.address).to.properAddress
        })

        describe("Futures can be priced", async () => {
            it("can compute the prices and liquidity", async () => {
                await wethPool.borrow(parseUnits("1"), uniswapRouter)
                expect(await wethPool.borrowingRate()).to.be.eq(parseUnits("0.012307692307692307"))
                await usdtPool.borrow(parseUnits("6250", 6), uniswapRouter)
                expect(await usdtPool.borrowingRate()).to.be.eq(parseUnits("0.0125"))

                expect(await future.askQty()).to.be.eq(parseUnits("7.389987004544287463"))
                expect(await future.askRate()).to.be.eq(parseUnits("2537.216911", 6))
                expect(await future.spot()).to.be.eq(parseUnits("2535.045566", 6))
                expect(await future.bidQty()).to.be.eq(parseUnits("9"))
                expect(await future.bidRate()).to.be.eq(parseUnits("2532.909442", 6))
            })

            it("can quote the prices and liquidity", async () => {
                expect(await wethPool.borrowingRateAfterLoan(parseUnits("1"))).to.be.eq(parseUnits("0.012307692307692307"))
                expect(await usdtPool.borrowingRateAfterLoan(parseUnits("7605.136698", 6))).to.be.eq(parseUnits("0.015210273396"))

                expect(await future.askQty()).to.be.eq(parseUnits("9.861755676229134888"))
                expect(await future.quoteAskRate(parseUnits("3"))).to.be.eq(parseUnits("2537.687952", 6))
                expect(await future.spot()).to.be.eq(parseUnits("2535.045566", 6))
                expect(await future.bidQty()).to.be.eq(parseUnits("10"))
                expect(await future.quoteBidRate(parseUnits("1"))).to.be.eq(parseUnits("2532.909442", 6))
            })
        });

        describe("Futures can be traded", async () => {
            it("can go long", async () => {
                await usdtPool.borrow(parseUnits("6250", 6), uniswapRouter)
                const initialUsdtHoldings = await usdt.balanceOf(usdtPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                const price = parseUnits("2582", 6);
                const quantity = utils.parseEther("1");

                await future.long(quantity, price)

                expect(await weth.balanceOf(wethPool.address)).to.be.eq(initialWethHoldings.add(quantity))
                expect(await usdt.balanceOf(usdtPool.address)).to.be.lt(initialUsdtHoldings)
            })

            it("can go short", async () => {
                await wethPool.borrow(parseUnits("1"), uniswapRouter)
                const initialUsdtHoldings = await usdt.balanceOf(usdtPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                const price = parseUnits("2500", 6);
                const quantity = utils.parseEther("1");

                await future.short(quantity, price)

                expect(await weth.balanceOf(wethPool.address)).to.be.gt(initialWethHoldings.sub(quantity))
                expect(await usdt.balanceOf(usdtPool.address)).to.be.gt(initialUsdtHoldings)
            })
        })
    })
})

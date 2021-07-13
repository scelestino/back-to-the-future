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
    ISwapRouter__factory,
    IWETH9,
    IWETH9__factory,
    Pool,
    Pool__factory
} from '../typechain'
import {config as dotEnvConfig} from "dotenv";

chai.use(solidity).use(chaiAsPromised)
const {expect} = chai
const {parseUnits, parseEther} = utils


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
                        blockNumber: 12760720
                    }
                }]
            })

            /* before tests */
            const signers = await ethers.getSigners()
            owner = signers[0]
            lender = signers[4]
            const poolFactory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory

            weth = IWETH9__factory.connect(wethAddress, lender)
            await weth.deposit({value: parseEther("100")})
            expect(await weth.balanceOf(lender.address)).to.be.eq(parseEther("100"))
            wethPool = await poolFactory.deploy(weth.address, parseUnits("0.65"), 0, parseUnits("0.08"), parseUnits("1"))
            await wethPool.deployed()
            await weth.connect(lender).approve(wethPool.address, constants.MaxUint256)
            await wethPool.connect(lender).deposit(parseUnits("10"))
            expect(await weth.balanceOf(wethPool.address)).to.be.eq(parseEther("10"))

            dai = IERC20__factory.connect(daiAddress, lender)
            const swapRouter = ISwapRouter__factory.connect(uniswapRouter, lender)
            await weth.connect(lender).approve(swapRouter.address, constants.MaxUint256)
            const _20k = parseUnits("20000");
            await swapRouter.exactInputSingle({
                tokenIn: weth.address,
                tokenOut: dai.address,
                fee: 500,
                recipient: lender.address,
                deadline: constants.MaxUint256,
                amountIn: parseEther("10"),
                amountOutMinimum: _20k,
                sqrtPriceLimitX96: 0
            })
            expect(await dai.balanceOf(lender.address)).to.be.gte(_20k)
            daiPool = await poolFactory.deploy(dai.address, parseUnits("0.8"), 0, parseUnits("0.04"), parseUnits("0.75"))
            await daiPool.deployed()
            await dai.connect(lender).approve(daiPool.address, constants.MaxUint256)
            await daiPool.connect(lender).deposit(_20k)
            expect(await dai.balanceOf(daiPool.address)).to.be.eq(_20k)

            const futureFactory = (await ethers.getContractFactory('Future', owner)) as Future__factory
            future = await futureFactory.deploy(wethPool.address, daiPool.address, 500, uniswapFactory)
            await future.deployed()
            expect(future.address).to.properAddress
        })

        describe("Futures can be priced", async () => {
            it("can compute the prices and liquidity", async () => {
                await wethPool.borrow(parseUnits("1"), uniswapRouter)
                expect(await wethPool.borrowingRate()).to.be.eq(parseUnits("0.012307692307692307"))
                await daiPool.borrow(parseUnits("5000"), uniswapRouter)
                expect(await daiPool.borrowingRate()).to.be.eq(parseUnits("0.0125"))

                expect(await future.askQty()).to.be.eq(parseUnits("6.448989152197766619"))
                expect(await future.askRate()).to.be.eq(parseUnits("2325.945918964387419000"))
                expect(await future.spot()).to.be.eq(parseUnits("2325.627318058240253367"))
                expect(await future.bidQty()).to.be.eq(parseUnits("9"))
                expect(await future.bidRate()).to.be.eq(parseUnits("2325.313661343561170365"))
            })

            it("can quote the prices and liquidity", async () => {
                expect(await wethPool.borrowingRateAfterLoan(parseUnits("1"))).to.be.eq(parseUnits("0.012307692307692307"))
                expect(await daiPool.borrowingRateAfterLoan(parseUnits("6976.8819"))).to.be.eq(parseUnits("0.01744220475"))

                expect(await future.askQty()).to.be.eq(parseUnits("8.599830181174"))
                expect(await future.quoteAskRate(parseUnits("3"))).to.be.eq(parseUnits("2326.071898280430738856"))
                expect(await future.spot()).to.be.eq(parseUnits("2325.627318058240253367"))
                expect(await future.bidQty()).to.be.eq(parseUnits("10"))
                expect(await future.quoteBidRate(parseUnits("1"))).to.be.eq(parseUnits("2325.313661343561170365"))
            })
        });

        describe("Futures can be traded", async () => {
            const quantity = parseEther("1");

            it("can go long", async () => {
                await daiPool.borrow(parseUnits("6250", 6), uniswapRouter)
                const initialDaiHoldings = await dai.balanceOf(daiPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                await future.long(quantity, parseUnits("2337.404379"))

                expect(await weth.balanceOf(wethPool.address)).to.be.eq(initialWethHoldings.add(quantity))
                expect(await dai.balanceOf(daiPool.address)).to.be.lt(initialDaiHoldings)
            })

            it("can go short", async () => {
                await wethPool.borrow(parseUnits("1"), uniswapRouter)
                const initialDaiHoldings = await dai.balanceOf(daiPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                await future.short(quantity, parseUnits("2313.375046"))

                //In this case we spend more than 1 ETH to hedge, check how this affects settlement later
                //this was not the case with longer maturity dates (we are now 6 days off from expiry)
                expect(await weth.balanceOf(wethPool.address)).to.be.lt(initialWethHoldings.sub(quantity))
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
                        blockNumber: 12760720
                    }
                }]
            })

            /* before tests */
            const signers = await ethers.getSigners()
            owner = signers[0]
            lender = signers[5]
            const poolFactory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory

            weth = IWETH9__factory.connect(wethAddress, lender)
            await weth.deposit({value: parseEther("100")})
            expect(await weth.balanceOf(lender.address)).to.be.eq(parseEther("100"))
            wethPool = await poolFactory.deploy(weth.address, parseUnits("0.65"), 0, parseUnits("0.08"), parseUnits("1"))
            await wethPool.deployed()
            await weth.connect(lender).approve(wethPool.address, constants.MaxUint256)
            await wethPool.connect(lender).deposit(parseUnits("10"))
            expect(await weth.balanceOf(wethPool.address)).to.be.eq(parseEther("10"))

            usdt = IERC20__factory.connect(usdtAddress, lender)
            const swapRouter = ISwapRouter__factory.connect(uniswapRouter, lender)
            await weth.connect(lender).approve(swapRouter.address, constants.MaxUint256)
            await swapRouter.exactInputSingle({
                tokenIn: weth.address,
                tokenOut: usdt.address,
                fee: 500,
                recipient: lender.address,
                deadline: constants.MaxUint256,
                amountIn: parseEther("10"),
                amountOutMinimum: parseUnits("20000", 6),
                sqrtPriceLimitX96: 0
            })
            expect(await usdt.balanceOf(lender.address)).to.be.gte(parseUnits("20000", 6))
            usdtPool = await poolFactory.deploy(usdt.address, parseUnits("0.8"), 0, parseUnits("0.04"), parseUnits("0.75"))
            await usdtPool.deployed()
            await usdt.connect(lender).approve(usdtPool.address, constants.MaxUint256)
            await usdtPool.connect(lender).deposit(parseUnits("20000", 6))
            expect(await usdt.balanceOf(usdtPool.address)).to.be.eq(parseUnits("20000", 6))

            const futureFactory = (await ethers.getContractFactory('Future', owner)) as Future__factory
            future = await futureFactory.deploy(wethPool.address, usdtPool.address, 500, uniswapFactory)
            await future.deployed()
            expect(future.address).to.properAddress
        })

        describe("Futures can be priced", async () => {
            it("can compute the prices and liquidity", async () => {
                await wethPool.borrow(parseUnits("1"), uniswapRouter)
                expect(await wethPool.borrowingRate()).to.be.eq(parseUnits("0.012307692307692307"))
                await usdtPool.borrow(parseUnits("5000", 6), uniswapRouter)
                expect(await usdtPool.borrowingRate()).to.be.eq(parseUnits("0.0125"))

                expect(await future.askQty()).to.be.eq(parseUnits("6.456554291673574641"))
                expect(await future.askRate()).to.be.eq(parseUnits("2323.220610", 6))
                expect(await future.spot()).to.be.eq(parseUnits("2322.902382", 6))
                expect(await future.bidQty()).to.be.eq(parseUnits("9"))
                expect(await future.bidRate()).to.be.eq(parseUnits("2322.589093", 6))
            })

            it("can quote the prices and liquidity", async () => {
                expect(await wethPool.borrowingRateAfterLoan(parseUnits("1"))).to.be.eq(parseUnits("0.012307692307692307"))
                expect(await usdtPool.borrowingRateAfterLoan(parseUnits("6968.707146", 6))).to.be.eq(parseUnits("0.017421767865"))

                expect(await future.askQty()).to.be.eq(parseUnits("8.609918417139924393"))
                expect(await future.quoteAskRate(parseUnits("3"))).to.be.eq(parseUnits("2323.345921", 6))
                expect(await future.spot()).to.be.eq(parseUnits("2322.902382", 6))
                expect(await future.bidQty()).to.be.eq(parseUnits("10"))
                expect(await future.quoteBidRate(parseUnits("1"))).to.be.eq(parseUnits("2322.589093", 6))
            })
        });

        describe("Futures can be traded", async () => {
            const quantity = parseEther("1");

            it("can go long", async () => {
                await usdtPool.borrow(parseUnits("6250", 6), uniswapRouter)
                const initialUsdtHoldings = await usdt.balanceOf(usdtPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                await future.long(quantity, parseUnits("2335.065276", 6))

                expect(await weth.balanceOf(wethPool.address)).to.be.eq(initialWethHoldings.add(quantity))
                expect(await usdt.balanceOf(usdtPool.address)).to.be.lt(initialUsdtHoldings)
            })

            it("can go short", async () => {
                await wethPool.borrow(parseUnits("1"), uniswapRouter)
                const initialUsdtHoldings = await usdt.balanceOf(usdtPool.address);
                const initialWethHoldings = await weth.balanceOf(wethPool.address);

                await future.short(quantity, parseUnits("2310.664466", 6))

                //In this case we spend more than 1 ETH to hedge, check how this affects settlement later
                expect(await weth.balanceOf(wethPool.address)).to.be.lt(initialWethHoldings.sub(quantity))
                expect(await usdt.balanceOf(usdtPool.address)).to.be.gt(initialUsdtHoldings)
            })
        })
    })
})

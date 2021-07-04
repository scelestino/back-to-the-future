import { Button, Input, Slider, Typography } from "antd";
import _Modal from "antd/lib/modal/Modal";
import { utils } from 'ethers';
import React, { useState, Suspense, SuspenseProps } from 'react';
import styled from 'styled-components';
import { useAskRate, useBidRate, useContracts, useGasPrice, useProvider, useSpotPrice } from '../../services';
import { Transactor } from "./../../helpers";
import settingsIcon from './settingsIcon.svg';
import { balanceItem } from './Wallet';

const { parseUnits, formatUnits } = utils

export const colors = {
  buy: 'rgb(128, 232, 152)',
  sell: 'rgb(217, 85, 85)',
  menu: {
    selected: '#fcba03',
    notSelected: '#EDE6C0',
  },
  yellow: 'rgb(240, 236, 10)',
  backgroundPrimary: '#000',
  backgroundSecondary: 'rgba(255, 255, 255, 0.1)',
  lighterGrey: 'rgba(255, 255, 255, 0.05)'
}

export const SInput = styled(Input)`
  .ant-input:focus {
    border-color: #57a8e9;
    outline: 0;
    -webkit-box-shadow: 0 0 0 0 rgba(87,168,233, .2);
    box-shadow: 0 0 0 0 rgba(87,168,233, .2);
  }
`

export const StyledInputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 76px;
  width: 475px;
  border-radius: 16px;
  .ant-input:focus .ant-input-focused {
    border: none;
    border-bottom: 1px solid white !important;
    box-shadow: none;
  }

  .ant-input-focused .ant-input:focus {
    border: none;
    border-bottom: 1px solid white !important;
    box-shadow: none;
  }
`

const BuySellWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const Cell = ({ children }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: '0 10px',
      justifyContent: 'space-between',
      backgroundColor: 'rgb(48, 48, 48)',
      height: 76,
      width: 514,
      borderRadius: '16px'
    }}>
      {children}
    </div>
  )
}

const calculateBuyPriceWithSlippage = (price, slippageTolerance) => {
  const slippageMultiplier = String(1000 + slippageTolerance)
  return price.mul(slippageMultiplier).div('1000')
}

// TODO review with bruno
const calculateSellPriceWithSlippage = (price, slippageTolerance) => {
  const slippageDivider = String(1000 + slippageTolerance)
  return price.div(slippageDivider).mul('1000')
}

const BuySell = ({ userProvider, slippageTolerance, leverage }) => {
  const [buyQty, setBuyQty] = useState(1)
  const [sellQty, setSellQty] = useState(1)
  const [buyRateQty, setBuyRateQty] = useState('1')
  const [sellRateQty, setSellRateQty] = useState('1')
  const contracts = useContracts()
  const gasPrice = useGasPrice('localhost')
  const FutureContract = contracts.Future
  const [rawQuoteBidRate, formattedQuoteBidRate] = useBidRate(sellRateQty, formatUnits)
  const [rawQuoteAskRate, formattedQuoteAskRate] = useAskRate(buyRateQty, formatUnits)

  const handleSubmitTrade = async (qty) => {
    const tx = Transactor(userProvider, gasPrice)
    if (qty > 0) {
      const price = calculateBuyPriceWithSlippage(rawQuoteAskRate, slippageTolerance)
      const quantity = parseUnits(String(qty))
      await tx(contracts.UserAccount.placeOrder(FutureContract.address, quantity, price, leverage));
    } else if (qty < 0) {
      const price = calculateSellPriceWithSlippage(rawQuoteBidRate, slippageTolerance)
      const quantity = parseUnits(String(qty))
      await tx(contracts.UserAccount.placeOrder(FutureContract.address, quantity, price, leverage))
    }
  }

  return (
    <BuySellWrapper>
      <Cell>
        <StyledInputWrapper style={{ width: 84 }} >
          <Typography style={{ marginLeft: 15, alignItems: 'flex-start', marginTop: -5, marginBottom: -5, display: 'flex', height: 36, flexDirection: 'column', justifyContent: 'flex-end', color: colors.menu.notSelected, fontSize: 14 }}>{`Size`}</Typography>
          <SInput
            onBlur={() => {
              if (buyQty && Number(buyQty) > 0) {
                setBuyRateQty(String(buyQty))
              }
            }}
            bordered={false}
            value={buyQty}
            onChange={({ target: { value }}) => setBuyQty(value)}
            style={{ marginLeft: 3, border: 'none', height: 10, fontSize: 22, height: '40px' }}
          />
        </StyledInputWrapper>
        {balanceItem('Price', formattedQuoteAskRate, true)}
        <Button style={{ fontSize: 18, width: 112, height: 50, border: 'none', color: 'black', background: 'linear-gradient(270deg, #4EF8C0 22.28%, #FAEB61 163.35%)' }} onClick={() => handleSubmitTrade(Number(buyQty))}>Buy</Button>
      </Cell>
      <Cell>
        <StyledInputWrapper style={{ width: 84 }} >
            <Typography style={{ marginLeft: 15, alignItems: 'flex-start', marginTop: -5, marginBottom: -5, display: 'flex', height: 36, flexDirection: 'column', justifyContent: 'flex-end', color: colors.menu.notSelected, fontSize: 14 }}>{`Size`}</Typography>
            <SInput
              onBlur={() => {
                if (sellQty && Number(sellQty) > 0) {
                  setSellRateQty(String(sellQty))
                }
              }}
              bordered={false}
              value={sellQty}
              onChange={({ target: { value }}) => setSellQty(value)}
              style={{ marginLeft: 3, border: 'none', height: 10, fontSize: 22, height: '40px' }}
            />
        </StyledInputWrapper>
        {balanceItem('Price', formattedQuoteBidRate, true)}
        <Button style={{ fontSize: 18, width: 112, height: 50, border: 'none', color: '#fff', background: 'linear-gradient(270deg, #E12D39 22.28%, #F86A6A 128.53%)' }} onClick={() => handleSubmitTrade(Number(sellQty) * -1)}>Sell</Button>
      </Cell>
    </BuySellWrapper>
  )
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 309px;
  width: 562px;
  border-radius: 16px;
  justify-content: center;
  align-items: center;
  gap: 20px;
  .ant-card-head: {
    border: none;
  }
`

const HeaderInnerWrapper = styled.div`
  height: 62px;
  width: 510px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`

// todo select hover color
const IconWrapper = styled.div`
  &:hover {
    background-color: inherit;
  }
  height: fit-content;
  cursor: pointer;
`

const HeaderWrapper = styled.div`

`

const Modal = styled(_Modal)`
  .ant-modal-title {
    font-size: 22px;
  }
`

export const ModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const marks = {
  1: '1x',
  2: '2x',
  3: '3x',
  4: '4x',
  5: '5x',
  6: '6x',
  7: '7x',
  8: '8x',
  9: '9x',
  10: '10x'
}


const Header = ({ leverage, setLeverage, onSubmit, slippageInitValue }) => {
  const [slippageTolerance, setSlippageTolerance] = useState(slippageInitValue / 10)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const spotPrice = useSpotPrice()
  const future = `ETH/DAI`
  const expiry = '09/07/21'

  return (
    <HeaderWrapper>
      <HeaderInnerWrapper>
        <div style={{ alignItems: 'flex-start', display: 'flex', flexDirection: 'column' }} >
          <Typography style={{ color: 'white', fontSize: 24 }} >{`${future} - ${expiry}`}</Typography>
          <Typography style={{ color: colors.menu.notSelected, fontSize: 18 }}>{`Spot Price: ${Number(formatUnits(spotPrice)).toFixed(4)}`}</Typography>
        </div>
        <IconWrapper onClick={() => setIsModalOpen(true)}>
          <img src={settingsIcon}></img>
        </IconWrapper>
      </HeaderInnerWrapper>
      <Modal
        okText="Accept"
        title="Transaction Settings"
        onCancel={() => setIsModalOpen(false)}
        onOk={() => {
          onSubmit(slippageTolerance)
          setIsModalOpen(false)
        }}
        visible={isModalOpen}
        okButtonProps={{ style: { color: colors.yellow, backgroundColor: 'unset', border: `1px solid ${colors.yellow}` }}}
      >
        <ModalContent>
          <div >
            <Typography style={{ color: colors.menu.notSelected, fontSize: 16 }} >Leverage Tolerance</Typography>
            <Slider onChange={setLeverage} tooltipVisible={false} defaultValue={leverage} marks={marks} min={1} max={10} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} >
            <div>
            <Typography style={{ color: colors.menu.notSelected, fontSize: 16 }} >Slippage Tolerance</Typography>
            <Typography>
              {`A 0.5% will apply by default.`}<br></br>
              {`If you wish to change it type it below.`}
            </Typography>
            </div>
            <StyledInputWrapper style={{ backgroundColor: colors.lighterGrey }} >
              <Typography style={{ marginLeft: 15, marginBottom: -10, display: 'flex', height: 36, flexDirection: 'column', justifyContent: 'flex-end', color: colors.menu.notSelected, fontSize: 14 }}>{`slippage (%)`}</Typography>
              <SInput
                bordered={false}
                value={slippageTolerance} 
                onChange={({ target: { value }}) => {
                  setSlippageTolerance(value)
                }}
                style={{ marginLeft: 3, border: 'none', height: 10, fontSize: 22, height: '40px' }} />
            </StyledInputWrapper>
          </div>
        </ModalContent>
      </Modal>
    </HeaderWrapper>
  )
}

// todo why is settings icon white?
export const Ticket = () => {
  const [leverage, setLeverage] = useState(5)
  const [slippageTolerance, setSlippageTolerance] = useState(5) // 5 points == 0.5% or 0.005 fractional
  const userProvider = useProvider()

  const onSubmit = (slippage) => {
    setSlippageTolerance(Number(slippage) * 10)
  }

  const fallback = (
    <BuySellWrapper>
      <Cell>Fetching quotes...</Cell>
      <Cell>Fetching quotes...</Cell>
    </BuySellWrapper>
  )

  return (
    <Wrapper style={{ backgroundColor: colors.backgroundSecondary }}>
      <Header slippageInitValue={slippageTolerance} onSubmit={onSubmit} slippageTolerance={slippageTolerance} setSlippageTolerance={setSlippageTolerance} leverage={leverage} setLeverage={setLeverage} />
      <Suspense fallback={fallback}>
        <BuySell slippageTolerance={slippageTolerance} leverage={leverage} userProvider={userProvider} />
      </Suspense>
    </Wrapper>
  )
}




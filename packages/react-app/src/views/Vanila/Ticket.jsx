import { Button, Card, Input } from "antd";
import { format } from 'date-fns';
import { utils } from 'ethers';
import React, { useState } from 'react';
import styled from 'styled-components';
import { useAddress, useAskRate, useBidRate, useContracts, useGasPrice, usePositions, useProvider } from '../../services';
import { Transactor } from "./../../helpers";
import { Positions } from "./Positions";
import { balanceItem } from './Wallet';

const { parseUnits, formatUnits } = utils

const hardcodedExpiryTime = 1627776000

const useFuture = (baseCurr, quoteCurr) => {
  return {
    baseCurr,
    quoteCurr,
    expiry: format(hardcodedExpiryTime, 'yy/LL/dd')
  }
}

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
      height: 50,
      width: 640,
      border: '1px solid white',
      borderRadius: '5px'
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

const BuySell = ({ userProvider }) => {

  const [leverage] = useState(5)
  const [slippageTolerance] = useState(50) // 50 pips == 0.5% or 0.005 fractional
  const [buyQty, setBuyQty] = useState(1)
  const [sellQty, setSellQty] = useState(1)
  const contracts = useContracts()
  const gasPrice = useGasPrice('localhost')
  const FutureContract = contracts.Future
  const [rawQuoteBidRate, formattedQuoteBidRate] = useBidRate('1', formatUnits)
  const [rawQuoteAskRate, formattedQuoteAskRate] = useAskRate('1', formatUnits)

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
        <Input style={{ width: 100 }} onChange={({ target: { value }}) => setBuyQty(Number(value))} />
        {balanceItem('Price', formattedQuoteAskRate, true)}
        <Button onClick={() => handleSubmitTrade(buyQty)}>Buy</Button>
      </Cell>
      <Cell>
        <Input style={{ width: 100 }} onChange={({ target: { value }}) => setSellQty(Number(value) * - 1)} />
        {balanceItem('Price', formattedQuoteBidRate, true)}
        <Button onClick={() => handleSubmitTrade(sellQty)} >Sell</Button>
      </Cell>
    </BuySellWrapper>
  )
}

export const Ticket = () => {
  const userProvider = useProvider()
  const address = useAddress()
  const { baseCurr, quoteCurr, expiry } = useFuture('ETH', 'DAI')
  const position = usePositions(address)
  const title = `Future ${baseCurr}/${quoteCurr} - Exp. ${expiry}`

  return (
    <Card size="default" title={title}>
      <BuySell userProvider={userProvider} title={title} />
      {position && <Positions {...position}  />}
    </Card>
  )
}




import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { Typography, Input, Modal, Button, Card } from "antd";
import { format } from 'date-fns'
import { balanceItem } from './Wallet';
import { useContractLoader, useContractReader, useExternalContractLoader, useGasPrice } from '../../hooks';
import { useUserAddress } from 'eth-hooks';
import { NETWORKS, DAI_ABI, DAI_ADDRESS } from '../../constants';
import { useContract } from './Trader';
import { BigNumber, utils } from 'ethers'
import { Transactor } from "./../../helpers";

const targetNetwork = NETWORKS.localhost;
const { parseUnits, formatUnits } = utils

const Wraper = styled.div`
  display: flex
`

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
      width: 340,
      border: '1px solid white',
      borderRadius: '5px'
    }}>
      {children}
    </div>
  )
}

const FormItem = styled.span`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`

const BuySell = ({ title, userProvider }) => {

  const [buyQty, setBuyQty] = useState('1')
  const [sellQty, setSellQty] = useState('1')

  const address = useUserAddress(userProvider)
  const contracts = useContractLoader(userProvider)
  const gasPrice = useGasPrice(targetNetwork, "fast")
  const FutureContract = useContract("Future", userProvider)
  // const DAIContract = useExternalContractLoader(userProvider, DAI_ADDRESS, DAI_ABI)
  const quoteBidRate = useContractReader(contracts, "Future", "quoteBidRate", [parseUnits(buyQty)])
  const quoteAskRate = useContractReader(contracts, "Future", "quoteAskRate", [parseUnits(sellQty)])
  const noFills = useContractReader(contracts, "UserAccount", "noFills", [address], (bigNum) => formatUnits(bigNum, 0))
  // const purchasingPower = useContractReader(contracts, "UserAccount", "purchasingPower", [address, DAI_ADDRESS], formatUnits)

  useEffect(() => {
    console.log('noFills', noFills)
    // [1, 2]
    const getPositions = async () => {
      // [1, 1]
      const arr = Array(Number(noFills)).fill(1)
      const resultArr = arr.map(async (_, i) => {
        console.log(`position ${i}`, await contracts.UserAccount.fills(address, i))
      })
      // console.log('positions res', resultArr)
    }
    if (noFills !== undefined) {
      getPositions()
    }
  }, [noFills])

  const handleSubmitTrade = async (qty, isBuy) => {
    const tx = Transactor(userProvider, gasPrice)
    if (isBuy) {
      const priceWithSlippage = '2550'
      await tx(contracts.UserAccount.placeOrder(FutureContract.address, parseUnits(buyQty), parseUnits(priceWithSlippage), 5));
    }
  }

  return (
    <BuySellWrapper>
      <Cell>
        {balanceItem('Price', quoteAskRate ? formatUnits(quoteAskRate) : '-', true)}
        <Button onClick={() => handleSubmitTrade(buyQty, true)}>Buy</Button>
      </Cell>
      <Cell>
        {balanceItem('Price', quoteBidRate ? formatUnits(quoteBidRate) : '-', true)}
        <Button>Sell</Button>
      </Cell>
    </BuySellWrapper>
  )
}

export const Ticket = ({ userProvider }) => {
  const { baseCurr, quoteCurr, expiry } = useFuture('ETH', 'DAI')
  const title = `Future ${baseCurr}/${quoteCurr} - Exp. ${expiry}`

  return (
    <Card size="default" title={title}>
      <BuySell userProvider={userProvider} title={title} />
    </Card>
  )
}




import React, { useState } from 'react'
import styled from 'styled-components'
import { Typography, Input, Modal, Button, Card } from "antd";
import { format } from 'date-fns'
import { balanceItem } from './Wallet';

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

const NONE = 0
const BUY = 'Buy'
const SELL = 'Sell'

const BuySell = ({ title }) => {
  const [selectedModal, setSelectedModal] = useState(NONE)

  const handleSubmitTrade = () => {
    console.log('called handle submit trade!')
  }

  const form = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <FormItem>
        <Typography>{`Amount To ${selectedModal}`}</Typography>
        <Input style={{ width: 150 }}/>
      </FormItem>
      <FormItem>
        <Typography>{`Slippage Tolerance`}</Typography>
        <Input placeholder={'0.02'} style={{ width: 150 }}/>
      </FormItem>
    </div>
  )

  return (
    <BuySellWrapper>
      <Cell>
        {balanceItem('Price', '2083.00000000', true)}
        <Button onClick={() => setSelectedModal(BUY)}>Buy</Button>
      </Cell>
      <Cell>
        {balanceItem('Price', '2083.00000000', true)}
        <Button onClick={() => setSelectedModal(SELL)}>Sell</Button>
      </Cell>
      <Modal
        okText={selectedModal}
        title={`${selectedModal} ${title}`}
        visible={selectedModal !== NONE}
        onOk={handleSubmitTrade}
        onCancel={() => setSelectedModal(NONE)}
      >
        {form}
      </Modal>
    </BuySellWrapper>
  )
}

export const Ticket = () => {
  const { baseCurr, quoteCurr, expiry } = useFuture('ETH', 'DAI')
  const title = `Future ${baseCurr}/${quoteCurr} - Exp. ${expiry}`

  return (
    <Card size="default" title={title}>
      <BuySell title={title} />
    </Card>
  )
}




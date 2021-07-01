import React, { useState } from 'react'
import styled from 'styled-components'
import { Typography, Input, Modal, Button } from "antd";

const Wrapper = styled.div`
  height: 80px;
  width: 100%;
  display: flex;
  background-color: rgb(48, 48, 48);
  flex-direction: row;
  justify-content: center;
  align-items: center;
  .ant-input {
    height: 25px;
  }
`

const InnerWrapper = styled.div`
  display: flex;
  width: 80%;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  .ant-typography {
    height: 25px;
  }
  .ant-input {
    height: 25px;
  }
  .ant-btn {
    margin-left: 12px;
  }
`

const NONE = 0
const DEPOSIT = 'Deposit'
const WITHDRAW = 'Withdraw'

export const balanceItem = (text, number, alignStart) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <Typography style={{  alignSelf: alignStart ? 'flex-start' : 'inherit' }}>{text}</Typography>
    <Typography>{`${number} DAI`}</Typography>
  </div>
)

export const Wallet = ({
  purchasingPower = '0000.0000',
  margin = '0000.0000',
  balance = '0000.0000',
}) => {
  const [modalSelected, setModalSelected] = useState(NONE)

  const handleSubmit = () => {
    console.log('clicked')
  }

  const form = (
    <InnerWrapper>
      <Typography>Amount</Typography>
      <Input placeholder={'DAI to deposit'} style={{ width: 150 }}/>
    </InnerWrapper>
  )

  const divider = (
    <div style={{ margin: '0 10px', height: 45, width: '1px', backgroundColor: 'white' }} />
  )

  return (
    <Wrapper>
      <InnerWrapper>
        <Typography style={{ fontSize: 20 }}>Trader</Typography>
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          {balanceItem('Purchasing Power', purchasingPower)}
          {divider}
          {balanceItem('Margin', margin)}
          {divider}
          {balanceItem('Balance', balance)}
        </div>
        <div>
          <Button onClick={() => setModalSelected(DEPOSIT)}>Deposit</Button>
          <Button onClick={() => setModalSelected(WITHDRAW)}>Withdraw</Button>
        </div>
        <Modal
          okText={modalSelected}
          title={modalSelected}
          visible={modalSelected !== NONE}
          onOk={handleSubmit}
          onCancel={() => setModalSelected(NONE)}
        >
          {form}
        </Modal>
      </InnerWrapper>
    </Wrapper>
  )

}


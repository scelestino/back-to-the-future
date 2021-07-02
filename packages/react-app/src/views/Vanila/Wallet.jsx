import { Button, Input, Modal, Typography } from "antd";
import { utils } from 'ethers';
import React, { useState } from 'react';
import styled from 'styled-components';
import { DAI_ADDRESS } from '../../constants';
import { useAddress, useBalance, useContracts, useDaiContract, useGasPrice, useProvider, usePurchasingPower } from '../../services';
import { Transactor } from "./../../helpers";
const { parseUnits, formatUnits } = utils

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

export const Wallet = () => {
  const userProvider = useProvider()
  const address = useAddress()
  const contracts = useContracts()
  const gasPrice = useGasPrice('localhost')
  const UserAccountContract = contracts.UserAccount
  const DAIContract = useDaiContract()
  const [, formattedBalance] = useBalance(address, formatUnits)
  const [, purchasingPower] = usePurchasingPower(address, formatUnits)
  const margin = Math.abs(Number(formattedBalance) - Number(purchasingPower) || 0) || '0000.0000'

  const [modalSelected, setModalSelected] = useState(NONE)
  const [amount, setAmount] = useState()

  const handleSubmit = async (isDeposit) => {
    const tx = Transactor(userProvider, gasPrice)
    if (isDeposit) {
      await tx(DAIContract.approve(UserAccountContract.address, amount), r => {console.log(r)} )
      await tx(UserAccountContract.deposit(DAI_ADDRESS, amount), async result => {
        setModalSelected(NONE)
        setAmount("0")
        console.log('deposit result', await result)
      })
    } else {
      await tx(UserAccountContract.withdraw(DAI_ADDRESS, amount), async result => {
        setModalSelected(NONE)
        setAmount("0")
        console.log('withdraw result', await result)
      })
    }
  }

  const form = (
    <InnerWrapper>
      <Typography>Amount</Typography>
      <Input
        onChange={({ target: { value }}) => setAmount(parseUnits(value || '0'))}
        placeholder={`DAI to ${modalSelected}`}
        style={{ width: 150 }}
      />
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
          {balanceItem('Balance', formattedBalance)}
        </div>
        <div>
          <Button onClick={() => setModalSelected(DEPOSIT)}>Deposit</Button>
          <Button onClick={() => setModalSelected(WITHDRAW)}>Withdraw</Button>
        </div>
        <Modal
          okText={modalSelected}
          title={modalSelected}
          visible={modalSelected !== NONE}
          onOk={() => handleSubmit(modalSelected === DEPOSIT)}
          onCancel={() => setModalSelected(NONE)}
        >
          {form}
        </Modal>
      </InnerWrapper>
    </Wrapper>
  )

}


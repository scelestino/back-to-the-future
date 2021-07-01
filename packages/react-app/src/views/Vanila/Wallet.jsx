import React, { useState } from 'react'
import styled from 'styled-components'
import { Typography, Input, Modal, Button } from "antd";
import { useContractLoader, useContractReader, useExternalContractLoader, useGasPrice } from '../../hooks';
import { useUserAddress } from 'eth-hooks';
import { NETWORKS, DAI_ABI, DAI_ADDRESS } from '../../constants';
import { useContract } from './Trader';
import { BigNumber, utils } from 'ethers'
import { Transactor } from "./../../helpers";

const targetNetwork = NETWORKS.localhost;
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

export const Wallet = ({
  userProvider,
}) => {
  const address = useUserAddress(userProvider)
  const contracts = useContractLoader(userProvider)
  const gasPrice = useGasPrice(targetNetwork, "fast")
  const UserAccountContract = useContract("UserAccount", userProvider)
  const DAIContract = useExternalContractLoader(userProvider, DAI_ADDRESS, DAI_ABI)
  const balance = useContractReader(contracts, "UserAccount", "wallet", [address, DAI_ADDRESS], formatUnits)
  const purchasingPower = useContractReader(contracts, "UserAccount", "purchasingPower", [address, DAI_ADDRESS], formatUnits)
  const margin = Number(purchasingPower) - Number(balance) || '0000.0000'

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
        onChange={({ target: { value }}) => setAmount(parseUnits(value))}
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
          onOk={() => handleSubmit(modalSelected === DEPOSIT)}
          onCancel={() => setModalSelected(NONE)}
        >
          {form}
        </Modal>
      </InnerWrapper>
    </Wrapper>
  )

}


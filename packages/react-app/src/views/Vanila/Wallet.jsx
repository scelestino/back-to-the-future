import { Button, Input, Modal as _Modal, Typography } from "antd";
import { utils } from 'ethers';
import React, { useState } from 'react';
import styled from 'styled-components';
import { YellowButton } from "../../App";
import { DAI_ADDRESS } from '../../constants';
import { useAddress, useBalance, useContracts, useDaiContract, useGasPrice, useProvider, usePurchasingPower } from '../../services';
import { Transactor } from "./../../helpers";
import { colors, ModalContent, StyledInputWrapper, SInput } from "./Ticket";
const { parseUnits, formatUnits } = utils

const Wrapper = styled.div`
  height: 110px;
  width: 100%;
  display: flex;
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

const Modal = styled(_Modal)`
  .ant-modal-title {
    font-size: 22px;
  }
`

const NONE = 0
const DEPOSIT = 'Deposit'
const WITHDRAW = 'Withdraw'

export const balanceItem = (text, number, alignStart, ccy) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <Typography style={{ color: colors.menu.notSelected,  alignSelf: alignStart ? 'flex-start' : 'inherit' }}>{text}</Typography>
    <Typography style={{ fontSize: 22, color: '#ffffff' }}>{`${Number(number).toFixed(4)} ${ccy ? ccy : ''}`}</Typography>
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
    <StyledInputWrapper style={{ backgroundColor: colors.lighterGrey }}>
      <Typography style={{ marginLeft: 15, marginBottom: -10, display: 'flex', height: 36, flexDirection: 'column', justifyContent: 'flex-end', color: colors.menu.notSelected, fontSize: 14 }}>{`Amount to ${String(modalSelected).toLowerCase()}`}</Typography>
      <SInput
        bordered={false}
        onChange={({ target: { value }}) => setAmount(parseUnits(value || '0'))}
        placeholder={`0.00`}
        style={{ marginLeft: 3, border: 'none', height: 10, fontSize: 22, height: '40px' }}
      />
    </StyledInputWrapper>
  )

  const divider = (
    <div style={{ margin: '0 10px', height: 45, width: '1px', backgroundColor: 'white' }} />
  )

  return (
    <Wrapper style={{ backgroundColor: colors.backgroundSecondary }}>
      <InnerWrapper>
        <Typography style={{ fontSize: 20 }}>Trader</Typography>
        <div style={{ justifyContent: 'center', width: 585, display: 'flex', flexDirection: 'row' }}>
          {balanceItem('Purchasing Power', purchasingPower, false, 'DAI')}
          {divider}
          {balanceItem('Margin', margin, false, 'DAI')}
          {divider}
          {balanceItem('Balance', formattedBalance, false, 'DAI')}
        </div>
        <div>
          <YellowButton onClick={() => setModalSelected(DEPOSIT)}>Deposit</YellowButton>
          <YellowButton onClick={() => setModalSelected(WITHDRAW)}>Withdraw</YellowButton>
        </div>
        <Modal
          okText={modalSelected}
          title={modalSelected}
          visible={modalSelected !== NONE}
          onOk={() => handleSubmit(modalSelected === DEPOSIT)}
          onCancel={() => setModalSelected(NONE)}
          okButtonProps={{ style: { color: colors.yellow, backgroundColor: 'unset', border: `1px solid ${colors.yellow}` }}}
        >
          <ModalContent>
            {form}
          </ModalContent>
        </Modal>
      </InnerWrapper>
    </Wrapper>
  )

}


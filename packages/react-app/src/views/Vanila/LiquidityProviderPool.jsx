import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Typography, Input, Modal, Button } from "antd";
import { utils } from "ethers";
import { useUserAddress } from "eth-hooks";
import { useContractLoader, useContractReader, useExternalContractLoader, useGasPrice } from "../../hooks";
import { NETWORKS, DAI_ABI, DAI_ADDRESS, WETH_ADDRESS, WETH_ABI} from "../../constants";
import { Transactor } from "../../helpers";
import { Row, Cell } from './LiquidityProvider'
import { YellowButton } from '../../App'
import { ModalContent, StyledInputWrapper, colors, SInput } from './Ticket'

const targetNetwork = NETWORKS.localhost;
const { parseUnits, formatUnits } = utils;

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
`;

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
`;

const NONE = 0;
const DEPOSIT = "Deposit";
const WITHDRAW = "Withdraw";

export const balanceItem = (tokenName, text, number, alignStart) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    <Typography style={{ alignSelf: alignStart ? "flex-start" : "inherit" }}>{text}</Typography>
    <Typography>{`${number} ${tokenName}`}</Typography>
  </div>
);

const useMyContractReader = userProvider => {
  const localContracts = useContractLoader(userProvider);
  const DAIContract = useExternalContractLoader(userProvider, DAI_ADDRESS, DAI_ABI);
  const WETHContract = useExternalContractLoader(userProvider, WETH_ADDRESS, WETH_ABI);
  const [contracts, setContracts] = useState();
  useEffect(() => {
    if (localContracts && DAIContract && WETHContract) {
      setContracts({ ...localContracts, DAI: DAIContract, WETH: WETHContract });
    }
  }, [localContracts, DAIContract, WETHContract]);
  return contracts;
};

export const LiquidityProviderPool = ({ userProvider, tokenName, poolName }) => {
  const address = useUserAddress(userProvider);
  const contracts = useMyContractReader(userProvider);
  const gasPrice = useGasPrice(targetNetwork, "fast");

  const walletBalance = useContractReader(contracts, tokenName, "balanceOf", [address], formatUnits);
  const poolBalance = useContractReader(contracts, poolName, "balanceOf", [address], formatUnits);

  const [modalSelected, setModalSelected] = useState(NONE);
  const [amount, setAmount] = useState();

  const handleSubmit = async isDeposit => {
    const tx = Transactor(userProvider, gasPrice);
    if (isDeposit) {
      await tx(contracts[tokenName].approve(contracts[poolName].address, amount), r => {
        console.log(r);
      });
      await tx(contracts[poolName].deposit(amount), async result => {
        setModalSelected(NONE);
        setAmount("0");
        console.log("deposit result", await result);
      });
    } else {
      await tx(contracts[poolName].withdraw(amount), async result => {
        setModalSelected(NONE);
        setAmount("0");
        console.log("withdraw result", await result);
      });
    }
  };

  const form = (
    <InnerWrapper>
      <Typography>Amount</Typography>
      <Input
        onChange={({ target: { value } }) => setAmount(parseUnits(value || "0"))}
        placeholder={`${tokenName} to ${modalSelected}`}
        style={{ width: 150 }}
      />
    </InnerWrapper>
  );

  const formm = (
    <StyledInputWrapper style={{ backgroundColor: colors.lighterGrey }}>
      <Typography style={{ marginLeft: 15, marginBottom: -10, display: 'flex', height: 36, flexDirection: 'column', justifyContent: 'flex-end', color: colors.menu.notSelected, fontSize: 14 }}>{`Amount to ${String(modalSelected).toLowerCase()}`}</Typography>
      <SInput
        onChange={({ target: { value }}) => setAmount(parseUnits(value || '0'))}
        placeholder={`0.00`}
        style={{ marginLeft: 3, border: 'none', height: 10, fontSize: 22, height: '40px' }}
      />
    </StyledInputWrapper>
  )

  const divider = <div style={{ margin: "0 10px", height: 45, width: "1px", backgroundColor: "white" }} />;

  return (
    <Row>
      <Cell>{tokenName}</Cell>
      <Cell>TBD</Cell>
      <Cell>{Number(walletBalance).toFixed(4)}</Cell>
      <Cell>{Number(poolBalance).toFixed(4)}</Cell>
      <Cell>
        <YellowButton onClick={() => setModalSelected(DEPOSIT)}>Deposit</YellowButton>
      </Cell>
      <Cell>
        <YellowButton onClick={() => setModalSelected(WITHDRAW)}>Withdraw</YellowButton>
      </Cell>
      <Modal
        okText={modalSelected}
        title={modalSelected}
        visible={modalSelected !== NONE}
        onOk={() => handleSubmit(modalSelected === DEPOSIT)}
        onCancel={() => setModalSelected(NONE)}
        okButtonProps={{ style: { color: colors.yellow, backgroundColor: 'unset', border: `1px solid ${colors.yellow}` }}}
      >
        <ModalContent>
          {formm}
        </ModalContent>
      </Modal>
    </Row>
  );
};

import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Typography, Input, Modal, Button } from "antd";
import { utils } from "ethers";
import { useUserAddress } from "eth-hooks";
import { useContractLoader, useContractReader, useExternalContractLoader, useGasPrice } from "../../hooks";
import { NETWORKS, DAI_ABI, DAI_ADDRESS } from "../../constants";
import { Transactor } from "../../helpers";

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

export const balanceItem = (text, number, alignStart) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    <Typography style={{ alignSelf: alignStart ? "flex-start" : "inherit" }}>{text}</Typography>
    <Typography>{`${number} DAI`}</Typography>
  </div>
);

const useMyContractReader = userProvider => {
  const localContracts = useContractLoader(userProvider);
  const DAIContract = useExternalContractLoader(userProvider, DAI_ADDRESS, DAI_ABI);
  const [contracts, setContracts] = useState();
  useEffect(() => {
    if (localContracts && DAIContract) {
      setContracts({ ...localContracts, DAI: DAIContract });
    }
  }, [localContracts, DAIContract]);
  return contracts;
};

export const Pool = ({ userProvider }) => {
  const address = useUserAddress(userProvider);
  const contracts = useMyContractReader(userProvider);
  const gasPrice = useGasPrice(targetNetwork, "fast");

  const walletBalance = useContractReader(contracts, "DAI", "balanceOf", [address], formatUnits);
  const poolBalance = useContractReader(contracts, "DAIPool", "balanceOf", [address], formatUnits);

  const [modalSelected, setModalSelected] = useState(NONE);
  const [amount, setAmount] = useState();

  const handleSubmit = async isDeposit => {
    const tx = Transactor(userProvider, gasPrice);
    if (isDeposit) {
      await tx(contracts.DAI.approve(contracts.DAIPool.address, amount), r => {
        console.log(r);
      });
      await tx(contracts.DAIPool.deposit(amount), async result => {
        setModalSelected(NONE);
        setAmount("0");
        console.log("deposit result", await result);
      });
    } else {
      await tx(contracts.DAIPool.withdraw(amount), async result => {
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
        placeholder={`DAI to ${modalSelected}`}
        style={{ width: 150 }}
      />
    </InnerWrapper>
  );

  const divider = <div style={{ margin: "0 10px", height: 45, width: "1px", backgroundColor: "white" }} />;

  return (
    <Wrapper>
      <InnerWrapper>
        <Typography style={{ fontSize: 20 }}>DAI</Typography>
        <div style={{ display: "flex", flexDirection: "row" }}>
          {balanceItem("Wallet Balance", walletBalance)}
          {divider}
          {balanceItem("Pool Balance", poolBalance)}
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
  );
};

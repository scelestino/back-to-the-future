import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Typography, Input, Modal, Button } from "antd";
import { utils } from "ethers";
import { useUserAddress } from "eth-hooks";
import { useContractLoader, useContractReader, useExternalContractLoader, useGasPrice } from "../../hooks";
import { NETWORKS, DAI_ABI, DAI_ADDRESS, WETH_ADDRESS, WETH_ABI} from "../../constants";
import { Transactor } from "../../helpers";
import { Row, Cell } from './Pools'
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

export const balanceItem = (tokenName, text, number, alignStart) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    <Typography style={{ alignSelf: alignStart ? "flex-start" : "inherit" }}>{text}</Typography>
    <Typography>{`${number} ${tokenName}`}</Typography>
  </div>
);

export const ratioItem = (text, number, alignStart) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    <Typography style={{ alignSelf: alignStart ? "flex-start" : "inherit" }}>{text}</Typography>
    <Typography>{`${number}%`}</Typography>
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

export const Pool = ({ userProvider, tokenName, poolName }) => {
  const address = useUserAddress(userProvider);
  const contracts = useMyContractReader(userProvider);
  const gasPrice = useGasPrice(targetNetwork, "fast");

  const utilisationRate = useContractReader(contracts, poolName, "utilisationRate", [], formatUnits);
  const balance = useContractReader(contracts, poolName, "balance", [], formatUnits);
  const borrowed = useContractReader(contracts, poolName, "borrowed", [], formatUnits);
  const borrowingRate = useContractReader(contracts, poolName, "borrowingRate", [], formatUnits);

  const divider = <div style={{ margin: "0 10px", height: 45, width: "1px", backgroundColor: "white" }} />;

  return (
    <Row>
      <Cell>{tokenName}</Cell>
      <Cell>{Number(utilisationRate).toFixed(4)}</Cell>
      <Cell>{Number(balance).toFixed(4)}</Cell>
      <Cell>{Number(borrowed).toFixed(4)}</Cell>
      <Cell>{Number(borrowingRate).toFixed(4)}</Cell>
    </Row>
  );
};

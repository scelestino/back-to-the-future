import { formatUnits } from "@ethersproject/units";
import { Typography } from "antd";
import React, { useEffect, useState } from "react";
import { DAI_ABI, DAI_ADDRESS, WETH_ABI, WETH_ADDRESS } from "../../constants";
import { useContractLoader, useContractReader, useExternalContractLoader } from "../../hooks";
import { Cell, Row } from './Pools';

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
  const contracts = useMyContractReader(userProvider);

  const utilisationRate = useContractReader(contracts, poolName, "utilisationRate", [], formatUnits);
  const balance = useContractReader(contracts, poolName, "balance", [], formatUnits);
  const borrowed = useContractReader(contracts, poolName, "borrowed", [], formatUnits);
  const borrowingRate = useContractReader(contracts, poolName, "borrowingRate", [], formatUnits);

  console.log('bruno', utilisationRate)

  return (
    <Row>
      <Cell>{tokenName}</Cell>
      <Cell>{`${(Number(utilisationRate) * 100).toFixed(2)}%`}</Cell>
      <Cell>{Number(balance).toFixed(4)}</Cell>
      <Cell>{Number(borrowed).toFixed(4)}</Cell>
      <Cell>{`${(Number(borrowingRate) * 100).toFixed(2)}%`}</Cell>
    </Row>
  );
};

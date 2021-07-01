import React, { useState, useCallback, useEffect } from 'react';
import _Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import _TableCell from '@material-ui/core/TableCell';
import _TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import styled from 'styled-components'
import { usePositions } from '../../services';
import { NETWORKS, INFURA_ID } from "../../constants";
import { useContractLoader, useUserSigner, useContractExistsAtAddress, useGasPrice, useUserProvider, } from '../../hooks'
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { Web3Provider } from "@ethersproject/providers";
import { Contract } from '../../components';
import { Button, Card, DatePicker, Divider, Input, List, Progress, Slider, Spin, Switch } from "antd";
import { Transactor } from "../../helpers";
import { Wallet } from './Wallet';
import { Ticket } from './Ticket'

// TODO egill - review if neccesary
const { ethers } = require("ethers");

const TableContainer = styled(_TableContainer)`
  max-width: 1000px;
  margin: 20px 0 0 20px;
  background: transparent;
`

const Table = styled(_Table)`
  min-width: 650px;
  .MuiTableCell-root {
    padding: 0;
  }
`

const TableCell = styled(_TableCell)``

const web3Modal = new Web3Modal({
  // network: "mainnet", // optional
  cacheProvider: true, // optional
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        infuraId: INFURA_ID,
      },
    },
  },
});

const targetNetwork = NETWORKS.localhost;
const localProviderUrl = targetNetwork.rpcUrl;
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
const localProvider = new ethers.providers.StaticJsonRpcProvider(localProviderUrlFromEnv);
const blockExplorer = targetNetwork.blockExplorer;
const localChainId = localProvider && localProvider._network && localProvider._network.chainId;

const useProvider = () => {
  const [injectedProvider, setInjectedProvider] = useState();

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      (async () => {
        const provider = await web3Modal.connect()
        setInjectedProvider(new Web3Provider(provider))
      })()
    }
  }, []);

  return [injectedProvider, localProvider]
}

const useAddress = (userSigner) => {
  const [address, setAddress] = useState();

  useEffect(() => {
    async function getAddress() {
      if (userSigner) {
        const newAddress = await userSigner.getAddress();
        setAddress(newAddress);
      }
    }
    getAddress();
  }, [userSigner]);
  
  return address
}

const useContract = (contractName, provider) => {
  const contracts = useContractLoader(provider)
  const contract = contracts?.[contractName]
  const address = contract?.address
  const contractIsDeployed = useContractExistsAtAddress(provider, address);

  if (!contractIsDeployed) {
    throw new Error(`(useContract) Contract of name: ${contractName} does not exist`)
  }

  return contract
}

const UserAccount = () => {
  const [injectedProvider, localProvider] = useProvider();
  const userSigner = useUserSigner(injectedProvider, localProvider);
  const address = useAddress(userSigner)

  return (
    <>
      <span>{address}</span>
      <Contract 
        name={"UserAccount"}
        signer={userSigner}
        provider={injectedProvider || localProvider}
        address={address}
        blockExplorer={blockExplorer}
        />
    </>
  )
}

const DepositForm = ({ provider }) => {
  const [deposit, setDeposit] = useState()
  const [injectedProvider, localProvider] = useProvider()
  const userProvider = useUserProvider(injectedProvider, localProvider)
  const userSigner = useUserSigner(injectedProvider, localProvider)
  const gasPrice = useGasPrice(targetNetwork, "fast");
  const tx = Transactor(userProvider, gasPrice);
  const writeContracts = useContractLoader(userProvider);

  const onClick = async () => {
    const result = await tx(writeContracts.UserAccount.deposit('0x6b175474e89094c44da98b954eedeac495271d0f', deposit), update => {
      console.log('egill Transaction update: ', update)
    })
    
    console.log('egill', result)
  }

  return (
    <>
      <Input 
        onChange={e => setDeposit(e.target.value)}
      />
      <Button onClick={onClick}>Deposit</Button>
    </>
  )
  
}

const Positions = () => {
  const positions = usePositions()
  return (
    <TableContainer component={Paper}>
      <Table aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Contract</TableCell>
            <TableCell align="center">Side</TableCell>
            <TableCell align="center">Size</TableCell>
            <TableCell align="center">Entry Price</TableCell>
            <TableCell align="center">Liquidation Price</TableCell>
            <TableCell align="center">Margin</TableCell>
            <TableCell align="center"></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {positions.map(({ id, contract, side, size, entryPrice, liquidationPrice, margin }) => (
            <TableRow key={id}>
              <TableCell component="th" scope="row">
                {contract}
              </TableCell>
              <TableCell align="center">{side}</TableCell>
              <TableCell align="center">{size}</TableCell>
              <TableCell align="center">{entryPrice}</TableCell>
              <TableCell align="center">{liquidationPrice}</TableCell>
              <TableCell align="center">{margin}</TableCell>
              <TableCell align="center">
                <Button>Settle</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export const Trader = () => {

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
      <Wallet />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, width: 1000, height: '70vh', border: '1px solid grey' }}>
        <Ticket />
        {/* <Positions /> */}
        {/* <DepositForm /> */}
        {/* <UserAccount /> */}
      </div>
    </div>
  )

}
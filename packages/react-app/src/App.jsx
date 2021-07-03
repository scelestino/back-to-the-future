import { Subscribe } from '@react-rxjs/core';
import { Menu, Button } from "antd";
import "antd/dist/antd.css";
import React, { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Switch } from "react-router-dom";
import { ThemeSwitch } from "./components";
import { LiquidityProvider, Trader, Pools } from "./views";
import { colors } from './views/Vanila/Ticket';
import styled from 'styled-components'
import logo from './views/Vanila/logo.svg'

export const YellowButton = styled(Button)`
  color: ${colors.yellow} !important;
  border: 1px solid ${colors.yellow} !important;
`

const Logo = () => (
    <img src={logo}></img>
)

const ConnectButton = () => (
  <YellowButton>Connect Wallet</YellowButton>
)

function App() {
  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname);
  }, [setRoute]);

  return (
    <div style={{ textAlign: 'center', height: '100vh' }}>
      <BrowserRouter>
        <div style={{ height: 74, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: '80%', alignItems: 'center', justifyContent: 'space-between', display: 'flex', flexDirection: 'row' }}>
            <Logo />
            <div style={{ gap: 15, display: 'flex', flexDirection: 'row' }}>
              <Link
                onClick={() => {
                  setRoute("/");
                }}
                to="/"
              >
                <span style={{ color: route === '/' ? colors.menu.selected : colors.menu.notSelected }}>
                  Trader
                </span>
              </Link>
              <Link
                onClick={() => {
                  setRoute("/liquidity-provider");
                }}
                to="/liquidity-provider"
              >
                <span style={{ color: route === '/liquidity-provider' ? colors.menu.selected : colors.menu.notSelected }}>
                  Liquidity Provider
                </span>
              </Link>
              <Link
                onClick={() => {
                  setRoute("/pools");
                }}
                to="/pools"
              >
                <span style={{ color: route === '/pools' ? colors.menu.selected : colors.menu.notSelected }}>
                  Pools
                </span>
              </Link>
            </div>
            <ConnectButton />
          </div>
        </div>

        <Switch>
         <Route exact path="/">
           <Subscribe fallback={null}>
              <Trader />
           </Subscribe>
          </Route>
          <Route path="/liquidity-provider">
            <LiquidityProvider />
          </Route>
          <Route path="/pools">
            <Pools />
          </Route>
        </Switch>
      </BrowserRouter>

      <ThemeSwitch />

      {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
      {/* <div style={{ position: "fixed", textAlign: "right", right: 0, top: 0, padding: 10 }}>
        <Account
          address={address}
          localProvider={localProvider}
          userProvider={userProvider}
          mainnetProvider={mainnetProvider}
          price={price}
          web3Modal={web3Modal}
          loadWeb3Modal={loadWeb3Modal}
          logoutOfWeb3Modal={logoutOfWeb3Modal}
          blockExplorer={blockExplorer}
        />
        {faucetHint}
      </div> */}
    </div>
  );
}

/* eslint-disable */
window.ethereum &&
  window.ethereum.on("chainChanged", chainId => {
      setTimeout(() => {
        window.location.reload();
      }, 1);
  });

window.ethereum &&
  window.ethereum.on("accountsChanged", accounts => {
      setTimeout(() => {
        window.location.reload();
      }, 1);
  });
/* eslint-enable */

export default App;

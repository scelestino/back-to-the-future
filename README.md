# Vanila Protocol

The Vanila protocol is a decentralised exchange bringing expirable future contracts in Defi.

In DeFi, only perpetual futures exist. But since funding rates are unpredictable, traders do not have control over their costs. The vanila protocol brings expirable futures to DeFi to allow traders to set their costs upfront.

The vanila protocol hedges the positions taken by the traders to remove any impermanent losses for the liquidity providers and ensure a safe settlement for everyone.



## Quick Start

required: [Node](https://nodejs.org/dist/latest-v12.x/) plus [Yarn](https://classic.yarnpkg.com/en/docs/install/) and [Git](https://git-scm.com/downloads)


```bash
git clone https://github.com/scelestino/vanila.git
cd vanila
yarn install
yarn chain
```

> in a second terminal window:

```bash
cd vanila
yarn deploy
yarn fund
yarn start
```

### Gitbook

https://vanilaprotocol.gitbook.io/vanila/

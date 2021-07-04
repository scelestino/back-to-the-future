import { formatUnits, parseUnits } from '@ethersproject/units';
import { Typography } from 'antd';
import { BigNumber } from 'ethers';
import React from 'react';
import styled from 'styled-components';
import { Side, useAddress, useAskRate, useBidRate, usePositions } from '../../services';
import arrowdown from './arrowDown.svg';
import arrowup from './arrowUp.svg';
import { colors } from './Ticket';

const HRow = styled(Typography)`
  font-size: 14px;
  align-self: center;
  width: 155px;
`

const Pos = ({ position }) => {
  const openCost = Number(formatUnits(position.openCost.abs())).toFixed(4).toString()
  const bidPrices = useBidRate(position.size, formatUnits)
  const askPrices = useAskRate(position.size, formatUnits)
  const [rawMarketPrice, formattedMarketPrice] = position.side === Side.Long ? bidPrices : askPrices
  const closingCost = rawMarketPrice.mul(parseUnits(position.size)).div(BigNumber.from(10).pow(18))
  const pnl = closingCost.sub(position.openCost.abs())
  const formattedPnl = Number(formatUnits(pnl.abs())).toFixed(4).toString()

  return (
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly', height: 42 }}>
      <HRow>ETH/DAI - 09/07/21</HRow>
      <HRow>{position.side}</HRow>
      <HRow>{position.weightedAvgCost}</HRow>
      <HRow>{position.size}</HRow>
      <HRow>{openCost}</HRow>
      <HRow>{Number(formattedMarketPrice).toFixed(4).toString()}</HRow>
      <HRow style={{ color: pnl.isNegative() ? '#D21349' : '#4EF8C0'}}>
        <span style={{ justifyContent: 'center', display: 'flex', gap: 3}}>
          <img src={pnl.isNegative() ? arrowdown : arrowup}></img>
          {formattedPnl}
        </span>
      </HRow>
    </div>
  )
}

export const Positions = () => {
  const address = useAddress()
  const position = usePositions(address)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 1105, marginTop: 50 }}>
      <Typography style={{ paddingBottom: 18, fontWeight: 'bold', fontSize: 16, alignSelf: 'flex-start' }}>Position</Typography>
      <div style={{ height: 84 }}>
        <div style={{ borderRadius: '16px 16px 0px 0px', backgroundColor: colors.lighterGrey, display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly', height: 42 }}>
          <HRow style={{ color: colors.menu.notSelected }}>Contract</HRow>
          <HRow style={{ color: colors.menu.notSelected }}>Side</HRow>
          <HRow style={{ color: colors.menu.notSelected }}>Avg Price</HRow>
          <HRow style={{ color: colors.menu.notSelected }}>Size</HRow>
          <HRow style={{ color: colors.menu.notSelected }}>Open Cost</HRow>
          <HRow style={{ color: colors.menu.notSelected }}>Market Price</HRow>
          <HRow style={{ color: colors.menu.notSelected }}>PnL</HRow>
        </div>
        {position && <Pos position={position} />}
      </div>
    </div>
  );
}

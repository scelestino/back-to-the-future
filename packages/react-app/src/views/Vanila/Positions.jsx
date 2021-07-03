import React from 'react'
import _Table from '@material-ui/core/Table';
import _TableContainer from '@material-ui/core/TableContainer';
import styled from 'styled-components';
import { TableHead, TableRow as _TableRow, TableCell, Paper, TableBody } from '@material-ui/core'
import { Typography } from 'antd';
import { colors } from './Ticket';

const TableContainer = styled(_TableContainer)`
  background: transparent;
`

const Table = styled(_Table)`
  .MuiPaper-rounded {
    border-radius: 16px;
  }
  .MuiTableCell-root {
    padding: 0;
  }
`

const TableRow = styled(_TableRow)`
  height: 40px;
`

const HRow = styled(Typography)`
  font-size: 14px;
  align-self: center;
  width: 220px;
`

export const Positions = ({ contract, side, size, entryPrice }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 1105, marginTop: 50 }}>
      <Typography style={{ paddingBottom: 18, fontWeight: 'bold', fontSize: 16, alignSelf: 'flex-start' }}>Position</Typography>
      <div style={{ height: 84 }}>
        <div style={{ borderRadius: '16px 16px 0px 0px', backgroundColor: colors.lighterGrey, display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly', height: 42 }}>
          <HRow style={{ color: colors.menu.notSelected }}>Contract</HRow>
          <HRow style={{ color: colors.menu.notSelected }}>Side</HRow>
          <HRow style={{ color: colors.menu.notSelected }}>Entry Price</HRow>
          <HRow style={{ color: colors.menu.notSelected }}>Size</HRow>
          <HRow style={{ color: colors.menu.notSelected }}>PnL</HRow>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly', height: 42 }}>
          <HRow>{contract}</HRow>
          <HRow>{side}</HRow>
          <HRow>{entryPrice}</HRow>
          <HRow>{size}</HRow>
          <HRow>1000.00000 DAI</HRow>
        </div>
      </div>
    </div>
  );
}

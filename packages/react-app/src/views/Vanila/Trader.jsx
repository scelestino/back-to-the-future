import React from 'react';
import _Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import _TableCell from '@material-ui/core/TableCell';
import _TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import styled from 'styled-components'
import { usePositions } from '../../services';
import { Button } from '@material-ui/core'

const TableContainer = styled(_TableContainer)`
  max-width: 1000px;
`

const Table = styled(_Table)`
  min-width: 650px;
  .MuiTableCell-root {
    padding: 0;
  }
`

const TableCell = styled(_TableCell)``

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
    <Positions />
  )

}
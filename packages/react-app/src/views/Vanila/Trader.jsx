import React from 'react';
import _Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
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
`

const Positions = () => {
  const positions = usePositions()
  return (
    <TableContainer component={Paper}>
      <Table aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Contract</TableCell>
            <TableCell align="right">Side</TableCell>
            <TableCell align="right">Size</TableCell>
            <TableCell align="right">Entry Price</TableCell>
            <TableCell align="right">Liquidation Price</TableCell>
            <TableCell align="right">Margin</TableCell>
            <TableCell align="right"></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {positions.map(({ id, contract, side, size, entryPrice, liquidationPrice, margin }) => (
            <TableRow key={id}>
              <TableCell component="th" scope="row">
                {contract}
              </TableCell>
              <TableCell align="right">{side}</TableCell>
              <TableCell align="right">{size}</TableCell>
              <TableCell align="right">{entryPrice}</TableCell>
              <TableCell align="right">{liquidationPrice}</TableCell>
              <TableCell align="right">{margin}</TableCell>
              <TableCell align="right">
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
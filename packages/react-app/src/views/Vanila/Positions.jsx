import React from 'react'
import _Table from '@material-ui/core/Table';
import _TableContainer from '@material-ui/core/TableContainer';
import styled from 'styled-components';
import { TableHead, TableRow, TableCell, Paper, TableBody } from '@material-ui/core'

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

export const Positions = ({ contract, side, size, entryPrice, margin }) => {
  return (
    <TableContainer component={Paper}>
      <Table aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Contract</TableCell>
            <TableCell align="center">Side</TableCell>
            <TableCell align="center">Size</TableCell>
            <TableCell align="center">Entry Price</TableCell>
            <TableCell align="center">Margin</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
        <TableRow key={contract}>
              <TableCell component="th" scope="row">
                {contract}
              </TableCell>
              <TableCell align="center">{side}</TableCell>
              <TableCell align="center">{size}</TableCell>
              <TableCell align="center">{entryPrice}</TableCell>
              <TableCell align="center">{margin}</TableCell>
            </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}
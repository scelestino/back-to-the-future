import React from 'react';
import { Ticket } from './Ticket';
import { Wallet } from './Wallet';

export const Trader = () => {

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
      <Wallet />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, width: 1000, height: '70vh', border: '1px solid grey' }}>
        <Ticket />
      </div>
    </div>
  )

}
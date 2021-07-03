import React from 'react';
import { colors, Ticket } from './Ticket';
import { Wallet } from './Wallet';
import { Positions } from './Positions';

const mockPos = {
  contract: '260601',
  side: 'Long',
  entryPrice: '2134.77 DAI',
  size: '1.31',
}

export const Trader = () => {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Wallet />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '40vh' }}>
        <Ticket />
      </div>
      <div style={{ height: '50%', backgroundColor: colors.backgroundSecondary, display: 'flex', width: '100vw', justifyContent: 'center' }}>
        <Positions {...mockPos} />
      </div>
    </div>
  )

}
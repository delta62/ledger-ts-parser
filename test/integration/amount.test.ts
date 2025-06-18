import { expect, it } from 'vitest'
import { runLedger } from './helpers'

it('should run ledger', async () => {
  let { ledger, lsp } = await runLedger({ payee: 'Test', amount: '100 USD' })
  expect(ledger[0].amount).toBe(100)
  expect(lsp[0].amount).toBe(100)
})

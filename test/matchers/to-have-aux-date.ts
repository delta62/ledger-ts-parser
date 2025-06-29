import { expect } from 'vitest'
import { Transaction } from '../../src/parse-node'
import type { Matcher } from '../types'

let toHaveAuxDate: Matcher = (received: Transaction, date: string) => {
  let parsed = received.auxDate?.date.raw.innerText()
  let pass = parsed === date

  let message = () => {
    return pass
      ? `expected transaction not to have aux date "${date}"`
      : `expected transaction to have aux date "${date}", but got "${parsed}"`
  }

  return {
    pass,
    message,
    actual: parsed,
    expected: date,
  }
}

expect.extend({ toHaveAuxDate })

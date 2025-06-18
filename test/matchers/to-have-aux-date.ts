import { expect } from 'vitest'
import { Transaction } from '../../src'
import type { Matcher } from './types'

let toHaveAuxDate: Matcher = (received: Transaction, date: Date) => {
  let parsed = received.auxDate?.date?.parsed
  let pass = parsed?.getTime() === date.getTime()

  let message = () => {
    return pass
      ? `expected transaction not to have aux date "${date}"`
      : `expected transaction to have aux date "${date}", but got "${received.auxDate?.date.parsed}"`
  }

  return {
    pass,
    message,
    actual: received.date.parsed,
    expected: date,
  }
}

expect.extend({ toHaveAuxDate })

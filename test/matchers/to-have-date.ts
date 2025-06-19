import { expect } from 'vitest'
import { Transaction } from '../../src'

export function toHaveDate(received: Transaction, date: string) {
  let parsed = received.date.raw.toString()
  let pass = parsed === date

  let message = () => {
    return pass
      ? `expected transaction not to have date "${date}"`
      : `expected transaction to have date "${date}", but got "${received.date.raw.toString()}"`
  }

  return {
    pass,
    message,
    actual: received.date.raw.toString(),
    expected: date,
  }
}

expect.extend({ toHaveDate })

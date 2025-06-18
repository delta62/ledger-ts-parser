import { expect } from 'vitest'
import { Transaction } from '../../src'

export function toHaveDate(received: Transaction, date: Date) {
  let parsed = received.date.parsed
  let pass = parsed.getTime() === date.getTime()

  let message = () => {
    return pass
      ? `expected transaction not to have date "${date}"`
      : `expected transaction to have date "${date}", but got "${received.date.parsed}"`
  }

  return {
    pass,
    message,
    actual: received.date.parsed,
    expected: date,
  }
}

expect.extend({ toHaveDate })

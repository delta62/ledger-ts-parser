import { expect } from 'vitest'
import { Transaction } from '../../src'

export function toHavePayee(received: Transaction, name: string) {
  let payeeName = received.payee?.name?.toString()
  let pass = payeeName === name

  let message = () => {
    return pass
      ? `expected transaction not to have payee "${name}"`
      : `expected transaction to have payee "${name}", but got "${received.payee}"`
  }

  return {
    pass,
    message,
    actual: payeeName,
    expected: name,
  }
}

expect.extend({ toHavePayee })

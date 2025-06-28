import { expect } from 'vitest'
import type { Transaction } from '../../src/node'

export function toHavePayee(received: Transaction, name?: string) {
  let payeeName = received.payee?.group.innerText()
  let pass: boolean

  if (name === undefined) {
    pass = received.payee !== undefined
  } else {
    pass = payeeName === name
  }

  let message = () => {
    if (name === undefined) {
      return pass
        ? `expected transaction not to have a payee`
        : `expected transaction to have a payee, but got "${received.payee}"`
    }
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

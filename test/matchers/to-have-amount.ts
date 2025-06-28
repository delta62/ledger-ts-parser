import { expect } from 'vitest'
import type { Posting } from '../../src/node'
import type { Matcher } from '../types'

let toHaveAmount: Matcher = (received: Posting, amount?: string) => {
  if (amount === undefined) {
    let pass = received.amount?.amount !== undefined
    let message = () => {
      if (pass) {
        return `Expected amount to not be defined, but it was.`
      }
      return `Expected amount to be defined, but received ${received.amount?.amount}.`
    }

    return {
      pass,
      message,
      actual: received.amount?.amount,
      expected: undefined,
    }
  }

  let sign = received.amount?.minus ? '-' : ''
  let amountStr = `${sign}${received.amount?.amount?.innerText()}`
  let pass = amountStr === amount

  let message = () => {
    if (pass) {
      return `Expected amount to not be ${amount}, but it was.`
    }
    return `Expected amount to be ${amount}, but received ${amountStr}.`
  }

  return {
    pass,
    message,
    actual: amountStr,
    expected: amount,
  }
}

expect.extend({ toHaveAmount })

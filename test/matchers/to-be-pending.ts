import { expect } from 'vitest'
import type { Transaction } from '../../src'
import type { Matcher } from '../types'

let toBePending: Matcher = (received: Transaction) => {
  let pass = !!received.pending
  let message = pass
    ? () => `expected transaction not to be pending, but it was`
    : () => `expected transaction to be pending, but it was not`

  return {
    pass,
    message,
  }
}

expect.extend({ toBePending })

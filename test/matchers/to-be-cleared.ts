import { expect } from 'vitest'
import type { Transaction } from '../../src'
import type { Matcher } from '../types'

let toBeCleared: Matcher = (received: Transaction) => {
  let pass = !!received.cleared
  let message = pass
    ? () => `expected transaction not to be cleared, but it was`
    : () => `expected transaction to be cleared, but it was not`

  return {
    pass,
    message,
  }
}

expect.extend({ toBeCleared })

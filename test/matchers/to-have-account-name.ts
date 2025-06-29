import type { Posting } from '../../src/node'
import type { Matcher } from '../types'
import { expect } from 'vitest'

export function toHaveAccountName(received: Posting, expectedName: string): ReturnType<Matcher> {
  let pass = received.account.accountName() === expectedName

  return {
    pass,
    message: () =>
      pass
        ? `expected token not to have type ${expectedName}`
        : `expected token to have type ${expectedName}, but got ${received.account.accountName()}`,
    actual: received.account.name.toString(),
    expected: expectedName,
  }
}

expect.extend({ toHaveAccountName })

import type { Posting } from '../../src/node'
import { expect } from 'vitest'

export function toHaveAccountName(received: Posting, expectedName: string) {
  let pass = received.account.name.innerText() === expectedName
  return {
    pass,
    message: () =>
      pass
        ? `expected token not to have type ${expectedName}`
        : `expected token to have type ${expectedName}, but got ${received.account.name.innerText()}`,
    actual: received.account.name.toString(),
    expected: expectedName,
  }
}

expect.extend({ toHaveAccountName })

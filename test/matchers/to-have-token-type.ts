import type { Token } from '../../src/lexer'
import { expect } from 'vitest'

export function toHaveTokenType(received: Token, expectedType: string) {
  let pass = received && received.type === expectedType
  return {
    pass,
    message: () =>
      pass
        ? `expected token not to have type ${expectedType}`
        : `expected token to have type ${expectedType}, but got ${received?.type}`,
    actual: received?.type,
    expected: expectedType,
  }
}

expect.extend({ toHaveTokenType })

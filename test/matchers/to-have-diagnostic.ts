import { expect } from 'vitest'
import type { Matcher } from '../types'
import type { ParserResult } from '../../src/parser'

export type Return = ReturnType<Matcher>

export function toHaveDiagnostic(received: ParserResult, matching?: RegExp): Return {
  let { diagnostics } = received
  let pass: boolean

  if (matching) {
    pass = diagnostics.some(diag => matching.test(diag.message))
  } else {
    pass = diagnostics.length > 0
  }

  let message = () => {
    if (matching) {
      return pass
        ? `Expected ${received} not to have a message matching ${matching}`
        : `Expected ${received} to have a message matching ${matching}, but it did not`
    } else {
      return pass
        ? `Expected ${received} not to have any diagnostics, but it had ${diagnostics.length}`
        : `Expected ${received} to have at least one diagnostic, but it had none`
    }
  }

  return {
    pass,
    message,
    actual: received,
    expected: matching ? `a diagnostic matching ${matching}` : 'any diagnostic',
  }
}

expect.extend({ toHaveDiagnostic })

import { expect } from 'vitest'
import type { Posting, Transaction } from '../../src'
import type { Matcher } from '../types'

export type Return = ReturnType<Matcher>

export function toHaveComment(received: Posting | Transaction, matching?: RegExp): Return {
  let comments = received.comments
  let pass: boolean

  if (matching) {
    pass = comments.some(comment => matching.test(comment.text))
  } else {
    pass = comments.length > 0
  }

  let message = () => {
    if (matching) {
      return pass
        ? `Expected ${received} not to have a comment matching ${matching}`
        : `Expected ${received} to have a comment matching ${matching}, but it did not`
    } else {
      return pass
        ? `Expected ${received} not to have any comments, but it had ${comments.length}`
        : `Expected ${received} to have at least one comment, but it had none`
    }
  }

  return {
    pass,
    message,
    actual: received,
    expected: matching ? `a comment matching ${matching}` : 'any comment',
  }
}

expect.extend({ toHaveComment })

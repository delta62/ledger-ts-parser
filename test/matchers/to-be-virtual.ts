import { SurroundedBy, type Posting } from '../../src/node'
import type { Matcher } from '../types'
import { expect } from 'vitest'

export interface Options {
  balanced: boolean
}

export function toBeVirtual(received: Posting, opts: Options): ReturnType<Matcher> {
  let account = received.account.name
  let virtualType: 'balanced' | 'unbalanced' | undefined =
    account instanceof SurroundedBy ? (account.open.type === 'lparen' ? 'unbalanced' : 'balanced') : undefined
  let pass: boolean

  if (opts.balanced) {
    pass = virtualType === 'balanced'
  } else {
    pass = virtualType === 'unbalanced'
  }

  let message = () => {
    let expectedName = opts.balanced ? 'balanced virtual account' : 'unbalanced virtual account'
    return pass
      ? `expected token not to be a ${expectedName}`
      : `expected token to be a ${expectedName}, but got "${received.account.accountName()}"`
  }

  return {
    pass,
    message,
  }
}

expect.extend({ toBeVirtual })

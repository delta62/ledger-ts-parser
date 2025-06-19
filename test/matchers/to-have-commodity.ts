import { expect } from 'vitest'
import { Posting } from '../../src'
import type { Matcher } from './types'

export type CommodityPosition = 'pre' | 'post'

export interface Options {
  position: CommodityPosition
}

export type Return = ReturnType<Matcher>

export function toHaveCommodity(received: Posting, commodity?: string, opts?: Options): Return {
  if (commodity === undefined || opts === undefined) {
    let pass = received.amount?.commodity !== undefined
    let message = () => {
      if (pass) {
        return `Expected commodity to not be defined, but it was.`
      }
      return `Expected commodity to be defined, but received ${received.amount?.commodity}.`
    }

    return {
      pass,
      message,
      actual: received.amount?.commodity,
      expected: undefined,
    }
  }

  let parsed = received.amount?.commodity.toString()
  let position = received.amount?.unitPlacement
  let pass = position === opts.position && parsed === commodity

  let message = () => {
    if (pass) {
      return `Expected commodity to not be ${commodity} at position ${opts.position}, but it was.`
    }
    return `Expected commodity to be ${commodity} at position ${opts.position}, but received ${parsed} at position ${position}.`
  }

  return {
    pass,
    message,
    actual: parsed,
    expected: commodity,
  }
}

expect.extend({ toHaveCommodity })

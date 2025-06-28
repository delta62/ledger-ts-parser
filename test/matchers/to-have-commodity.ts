import { expect } from 'vitest'
import type { Posting } from '../../src/node'
import type { Matcher } from '../types'

export type CommodityPosition = 'pre' | 'post'
export type Return = ReturnType<Matcher>

export interface Options {
  position: CommodityPosition
}

export function toHaveCommodity(received: Posting, commodity?: string, opts?: Options): Return {
  let usedCommodity = (received.amount?.preCommodity ?? received.amount?.postCommodity)?.innerText()
  let usedPosition = received.amount?.preCommodity ? 'pre' : received.amount?.postCommodity ? 'post' : undefined

  if (commodity === undefined || opts === undefined) {
    let pass = usedCommodity !== undefined
    let message = () => {
      return pass
        ? 'Expected commodity to not be defined, but it was.'
        : 'Expected commodity to be defined, but it was not.'
    }

    return {
      pass,
      message,
      actual: usedCommodity,
      expected: undefined,
    }
  }

  let pass = usedCommodity === commodity && usedPosition === opts.position
  let message = () => {
    return pass
      ? `Expected commodity to not be "${commodity}" at position "${opts.position}", but it was.`
      : `Expected commodity to be "${commodity}" at position "${opts.position}", but it was "${usedCommodity}" at position "${usedPosition}".`
  }

  return {
    pass,
    message,
    actual: usedCommodity,
    expected: commodity,
  }
}

expect.extend({ toHaveCommodity })

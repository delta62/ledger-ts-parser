import { expect } from 'vitest'
import { SymbolTable } from '../../src/symbol-table'
import { Location } from '../../src'

export function toHaveSymbol(received: SymbolTable, key: string, value?: Location) {
  let pass: boolean

  if (value) {
    pass = received.has(key) && received.get(key) === value
  } else {
    pass = received.has(key)
  }

  let message = () => {
    if (value) {
      return pass
        ? `expected symbol table not to have symbol "${key}" with value ${value}`
        : `expected symbol table to have symbol "${key}" with value ${value}, but got ${received.get(key)}`
    } else {
      return pass
        ? `expected symbol table not to have symbol "${key}"`
        : `expected symbol table to have symbol "${key}", but it does not exist`
    }
  }

  if (value) {
    return {
      pass,
      message,
      actual: received.get(key),
      expected: value,
    }
  }

  return {
    pass,
    message,
  }
}

expect.extend({ toHaveSymbol })

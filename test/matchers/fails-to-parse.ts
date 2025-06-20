import { expect } from 'vitest'
import { Lexer } from '../../src/lexer'
import { Parser } from '../../src/parser'

export function failsToParse(received: string, messageIncludes: RegExp) {
  let lexer = new Lexer(received)
  let parser = new Parser(lexer)
  let result = parser.parse()
  let parseSuccess = result.diagnostics.length === 0
  let pass: boolean

  if (parseSuccess) {
    pass = false
  } else {
    pass = result.diagnostics.some(diag => messageIncludes.test(diag.message))
  }

  let message = () => {
    if (messageIncludes) {
      if (parseSuccess) {
        return `expected input to fail parsing with message including "${messageIncludes}", but it did not fail`
      } else {
        let errCount = result.diagnostics.length
        return (
          `expected input to fail parsing with message including "${messageIncludes}", but it failed with ${errCount} error(s) that did not match:\n` +
          result.diagnostics.map(d => `- ${d.message}`).join('\n')
        )
      }
    } else {
      return pass ? `expected input not to fail parsing` : `expected input to fail parsing, but it did not`
    }
  }

  return {
    pass,
    message,
  }
}

expect.extend({ failsToParse })

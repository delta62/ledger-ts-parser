import { Location, getLocation } from './location'
import type { Token, MooTokenType } from './lexer'

export type ErrorCode = 'UNEXPECTED_TOKEN' | 'UNEXPECTED_EOF' | 'INVALID_DATE' | 'INVALID_ACCOUNT' | 'INVALID_INTEGER'

export class ParseError extends Error {
  static unexpectedToken(saw: Token, expected?: MooTokenType | MooTokenType[]): ParseError {
    if (!Array.isArray(expected)) {
      if (expected) {
        expected = [expected]
      } else {
        expected = []
      }
    }

    let location = getLocation(saw)
    let message = `Unexpected token '${saw.value}'`

    if (expected.length === 1) {
      message += `, expected '${expected[0]}'`
    } else if (expected.length > 1) {
      message += `, expected one of ${expected.map(x => `'${x}'`).join(', ')}`
    }

    return new ParseError(message, 'UNEXPECTED_TOKEN', location)
  }

  static unexpectedEOF(location: Location, expected: MooTokenType[]): ParseError {
    let message = `Unexpected end of file`

    if (expected.length === 1) {
      message += `, expected '${expected[0]}'`
    } else if (expected.length > 1) {
      message += `, expected one of ${expected.map(x => `'${x}'`).join(', ')}`
    }

    return new ParseError(message, 'UNEXPECTED_EOF', location)
  }

  static invalidInteger(saw: Token): ParseError {
    let location = getLocation(saw)
    let message = `Invalid integer '${saw.value}'`
    return new ParseError(message, 'INVALID_INTEGER', location)
  }

  constructor(message: string, public code: ErrorCode, public location: Location) {
    super(message)
    this.name = 'ParseError'
  }
}

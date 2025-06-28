import { Location, getLocation } from './location'
import type { Token, TokenType } from './lexer'

export type ErrorCode =
  | 'UNEXPECTED_TOKEN'
  | 'UNEXPECTED_EOF'
  | 'INVALID_DATE'
  | 'INVALID_ACCOUNT'
  | 'INVALID_INTEGER'
  | 'LEADING_SPACE'

export class ParseError extends Error {
  static unexpectedToken(saw: Token, expected?: TokenType | TokenType[]): ParseError {
    let expectedArray: TokenType[]
    if (Array.isArray(expected)) {
      expectedArray = expected
    } else if (expected) {
      expectedArray = [expected]
    } else {
      expectedArray = []
    }

    let location = getLocation(saw)
    let message = `Unexpected token '${saw.innerText()}'`

    if (expectedArray.length === 1) {
      message += `, expected '${expectedArray[0]}'`
    } else if (expectedArray.length > 1) {
      message += `, expected one of ${expectedArray.map(x => `'${x}'`).join(', ')}`
    }

    return new ParseError(message, 'UNEXPECTED_TOKEN', location)
  }

  static unexpectedEOF(location: Location, expected?: TokenType[]): ParseError {
    let message = `Unexpected end of file`

    if (expected?.length === 1) {
      message += `, expected '${expected[0]}'`
    } else if (expected?.length ?? 0 > 1) {
      message += `, expected one of ${expected?.map(x => `'${x}'`).join(', ')}`
    }

    return new ParseError(message, 'UNEXPECTED_EOF', location)
  }

  static leadingSpace(saw: Token): ParseError {
    let location = getLocation(saw)
    let message = `Unexpected leading space at beginning of line '${saw.innerText()}'`
    return new ParseError(message, 'LEADING_SPACE', location)
  }

  static invalidInteger(saw: Token): ParseError {
    let location = getLocation(saw)
    let message = `Invalid integer '${saw.innerText()}'`
    return new ParseError(message, 'INVALID_INTEGER', location)
  }

  constructor(message: string, public code: ErrorCode, public location: Location) {
    super(message)
    this.name = 'ParseError'
  }
}

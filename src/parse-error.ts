import type { Span } from './location'
import type { TokenType } from './lexer'
import type { Token } from './token'

export type ErrorCode =
  | 'UNEXPECTED_TOKEN'
  | 'UNEXPECTED_EOF'
  | 'INVALID_DATE'
  | 'INVALID_ACCOUNT'
  | 'INVALID_INTEGER'
  | 'LEADING_SPACE'

export class ParseError extends Error {
  static unexpectedToken(saw: Token<TokenType>, expected?: TokenType | TokenType[]): ParseError {
    let expectedArray: TokenType[]
    if (Array.isArray(expected)) {
      expectedArray = expected
    } else if (expected) {
      expectedArray = [expected]
    } else {
      expectedArray = []
    }

    let message = `Unexpected token '${saw.innerText()}'`
    if (expectedArray.length === 1) {
      message += `, expected '${expectedArray[0]}'`
    } else if (expectedArray.length > 1) {
      message += `, expected one of ${expectedArray.map(x => `'${x}'`).join(', ')}`
    }

    return new ParseError(message, 'UNEXPECTED_TOKEN', saw.span)
  }

  static unexpectedEOF(span: Span, expected?: TokenType[]): ParseError {
    let message = `Unexpected end of file`

    if (expected?.length === 1) {
      message += `, expected '${expected[0]}'`
    } else if (expected?.length ?? 0 > 1) {
      message += `, expected one of ${expected?.map(x => `'${x}'`).join(', ')}`
    }

    return new ParseError(message, 'UNEXPECTED_EOF', span)
  }

  static leadingSpace(saw: Token<TokenType>): ParseError {
    let message = `Unexpected leading space at beginning of line '${saw.innerText()}'`
    return new ParseError(message, 'LEADING_SPACE', saw.span)
  }

  static invalidInteger(saw: Token<TokenType>): ParseError {
    let message = `Invalid integer '${saw.innerText()}'`
    return new ParseError(message, 'INVALID_INTEGER', saw.span)
  }

  constructor(message: string, public code: ErrorCode, public span: Span) {
    super(message)
    this.name = 'ParseError'
  }
}

import moo from 'moo'
import { Token } from './token'

export const LEDGER_RULES = {
  newline: { match: /\r?\n/, lineBreaks: true },
  ws: /[ \t]+/,
  comment: /(?:(?:;[^\n]*)|(?:^[;#%*|]))[^\n]*/,
  string: /"[^"\n]*"/,
  number: /\d+(?:[.,]\d+)*(?:[.,]\d+)?/,
  equal: /=/,
  tilde: /~/,
  lparen: /\(/,
  rparen: /\)/,
  lbrace: /{/,
  rbrace: /}/,
  lbracket: /\[/,
  rbracket: /\]/,
  hyphen: /-/,
  slash: /\//,
  star: /\*/,
  bang: /!/,
  colon: /:/,
  at: /@/,
  identifier: /[A-Za-z]+/,
  symbol: /[^\r\n\s\t]/,
}

// "raw" tokens come directly from moo, and include whitespace
type RawRules = typeof LEDGER_RULES
type RawTokenType = keyof RawRules
type RawToken = moo.Token<RawTokenType>

// publicly exported rules are wrapped in the Token<T> class, and whitespace is abstracted away. A newline token is added for ease of parsing dowpstream.
export type TokenType = Exclude<keyof RawRules, 'ws'> | 'eof'

export class Lexer {
  private lexer: moo.Lexer<RawRules>
  private _peek?: RawToken
  private lookahead?: Token<TokenType>
  private lookbehind?: Token<TokenType>

  constructor(input: string) {
    this.lexer = moo.compile(LEDGER_RULES)
    this.lexer.reset(input)
  }

  public peek(): Token<TokenType> {
    if (!this.lookahead) {
      this.lookahead = this.getNext() ?? this.eofToken()
    }

    return this.lookahead
  }

  public previous(): Token<TokenType> | undefined {
    return this.lookbehind
  }

  public next(): Token<TokenType> {
    if (this.lookahead) {
      let t = this.lookahead
      this.lookahead = undefined
      this.lookbehind = t
      return t
    }

    let next = this.getNext()
    this.lookbehind = next
    return next
  }

  public hasNext(): boolean {
    return this.peek().type !== 'eof'
  }

  public [Symbol.iterator](): Iterator<Token<TokenType>> {
    let done = false

    return {
      next: () => {
        if (done) {
          return { value: undefined, done: true }
        } else {
          let token = this.next()
          done = token.type === 'eof'
          return { value: token, done: false }
        }
      },
    }
  }

  private getNext(): Token<TokenType> {
    let next = this._peek ?? this.lexer.next()

    if (!next) {
      return this.eofToken()
    }

    let leadingSpace: RawToken | undefined
    let trailingSpace: RawToken | undefined

    if (next.type === 'ws') {
      leadingSpace = next
      next = this.lexer.next()
      if (!next) {
        return this.eofToken(leadingSpace)
      }
    }

    // SAFETY: The if block above ensured this can't be `ws`.
    let nextNonWs = next as moo.Token<Exclude<RawTokenType, 'ws'>>

    this._peek = this.lexer.next()
    if (this._peek?.type === 'ws') {
      trailingSpace = this._peek
      this._peek = undefined
    }

    return new Token(nextNonWs, leadingSpace?.text, trailingSpace?.text)
  }

  private eofToken(leadingSpace?: RawToken): Token<TokenType> {
    let offset = this.lookbehind?.span[0] ?? 0
    let leading = leadingSpace?.text
    return Token.virtual<TokenType>('eof', offset, leading)
  }
}

export default Lexer

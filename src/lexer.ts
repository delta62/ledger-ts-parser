import moo from 'moo'

const LEDGER_RULES = {
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
  hyphen: /-/,
  slash: /\//,
  star: /\*/,
  bang: /!/,
  colon: /:/,
  at: /@/,
  identifier: /[A-Za-z]+/,
  symbol: /[^\r\n\s\t]/,
  eof: /[^\s\S]/,
}

export type TokenType = keyof typeof LEDGER_RULES
export type Token<T extends TokenType = TokenType> = moo.Token<typeof LEDGER_RULES, T>

export class Lexer implements Iterable<Token> {
  private lexer: moo.Lexer<typeof LEDGER_RULES>
  private lookahead: Token | undefined
  private lookbehind: Token | undefined

  constructor(input: string) {
    this.lexer = moo.compile(LEDGER_RULES)
    this.lexer.reset(input)
  }

  public peek(): Token {
    if (!this.lookahead) {
      this.lookahead = this.lexer.next()
    }

    return this.lookahead ?? this.eofToken()
  }

  public previous(): Token | undefined {
    return this.lookbehind
  }

  public next(): Token {
    if (this.lookahead) {
      let t = this.lookahead
      this.lookahead = undefined
      this.lookbehind = t
      return t
    }

    let next = this.lexer.next()
    if (next) {
      this.lookbehind = next
      return next
    } else {
      return this.eofToken()
    }
  }

  public hasNext(): boolean {
    return this.peek().type !== 'eof'
  }

  public [Symbol.iterator](): Iterator<Token> {
    let done = false

    return {
      next: () => {
        let token = this.next()
        if (done) {
          return { value: undefined, done: true }
        } else {
          done = token.type === 'eof'
          return { value: token, done: false }
        }
      },
    }
  }

  private eofToken(): Token<'eof'> {
    let line = this.lookbehind?.line ?? 1
    let col = this.lookbehind?.col ?? 1
    let offset = this.lookbehind?.offset ?? 0
    return { type: 'eof', value: '', text: '', line, col, offset, lineBreaks: 0 }
  }
}

export default Lexer

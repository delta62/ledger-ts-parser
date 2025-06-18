import moo from 'moo'

function parseNumber(value: string): number {
  // If the string contains a comma but no period, treat comma as decimal separator (European style)
  if (value.includes(',') && !value.includes('.')) {
    // Remove thousands separators (periods), replace decimal comma with dot
    value = value.replace(/\./g, '').replace(',', '.')
    return parseFloat(value)
  }
  // If the string contains both comma and period, or only period, treat period as decimal separator (US style)
  // Remove thousands separators (commas)
  value = value.replace(/,/g, '')
  return parseFloat(value)
}

const LEDGER_RULES = {
  newline: { match: /\r?\n/, lineBreaks: true },
  ws: /[ \t]+/,
  comment: /(?:(?:^;)|(?:^[;#%*|]))[^\n]*/,
  string: /"[^"\n]*"/,
  number: { match: /\d+(?:[.,]\d+)*(?:[.,]\d+)?/, value: parseNumber },
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
}

export type TokenType = keyof typeof LEDGER_RULES
export type Token<T extends TokenType = TokenType> = moo.Token<typeof LEDGER_RULES, T>

export class Lexer implements Iterable<Token> {
  private lexer: moo.Lexer<typeof LEDGER_RULES>
  private _peek: Token | undefined

  constructor(input: string) {
    this.lexer = moo.compile(LEDGER_RULES)
    this.lexer.reset(input)
  }

  public reset(input: string) {
    this._peek = undefined
    this.lexer.reset(input)
  }

  public peek(): Token | undefined {
    if (!this._peek) {
      this._peek = this.lexer.next() as Token | undefined
    }

    return this._peek
  }

  public next(): Token | undefined {
    if (this._peek) {
      let t = this._peek
      this._peek = undefined
      return t
    }

    return this.lexer.next() as Token | undefined
  }

  public hasNext(): boolean {
    this.peek()
    return !!this._peek
  }

  public [Symbol.iterator](): Iterator<Token> {
    return {
      next: () => {
        let token = this.next()
        if (token) {
          return { value: token, done: false }
        } else {
          return { value: undefined, done: true }
        }
      },
    }
  }
}

export default Lexer

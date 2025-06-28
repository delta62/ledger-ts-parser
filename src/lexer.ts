import moo from 'moo'
import { Location } from './location'

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
}

type MooTokenType = keyof typeof LEDGER_RULES
type MooToken<T extends MooTokenType = MooTokenType> = moo.Token<typeof LEDGER_RULES, T>

export type TokenType = Omit<MooTokenType, 'ws'> | 'eof'
export class Token<T extends TokenType = TokenType> {
  private leadingSpace: string
  private text: string
  public readonly trailingSpace: string
  public readonly location: Location
  public readonly type: T

  public static virtual<T extends TokenType = TokenType>(
    type: T,
    location: Location,
    leadingSpace?: MooToken<'ws'>
  ): Token<T> {
    let fakeToken = {
      type: type as MooTokenType,
      text: '',
      value: '',
      lineBreaks: 0,
      line: location.line,
      col: location.column,
      offset: location.offset,
    }

    let t = new Token<T>(fakeToken)

    t.leadingSpace = leadingSpace?.text ?? ''
    return t
  }

  constructor(mooToken: MooToken, leadingSpace?: MooToken<'ws'>, trailingSpace?: MooToken<'ws'>) {
    this.type = mooToken.type as T
    this.location = { line: mooToken.line, column: mooToken.col, offset: mooToken.offset }
    this.text = mooToken.text
    this.leadingSpace = leadingSpace?.text ?? ''
    this.trailingSpace = trailingSpace?.text ?? ''
  }

  public innerText(): string {
    return this.text
  }

  public outerText(): string {
    return this.leadingSpace + this.text + this.trailingSpace
  }

  public innerLength(): number {
    return this.text.length
  }

  public outerLength(): number {
    return this.text.length + this.leadingSpace.length + this.trailingSpace.length
  }

  public beginsWithSpace(): boolean {
    return this.leadingSpace.length > 0
  }

  public endsWithSpace(): boolean {
    return this.trailingSpace.length > 0
  }

  public beginsWithHardSpace(): boolean {
    return isHardSpace(this.leadingSpace)
  }

  public endsWithHardSpace(): boolean {
    return isHardSpace(this.trailingSpace)
  }
}

function isHardSpace(s: string): boolean {
  return /\t| {2,}/.test(s)
}

export class Lexer {
  private lexer: moo.Lexer<typeof LEDGER_RULES>
  private _peek?: MooToken
  private lookahead?: Token
  private lookbehind?: Token

  constructor(input: string) {
    this.lexer = moo.compile(LEDGER_RULES)
    this.lexer.reset(input)
  }

  public peek(): Token {
    if (!this.lookahead) {
      this.lookahead = this.getNext() ?? this.eofToken()
    }

    return this.lookahead
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

    let next = this.getNext()
    this.lookbehind = next
    return next
  }

  public hasNext(): boolean {
    return this.peek().type !== 'eof'
  }

  public [Symbol.iterator](): Iterator<Token> {
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

  private getNext(): Token {
    let next = this._peek ?? this.lexer.next()

    if (!next) {
      return this.eofToken()
    }

    let leadingSpace: MooToken<'ws'> | undefined
    let trailingSpace: MooToken<'ws'> | undefined

    if (next.type === 'ws') {
      leadingSpace = next as MooToken<'ws'>
      next = this.lexer.next()
      if (!next) {
        return this.eofToken(leadingSpace)
      }
    }

    this._peek = this.lexer.next()
    if (this._peek?.type === 'ws') {
      trailingSpace = this._peek as MooToken<'ws'>
      this._peek = undefined
    }

    return new Token(next, leadingSpace, trailingSpace)
  }

  private eofToken(leadingSpace?: MooToken<'ws'>): Token<'eof'> {
    let line = this.lookbehind?.location.line ?? 1
    let column = this.lookbehind?.location.column ?? 1
    let offset = this.lookbehind?.location.offset ?? 0
    let location: Location = { line, column, offset }

    return Token.virtual('eof', location, leadingSpace)
  }
}

export default Lexer

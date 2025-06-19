import Lexer, { Token, TokenType } from './lexer'
import { SymbolTable } from './symbol-table'
import { ParseError } from './parse-error'
import { Result } from './result'
import {
  Transaction,
  AST,
  ASTChild,
  Location,
  DateNode,
  Payee,
  AuxDate,
  Comment,
  Posting,
  Code,
  Amount,
  AccountRef,
} from './types'
import { Group } from './group'
import { ok } from './util'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TupleToUnion<T extends readonly any[]> = T[number]

function getLocation(token: Token): Location {
  return {
    line: token.line,
    column: token.col,
    offset: token.offset,
  }
}

export interface ParserResult {
  ast: AST
  diagnostics: ParseError[]
  accounts: SymbolTable
  payees: SymbolTable
}

export class Parser {
  private accounts = new SymbolTable()
  private payees = new SymbolTable()
  private diagnostics: ParseError[] = []
  private previous: Token | undefined
  private children: ASTChild[] = []
  private panic = false

  constructor(private lexer: Lexer) {}

  public parse(): ParserResult {
    while (this.lexer.hasNext()) {
      let nextType = this.peek()?.type

      if (['newline', 'ws', 'comment'].includes(nextType ?? '')) {
        this.previous = this.next()
        continue
      }

      if (this.panic) {
        // Panic mode: skip tokens until a safe point
        if (this.previous?.type === 'newline') {
          this.panic = false
        } else {
          this.next()
          continue
        }
      }

      switch (nextType) {
        case 'number':
          this.tryParse(this.parseTransaction.bind(this))
          break
        default:
          throw new ParseError(
            `Unexpected ${nextType} (text=${this.peek()?.text})`,
            'UNEXPECTED_TOKEN',
            this.getPreviousLocation()
          )
      }
    }

    return {
      accounts: this.accounts,
      ast: { children: this.children },
      diagnostics: this.diagnostics,
      payees: this.payees,
    }
  }

  private parseTransaction(): Result<Transaction, ParseError> {
    let parsedDate = this.parseDate()
    if (parsedDate.isErr()) {
      return parsedDate
    }

    let date = parsedDate.unwrap()
    let auxDate: AuxDate | undefined
    let pending: Token<'bang'> | undefined
    let cleared: Token<'star'> | undefined
    let code: Code | undefined
    let payee: Payee | undefined

    if (this.peekType('equal')) {
      let equal = this.next() as Token<'equal'>
      let date = this.parseDate()
      if (date.isErr()) {
        return date
      }

      auxDate = {
        type: 'auxDate',
        equal: equal,
        date: date.unwrap(),
      }
    }

    if (this.peekType('ws')) {
      this.skipWhitespace()

      let flag = this.skipIf(['bang', 'star'])

      this.skipWhitespace()

      if (flag) {
        if (flag.type === 'bang') {
          pending = flag as Token<'bang'>
          cleared = this.skipIf('star')
        } else if (flag.type === 'star') {
          cleared = flag as Token<'star'>
          pending = this.skipIf('bang')
        }
        this.skipWhitespace()
      }

      if (this.peekType('lparen')) {
        let parsedCode = this.parseCode()
        if (parsedCode.isErr()) {
          return parsedCode
        }
        code = parsedCode.unwrap()
        this.skipWhitespace()
      }

      let payeeName = this.slurp()
      let payeeText = payeeName.toString().trim()

      if (payeeText) {
        payee = { type: 'payee', name: payeeName }
        if (!this.payees.has(payeeText)) {
          this.payees.add(payeeText, payee.name.location)
        }
      }
    }

    let newline = this.newlineOrEof()
    if (newline.isErr()) {
      return newline
    }

    let comments: Comment[] = []
    let postings: Posting[] = []

    while (this.peekType('ws')) {
      this.next() // Skip whitespace

      if (this.peekType('comment')) {
        let commentToken = this.next() as Token<'comment'>
        comments.push({ type: 'comment', comment: commentToken })
        continue
      } else if (this.peekType('newline')) {
        this.next() // Skip newline
        break
      } else {
        let posting = this.parsePosting()
        if (posting.isErr()) {
          return Result.err(posting.unwrapErr())
        }
        postings.push(posting.unwrap())
      }
    }

    let tx: Transaction = {
      type: 'transaction',
      date,
      comments,
      auxDate,
      cleared,
      pending,
      code,
      payee,
      postings,
    }

    return Result.ok(tx)
  }

  private parseCode(): Result<Code, ParseError> {
    return this.expect('lparen')
      .map(lparen => {
        this.skipWhitespace()
        let contents = this.slurpUntil('rparen')
        return { lparen, contents }
      })
      .andThen(({ lparen, contents }) => {
        return this.expect('rparen').map(rparen => ({ lparen, contents, rparen }))
      })
      .map(({ lparen, contents, rparen }) => ({
        type: 'code',
        lparen,
        contents,
        rparen,
      }))
  }

  private parseDate(): Result<DateNode, ParseError> {
    return Result.all(
      () => this.expectInteger(),
      () => this.expect(['slash', 'hyphen']),
      () => this.expectInteger(),
      (_, sep) => {
        if (this.peekType(sep.type)) {
          return this.expect(['slash', 'hyphen'])
        } else {
          return Result.ok(undefined)
        }
      },
      (_n1, _s1, _n2, sep) => {
        if (sep) {
          return this.expectInteger()
        } else {
          return Result.ok(undefined)
        }
      }
    ).map(tokens => {
      let raw = new Group(...tokens.filter(t => t !== undefined))
      return { type: 'date', raw }
    })
  }

  private parsePosting(): Result<Posting, ParseError> {
    let amount: Amount | undefined
    let accountName = this.slurpUntil('ws', { and: isBigSpace })

    if (accountName.length === 0) {
      return Result.err(
        new ParseError('Expected account name, but found nothing', 'INVALID_ACCOUNT', this.getPreviousLocation())
      )
    }

    let account: AccountRef = {
      type: 'accountRef',
      name: accountName,
    }

    if (!this.accounts.has(accountName.toString())) {
      this.accounts.add(accountName.toString(), accountName.location)
    }

    this.skipWhitespace()
    if (this.hasNext() && !this.peekType('newline')) {
      let parsedAmount = this.parseAmount()
      if (parsedAmount.isErr()) {
        return parsedAmount
      }
      amount = parsedAmount.unwrap()
    }

    this.newlineOrEof().unwrap()

    // TODO: comments
    let comments: Comment[] = []

    return Result.ok({ type: 'posting', comments, account, amount })
  }

  private parseAmount(): Result<Amount, ParseError> {
    let commodity: Group
    let unitPlacement: Amount['unitPlacement']
    let amount: Token<'number'> | undefined
    let minus = this.skipIf('hyphen')

    if (this.peekType('number')) {
      let numberToken = this.next() as Token<'number'>
      unitPlacement = 'post'
      amount = numberToken
    } else {
      unitPlacement = 'pre'
    }

    this.skipWhitespace()

    commodity = this.slurpUntil(['hyphen', 'number'])

    if (!minus) {
      minus = this.skipIf('hyphen')
    }

    if (!amount) {
      let parsedAmount = this.expect('number')
      if (parsedAmount.isErr()) {
        return parsedAmount
      }
      amount = parsedAmount.unwrap()
    }

    return Result.ok({
      type: 'amount',
      minus,
      amount,
      commodity,
      unitPlacement,
    })
  }

  private tryParse(fn: () => Result<ASTChild, ParseError>) {
    let result = fn()
    if (result.isErr()) {
      this.diagnostics.push(result.unwrapErr())
      this.panic = true
    } else {
      this.children.push(result.unwrap())
    }
  }

  private skipIf(): Token | undefined
  private skipIf<T extends TokenType>(type: T): Token<T> | undefined
  private skipIf<T extends readonly TokenType[]>(types: T): Token<TupleToUnion<T>> | undefined
  private skipIf(types?: TokenType | TokenType[]): Token | undefined {
    let nextType = this.peek()?.type
    if (!nextType) {
      return undefined
    }

    let acceptedTypes = Array.isArray(types) ? types : [types]

    if (acceptedTypes.includes(nextType)) {
      return this.next()
    }

    return undefined
  }

  private peekType(type: TokenType): boolean {
    return this.lexer.peek()?.type === type
  }

  private next(): Token | undefined {
    let next = this.lexer.next()
    this.previous = next
    return next
  }

  private hasNext(): boolean {
    return this.lexer.hasNext()
  }

  private peek(): Token | undefined {
    return this.lexer.peek()
  }

  private getPreviousLocation(): Location | undefined {
    if (this.previous) {
      return getLocation(this.previous)
    }
  }

  private expect<T extends TokenType>(type: T): Result<Token<T>, ParseError>
  private expect<T extends readonly TokenType[]>(types: T): Result<Token<TupleToUnion<T>>, ParseError>
  private expect(type: TokenType | TokenType[]): Result<Token, ParseError> {
    let next = this.next()

    if (!Array.isArray(type)) {
      type = [type]
    }

    if (!next) {
      return Result.err(
        new ParseError(`Expected ${type}, but reached end of input`, 'UNEXPECTED_EOF', this.getPreviousLocation())
      )
    }

    if (!type.includes(next.type)) {
      return Result.err(
        new ParseError(`Expected ${type}, but found ${next.type}`, 'UNEXPECTED_TOKEN', this.getPreviousLocation())
      )
    }

    return Result.ok(next)
  }

  private newlineOrEof(): Result<void, ParseError> {
    let next = this.next()
    if (!next || next.type === 'newline') {
      return Result.ok(undefined)
    }

    let err = new ParseError(
      `Expected newline or end of file, but found ${next.type}`,
      'UNEXPECTED_TOKEN',
      getLocation(next)
    )
    return Result.err(err)
  }

  /**
   * Special form of `expect` that expects an integer token. Similar to `expect('number')`, but numeric tokens may not be decimals, NaN, or Infinity.
   * @returns A Result containing the token if it is an integer, or a ParseError if it is not.
   */
  private expectInteger(): Result<Token<'number'>, ParseError> {
    return this.expect('number').andThen(token => {
      if (!Number.isInteger(parseFloat(token.value))) {
        return Result.err(new ParseError(`Expected integer, but found ${token.text}`, 'INVALID_INTEGER'))
      }

      return Result.ok(token)
    })
  }

  /**
   * Skips whitespace tokens in the input stream. This does not include newlines.
   */
  private skipWhitespace() {
    while (this.peekType('ws')) {
      this.next()
    }
  }

  /**
   * Consumes tokens until a newline or the end of file is encountered.
   * @returns All tokens consumed
   */
  private slurp(): Group {
    return this.slurpUntil('newline')
  }

  /**
   * Consumes tokens until the specified type is encountered, a newline, or the
   * end of file.
   * @param type The type of token to consume until
   * @param predicate An optional predicate function to filter tokens of the
   *    specified type. If a token matches the given type but fails the
   *    predicate, it will be included in the consumed tokens and processing
   *    will continue. By default, every token passes the predicate.
   * @returns All tokens consumed until the specified type, newline, or end of
   *    file is encountered
   */
  private slurpUntil(type: TokenType | TokenType[], opts?: { and: (t: Token) => boolean }): Group {
    let tokens = new Group()
    let predicate = opts?.and ?? ok
    let next = this.peek()

    if (!Array.isArray(type)) {
      type = [type]
    }

    while (next && (!type.includes(next.type) || !predicate(next)) && next.type !== 'newline') {
      tokens.push(this.next()!)
      next = this.peek()
    }

    return tokens
  }
}

/**
 * Checks if the token is a "big space", which is defined as two or more spaces or a tab. This is important for postings, which must separate account names from amounts in this way
 * @param token The token to check. It is assumed to be a whitespace token.
 * @returns True if the token is a big space, false otherwise
 */
function isBigSpace(token: Token): boolean {
  return /^ {2,}|\t$/.test(token.text)
}

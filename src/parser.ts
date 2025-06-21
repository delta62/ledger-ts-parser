import Lexer, { Token, TokenType } from './lexer'
import { SymbolTable } from './symbol-table'
import { ParseError } from './parse-error'
import { Result } from './result'
import {
  Transaction,
  AST,
  ASTChild,
  DateNode,
  Payee,
  AuxDate,
  Comment,
  Posting,
  Code,
  Amount,
  AccountRef,
  Directive,
  SubDirective,
  End,
} from './types'
import { Group, GroupBuilder } from './group'
import { ok } from './util'
import { Location, getLocation, defaultLocation } from './location'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TupleToUnion<T extends readonly any[]> = T[number]

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
      let nextType: TokenType = this.peek()!.type

      if (this.peekType(['newline', 'ws'])) {
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

      if (this.previous?.type === 'ws') {
        this.panic = true
        this.diagnostics.push(ParseError.unexpectedToken(this.previous))
        this.next()
      }

      switch (nextType) {
        case 'number':
          this.tryParse(this.parseTransaction.bind(this))
          break
        case 'comment':
          this.tryParse(this.parseComment.bind(this))
          break
        case 'identifier':
          this.tryParse(this.parseDirective.bind(this))
          break
        default:
          this.panic = true
          this.diagnostics.push(ParseError.unexpectedToken(this.next()!))
      }
    }

    return {
      accounts: this.accounts,
      ast: { children: this.children },
      diagnostics: this.diagnostics,
      payees: this.payees,
    }
  }

  private parseComment(): Result<Comment, ParseError> {
    let commentToken = this.expect('comment')
    return commentToken.map(comment => {
      let commentChar = comment.text[0]
      let text = comment.text.slice(1)
      let tags: Record<string, string | undefined> = {}
      let typedTags: Record<string, unknown> = {}

      return {
        type: 'comment',
        comment,
        commentChar,
        text,
        tags,
        typedTags,
      }
    })
  }

  private parseDirective(): Result<ASTChild, ParseError> {
    return this.expect('identifier').andThen(identifier => {
      switch (identifier.text) {
        case 'alias':
          return this.parseAlias(identifier)
        case 'apply':
          return this.parseApplyDirective(identifier)
        case 'comment':
        case 'test':
          return this.parseUntilEnd(identifier.text)
        case 'end':
          return this.parseEndDirective(identifier)
        default:
          return this.parseStandardDirective(identifier)
      }
    })
  }

  private parseAlias(alias: Token<'identifier'>): Result<ASTChild, ParseError> {
    this.skipWhitespace()

    let name = this.slurpUntil(['equal'])
    let eq = this.skipIf('equal')
    let value = this.slurp()

    return this.newlineOrEof().map(() => ({
      type: 'alias',
      alias,
      name,
      eq,
      value,
    }))
  }

  private parseUntilEnd(name: string): Result<ASTChild, ParseError> {
    let newline = this.expect('newline')
    if (newline.isErr()) {
      return newline
    }

    let seen = new GroupBuilder()

    while (this.hasNext()) {
      let previousType = this.previous?.type
      let next = this.next()!
      if (next.type === 'identifier' && next.text === 'end' && previousType === 'newline') {
        let ws = this.skipIf('ws')
        let next2 = this.next()
        if (next2?.type === 'identifier' && ['comment', 'test'].includes(next2.text)) {
          let comment = seen.build()
          return Result.ok({
            type: 'comment',
            comment,
            commentChar: name,
            text: comment?.toString() ?? '',
            tags: {},
            typedTags: {},
          })
        } else {
          seen.add(next)
          if (ws) {
            seen.add(ws)
          }
          if (next2) {
            seen.add(next2)
          }
        }
      } else {
        seen.add(next)
      }
    }

    return Result.err(ParseError.unexpectedEOF(this.getPreviousLocation(), ['identifier']))
  }

  private parseApplyDirective(apply: Token<'identifier'>): Result<ASTChild, ParseError> {
    this.skipWhitespace()

    return this.expect('identifier').andThen(name => {
      this.skipWhitespace()

      let args: Group | undefined
      if (this.hasNext() && !this.peekType('newline')) {
        args = this.slurpUntil('newline')
      }

      return this.newlineOrEof().map(() => ({
        type: 'apply',
        apply,
        name,
        args,
        subDirectives: [],
      }))
    })
  }

  private parseEndDirective(end: Token<'identifier'>): Result<End, ParseError> {
    this.skipWhitespace()

    return this.expect('identifier').andThen(name => {
      return this.newlineOrEof().map(() => ({
        type: 'end',
        end,
        name,
      }))
    })
  }

  private parseStandardDirective(name: Token<'identifier'>): Result<Directive, ParseError> {
    let arg: Group | undefined

    this.skipWhitespace()

    if (this.hasNext() && !this.peekType('newline')) {
      arg = this.slurp()
    }

    return this.newlineOrEof()
      .andThen(this.parseSubdirectives.bind(this))
      .map(subDirectives => ({
        type: 'directive',
        name,
        arg,
        subDirectives,
      }))
  }

  private parseSubdirectives(): Result<SubDirective[], ParseError> {
    let subDirectives: SubDirective[] = []

    while (this.skipIf('ws')) {
      let next = this.parseSubdirective()
      if (next.isErr()) {
        return next
      }
      subDirectives.push(next.unwrap())
    }

    return Result.ok(subDirectives)
  }

  private parseSubdirective(): Result<SubDirective, ParseError> {
    return this.expect('identifier').andThen(key => {
      this.skipWhitespace()

      let value: Group | undefined
      if (this.hasNext() && !this.peekType('newline')) {
        value = this.slurpUntil('newline')
      }

      let end = this.newlineOrEof()
      if (end.isErr()) {
        return end
      }

      return Result.ok({
        type: 'subDirective',
        key,
        value,
      })
    })
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
    let comments: Comment[] = []

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

      let builder = new GroupBuilder().append(this.slurpUntil('ws', { and: isBigSpace }))
      while (this.hasNext() && !this.peekType('newline') && !this.peekType('comment')) {
        builder.append(this.slurpUntil('ws', { and: isBigSpace }))
        if (this.peekType('ws')) {
          builder.add(this.next()!)
        }
      }

      let payeeGroup = builder.build()

      if (payeeGroup) {
        let payeeText = payeeGroup.toString().trim()
        payee = { type: 'payee', name: payeeGroup }

        if (!this.payees.has(payeeText)) {
          this.payees.add(payeeText, payeeGroup.location)
        }
        this.skipWhitespace()
      }

      if (this.peekType('comment')) {
        let comment = this.parseComment()
        if (comment.isErr()) {
          return comment
        }
        comments.push(comment.unwrap())
      }
    }

    let newline = this.newlineOrEof()
    if (newline.isErr()) {
      return newline
    }

    let postings: Posting[] = []

    while (this.skipIf('ws')) {
      if (this.peekType('comment')) {
        let comment = this.parseComment().unwrap()
        let lastPosting = postings[postings.length - 1]
        if (lastPosting) {
          lastPosting.comments.push(comment)
        } else {
          comments.push(comment)
        }
        continue
      } else if (this.skipIf('newline')) {
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
      .andThen(lparen => {
        this.skipWhitespace()
        let contents = this.slurpUntil('rparen')
        if (!contents) {
          if (this.hasNext()) {
            let expected: TokenType[] = ['rparen']
            let location = this.getPreviousLocation()
            let err = ParseError.unexpectedEOF(location, expected)
            return Result.err(err)
          } else {
            let err = ParseError.unexpectedToken(this.peek()!)
            return Result.err(err)
          }
        }

        return Result.ok({ lparen, contents: contents })
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
      let ts = tokens.filter(t => t !== undefined)
      // SAFETY: Date parsing requires at least two integers and a slash or hyphen
      let raw = Group.UNSAFE_nonEmpty(...ts)
      return { type: 'date', raw }
    })
  }

  private parsePosting(): Result<Posting, ParseError> {
    let amount: Amount | undefined
    let accountName = this.slurpUntil('ws', { and: isBigSpace })
    let comments: Comment[] = []

    if (!accountName) {
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

    return this.newlineOrEof().map(() => ({
      type: 'posting',
      comments,
      account,
      amount,
    }))
  }

  private parseAmount(): Result<Amount, ParseError> {
    let commodity: Group | undefined
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

  private peekType(type: TokenType | TokenType[]): boolean {
    let typeArray: (TokenType | undefined)[] = Array.isArray(type) ? type : [type]
    return typeArray.includes(this.lexer.peek()?.type)
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

  private getPreviousLocation(): Location {
    if (this.previous) {
      return getLocation(this.previous)
    }
    return defaultLocation()
  }

  private expect<T extends TokenType>(type: T): Result<Token<T>, ParseError>
  private expect<T extends readonly TokenType[]>(types: T): Result<Token<TupleToUnion<T>>, ParseError>
  private expect(type: TokenType | TokenType[]): Result<Token, ParseError> {
    let next = this.next()

    if (!Array.isArray(type)) {
      type = [type]
    }

    if (!next) {
      let location = this.getPreviousLocation() ?? defaultLocation()
      return Result.err(ParseError.unexpectedEOF(location, type))
    }

    if (!type.includes(next.type)) {
      return Result.err(ParseError.unexpectedToken(next, type))
    }

    return Result.ok(next)
  }

  private newlineOrEof(): Result<void, ParseError> {
    let next = this.next()
    if (!next || next.type === 'newline') {
      return Result.ok(undefined)
    }

    return Result.err(ParseError.unexpectedToken(next, 'newline'))
  }

  /**
   * Special form of `expect` that expects an integer token. Similar to `expect('number')`, but numeric tokens may not be decimals, NaN, or Infinity.
   * @returns A Result containing the token if it is an integer, or a ParseError if it is not.
   */
  private expectInteger(): Result<Token<'number'>, ParseError> {
    return this.expect('number').andThen(token => {
      if (!Number.isInteger(parseFloat(token.value))) {
        let location = getLocation(token)
        let message = `Expected integer, but found ${token.text}`
        return Result.err(new ParseError(message, 'INVALID_INTEGER', location))
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
  private slurp(): Group | undefined {
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
  private slurpUntil(type: TokenType | TokenType[], opts?: { and: (t: Token) => boolean }): Group | undefined {
    let tokens = new GroupBuilder()
    let predicate = opts?.and ?? ok
    let next = this.peek()

    if (!Array.isArray(type)) {
      type = [type]
    }

    while (next && (!type.includes(next.type) || !predicate(next)) && next.type !== 'newline') {
      tokens.add(this.next()!)
      next = this.peek()
    }

    return tokens.build()
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

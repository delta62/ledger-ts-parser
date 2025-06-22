import { Group } from './group'
import type { Token } from './lexer'
import { Result } from './result'
import { Parser } from './parser'
import { ParseError } from './parse-error'

export type Trivia = Token<'ws'> | Token<'comment'> | Token<'newline'>

export interface NodeTrivia {
  before: Trivia[]
  after: Trivia[]
}

export abstract class Node<T extends string> {
  constructor(public type: T, public trivia: NodeTrivia) {}
}

export class AccountRef extends Node<'accountRef'> {
  constructor(public account: string, trivia: NodeTrivia, public name: Group) {
    super('accountRef', trivia)
  }
}

export class Payee extends Node<'payee'> {
  constructor(public name: string, trivia: NodeTrivia, public group: Group) {
    super('payee', trivia)
  }
}

export class DateNode extends Node<'date'> {
  static parse(parser: Parser): Result<DateNode, ParseError> {
    return Result.all(
      () => parser.expectInteger(),
      () => parser.expect(['slash', 'hyphen']),
      () => parser.expectInteger(),
      (_, sep) => {
        if (parser.peekType(sep.type)) {
          return parser.expect(['slash', 'hyphen'])
        } else {
          return Result.ok(undefined)
        }
      },
      (_n1, _s1, _n2, sep) => {
        if (sep) {
          return parser.expectInteger()
        } else {
          return Result.ok(undefined)
        }
      }
    ).map(tokens => {
      let ts = tokens.filter(t => t !== undefined)
      // SAFETY: Date parsing requires at least two integers and a slash or hyphen
      let raw = Group.UNSAFE_nonEmpty(...ts)
      return new DateNode(raw, trivia)
    })
  }

  constructor(public raw: Group, trivia: NodeTrivia) {
    super('date', trivia)
  }
}

export class Amount extends Node<'amount'> {
  public static parse(parser: Parser): Result<Amount, ParseError> {
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

  constructor(
    public amount: Token<'number'>,
    public minus: Token<'hyphen'> | undefined,
    public preCommodity: Group | undefined,
    public postCommodity: Group | undefined,
    trivia: NodeTrivia
  ) {
    super('amount', trivia)
  }
}

export class Comment extends Node<'comment'> {
  static parse(parser: Parser): Result<Comment, ParseError> {
    return parser.expect('comment').map(comment => {
      let commentChar = comment.text[0]
      let text = comment.text.slice(1)
      let tags: Record<string, string | undefined> = {}
      let typedTags: Record<string, unknown> = {}

      return new Comment(comment, commentChar, text, tags, typedTags, trivia)
    })
  }

  constructor(
    public comment: Token<'comment'> | Group | undefined,
    public commentChar: string,
    public text: string,
    public tags: Record<string, string | undefined>,
    public typedTags: Record<string, unknown> = {},
    trivia: NodeTrivia
  ) {
    super('comment', trivia)
  }
}

export class AuxDate extends Node<'auxDate'> {
  static parse(parser: Parser): Result<AuxDate, ParseError> {
    return parser.expect('equal').andThen(equal => {
      return DateNode.parse(parser).map(date => {
        return new AuxDate(equal, date, trivia)
      })
    })
  }

  constructor(public equal: Token<'equal'>, public date: DateNode, trivia: NodeTrivia) {
    super('auxDate', trivia)
  }
}

export class Code extends Node<'code'> {
  static parse(parser: Parser): Result<Code, ParseError> {
    return Result.all(
      () => parser.expect('lparen'),
      () => parser.slurpUntil('rparen'),
      () => parser.expect('rparen')
    ).map(([lparen, contents, rparen]) => {
      return new Code(lparen, contents, rparen, trivia)
    })
  }

  constructor(
    public lparen: Token<'lparen'>,
    public contents: Group,
    public rparen: Token<'rparen'>,
    trivia: NodeTrivia
  ) {
    super('code', trivia)
  }
}

export class Transaction extends Node<'transaction'> {
  public static parse(parser: Parser): Result<Transaction, ParseError> {
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
      let flag = this.skipIf(['bang', 'star'])

      if (flag) {
        if (flag.type === 'bang') {
          pending = flag as Token<'bang'>
          cleared = this.skipIf('star')
        } else if (flag.type === 'star') {
          cleared = flag as Token<'star'>
          pending = this.skipIf('bang')
        }
      }

      if (this.peekType('lparen')) {
        let parsedCode = this.parseCode()
        if (parsedCode.isErr()) {
          return parsedCode
        }
        code = parsedCode.unwrap()
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
      }

      if (this.peekType('comment')) {
        let comment = this.parseComment()
        if (comment.isErr()) {
          return comment
        }
        comments.push(comment.unwrap())
      }
    }

    let newline = this.expectEndOfLine()
    if (newline.isErr()) {
      return newline
    }

    let postings: Posting[] = []

    while (parser.skipIf('ws')) {
      if (parser.peekType('comment')) {
        let comment = Comment.parse(parser)
        let lastPosting = postings[postings.length - 1]
        if (lastPosting) {
          lastPosting.comments.push(comment)
        } else {
          comments.push(comment)
        }
        continue
      } else if (parser.skipIf('newline')) {
        break
      } else {
        let posting = Posting.parse(parser)
        if (posting.isErr()) {
          return Result.err(posting.unwrapErr())
        }
        postings.push(posting.unwrap())
      }
    }

    return Result.ok(new Transaction(date, auxDate, cleared, pending, code, payee, comments, postings, trivia))
  }
  constructor(
    public date: DateNode,
    public auxDate: AuxDate | undefined,
    public cleared: Token<'star'> | undefined,
    public pending: Token<'bang'> | undefined,
    public code: Code | undefined,
    public payee: Payee | undefined,
    public comments: Comment[],
    public postings: Posting[],
    trivia: NodeTrivia
  ) {
    super('transaction', trivia)
  }
}

export class Posting extends Node<'posting'> {
  public static parse(parser: Parser): Result<Posting, ParseError> {
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

    if (this.hasNext() && !this.peekType('newline')) {
      let parsedAmount = this.parseAmount()
      if (parsedAmount.isErr()) {
        return parsedAmount
      }
      amount = parsedAmount.unwrap()
    }

    return this.expectEndOfLine().map(() => ({
      type: 'posting',
      comments,
      account,
      amount,
    }))
  }

  constructor(
    public account: AccountRef,
    public amount: Amount | undefined,
    public comments: Comment[],
    trivia: NodeTrivia
  ) {
    super('posting', trivia)
  }
}

export class Directive extends Node<'directive'> {
  static parse(parser: Parser): Result<Directive, ParseError> {
    return parser.expect('identifier').andThen(identifier => {
      switch (identifier.text) {
        case 'alias':
          return Alias.parse(parser)
        case 'apply':
          return Apply.parse(parser)
        case 'comment':
        case 'test':
          return this.parseUntilEnd(identifier.text)
        case 'end':
          return End.parse(parser)
        default:
          return this.parseStandardDirective(identifier)
      }
    })
  }

  private static parseStandardDirective(name: Token<'identifier'>): Result<Directive, ParseError> {
    let arg: Group | undefined

    if (this.hasNext() && !this.peekType('newline')) {
      arg = this.slurp()
    }

    return this.expectEndOfLine()
      .andThen(this.parseSubdirectives.bind(this))
      .map(subDirectives => ({
        type: 'directive',
        name,
        arg,
        subDirectives,
      }))
  }

  private static parseSubdirectives(parser: Parser): Result<SubDirective[], ParseError> {
    let subDirectives: SubDirective[] = []

    while (parser.skipIf('ws')) {
      let next = SubDirective.parse(parser)
      if (next.isErr()) {
        return next
      }
      subDirectives.push(next.unwrap())
    }

    return Result.ok(subDirectives)
  }

  private static parseUntilEnd(name: string): Result<ASTChild, ParseError> {
    let newline = this.expect('newline')
    if (newline.isErr()) {
      return newline
    }

    let seen = new GroupBuilder()

    while (this.hasNext()) {
      let previousType = this.lexer.previous()?.type
      let next = this.next()
      if (next.type === 'identifier' && next.text === 'end' && previousType === 'newline') {
        let ws = this.skipIf('ws')
        let next2 = this.next()
        if (next2.type === 'identifier' && ['comment', 'test'].includes(next2.text)) {
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

  constructor(
    public name: Token<'identifier'>,
    public arg: Group | undefined,
    public subDirectives: SubDirective[],
    trivia: NodeTrivia
  ) {
    super('directive', trivia)
  }
}

export class SubDirective extends Node<'subDirective'> {
  public static parse(parser: Parser): Result<SubDirective, ParseError> {
    return this.expect('identifier').andThen(key => {
      let value: Group | undefined
      if (this.hasNext() && !this.peekType('newline')) {
        value = this.slurpUntil('newline')
      }

      let end = this.expectEndOfLine()
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

  constructor(public key: Token<'identifier'>, public value: Group | undefined, trivia: NodeTrivia) {
    super('subDirective', trivia)
  }
}

export class Apply extends Node<'apply'> {
  public static parse(parser: Parser): Result<Apply, ParseError> {
    return this.expect('identifier').andThen(name => {
      let args: Group | undefined
      if (this.hasNext() && !this.peekType('newline')) {
        args = this.slurpUntil('newline')
      }

      return this.expectEndOfLine().map(() => ({
        type: 'apply',
        apply,
        name,
        args,
        subDirectives: [],
      }))
    })
  }

  constructor(
    public apply: Token<'identifier'>,
    public name: Token<'identifier'>,
    public args: Group | undefined,
    trivia: NodeTrivia
  ) {
    super('apply', trivia)
  }
}

export class End extends Node<'end'> {
  public static parse(parser: Parser): Result<End, ParseError> {
    return parser.expect('identifier').andThen(name => {
      return this.expectEndOfLine().map(() => ({
        type: 'end',
        end,
        name,
      }))
    })
  }

  constructor(public end: Token<'identifier'>, public name: Token<'identifier'>, trivia: NodeTrivia) {
    super('end', trivia)
  }
}

export class Alias extends Node<'alias'> {
  public static parse(parser: Parser): Result<Alias, ParseError> {
    let name = this.slurpUntil('equal')
    let eq = this.skipIf('equal')
    let value = this.slurp()

    return this.expectEndOfLine().map(() => ({
      type: 'alias',
      alias,
      name,
      eq,
      value,
    }))
  }

  constructor(
    public alias: Token<'identifier'>,
    public name: Group,
    public eq: Token<'equal'> | undefined,
    public value: Group | undefined,
    trivia: NodeTrivia
  ) {
    super('alias', trivia)
  }
}

export class File extends Node<'file'> {
  static parse(parser: Parser): File {
    let children: ASTChild[] = []

    while (parser.hasNext()) {
      switch (parser.peek().type) {
        case 'number':
          this.tryParse(Transaction.parse(parser))
          break
        case 'comment':
          this.tryParse(Comment.parse(parser))
          break
        case 'identifier':
          this.tryParse(Directive.parse(parser))
          break
        default:
          parser.synchronize(ParseError.unexpectedToken(parser.next()))
      }
    }

    return new File(children, trivia)
  }

  constructor(public children: ASTChild[], trivia: NodeTrivia) {
    super('file', trivia)
  }
}

export type ASTChild = Transaction | Directive | Comment | Apply | End | Alias

export interface AST {
  children: ASTChild[]
}

/**
 * Checks if the token is a "big space", which is defined as two or more spaces or a tab. This is important for postings, which must separate account names from amounts in this way
 * @param token The token to check. It is assumed to be a whitespace token.
 * @returns True if the token is a big space, false otherwise
 */
function isBigSpace(token: Token): boolean {
  return /^ {2,}|\t$/.test(token.text)
}

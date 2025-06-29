import { Group } from './group'
import type { Token, TokenType } from './lexer'
import { Result } from './result'
import { Parser } from './parser'
import { ParseError } from './parse-error'
import { unimplemented } from './util'
import { Location } from './location'

export abstract class ParseNOde<T extends string> {
  constructor(public type: T) {}
}

export class SurroundedBy<O extends TokenType, C extends TokenType> extends ParseNOde<'surroundedBy'> {
  public static parse<O extends TokenType, C extends TokenType>(
    parser: Parser,
    open: O,
    close: C
  ): Result<SurroundedBy<O, C>, ParseError> {
    return Result.all(
      () => parser.expect(open),
      () => parser.slurpUntil(close),
      () => parser.expect(close)
    ).map(([open, contents, close]) => {
      return new SurroundedBy(open, contents, close)
    })
  }

  constructor(public readonly open: Token<O>, public readonly contents: Group, public readonly close: Token<C>) {
    super('surroundedBy')
  }
}

function invertBrace(open: 'lparen' | 'lbracket'): 'rparen' | 'rbracket' {
  switch (open) {
    case 'lbracket':
      return 'rbracket'
    case 'lparen':
      return 'rparen'
    default:
      unimplemented('unreachable')
  }
}

export class AccountRef extends ParseNOde<'accountRef'> {
  public static parse(parser: Parser): Result<AccountRef, ParseError> {
    let nextType = parser.peek().type

    if (nextType === 'lparen' || nextType === 'lbracket') {
      let closeType = invertBrace(nextType as 'lparen' | 'lbracket')

      return Result.all(
        () => parser.expect('lparen', 'lbracket'),
        () => parser.slurpUntil(closeType),
        () => parser.expect(closeType)
      ).map(([open, body, close]) => new AccountRef(new SurroundedBy(open, body, close)))
    } else {
      return parser.slurpUntilHardSpace().map(body => new AccountRef(body))
    }
  }

  public get location(): Location {
    if (this.name instanceof SurroundedBy) {
      return this.name.open.location
    } else {
      return this.name.location
    }
  }

  constructor(public readonly name: Group | SurroundedBy<'lparen' | 'lbracket', 'rparen' | 'rbracket'>) {
    super('accountRef')
  }

  public accountName(): string {
    if (this.name instanceof SurroundedBy) {
      return this.name.contents.innerText()
    } else {
      return this.name.innerText()
    }
  }
}

export class Payee extends ParseNOde<'payee'> {
  public static parse(parser: Parser): Result<Payee, ParseError> {
    return parser
      .slurpUntilHardSpace()
      .andThen(group => {
        while (parser.lineHasNext() && !parser.peekType('comment')) {
          let nextChunk = parser.slurpUntilHardSpace()
          if (nextChunk.isErr()) {
            return nextChunk
          }
          group = group.concat(nextChunk.unwrap())
        }

        return Result.ok(group)
      })
      .map(group => {
        let payeeText = group.innerText()
        parser.declarePayee(payeeText, group.location)

        return new Payee(group)
      })
  }

  constructor(public readonly group: Group) {
    super('payee')
  }
}

export class DateNode extends ParseNOde<'date'> {
  static parse(parser: Parser): Result<DateNode, ParseError> {
    return Result.all(
      () => parser.expectInteger(),
      () => parser.expect('slash', 'hyphen'),
      () => parser.expectInteger(),
      (_, sep) => parser.skipIf(sep.type),
      (_n1, _s1, _n2, sep) => {
        if (sep) {
          return parser.expectInteger()
        } else {
          return Result.ok(undefined)
        }
      }
    ).map(tokens => {
      let ts = tokens.filter(t => t !== undefined)
      // SAFETY: Date parsing above ensures at least two integers and a slash or hyphen
      let raw = Group.UNSAFE_nonEmpty(...ts)
      return new DateNode(raw)
    })
  }

  constructor(public readonly raw: Group) {
    super('date')
  }
}

export class Amount extends ParseNOde<'amount'> {
  public static parse(parser: Parser): Result<Amount, ParseError> {
    let hardSpace = parser.expectHardSpace()
    if (hardSpace.isErr()) {
      return hardSpace
    }

    let amount: Token<'number'> | undefined
    let minus = parser.skipIf('hyphen')
    let preCommodity: Group | undefined
    let postCommodity: Group | undefined

    if (parser.peekType('number')) {
      preCommodity = undefined
      amount = parser.next() as Token<'number'>
      postCommodity = parser.slurpUntil(['hyphen', 'number', 'comment']).unwrapOr(undefined)
    } else if (!parser.peekType('newline', 'comment') && parser.hasNext()) {
      preCommodity = parser.slurpUntil(['hyphen', 'number', 'comment']).unwrapOr(undefined)
      minus = minus ?? parser.skipIf('hyphen')
      let num = parser.expect('number')
      if (num.isErr()) {
        return num
      }
      amount = num.unwrap()
      postCommodity = undefined
    }

    return Result.ok(new Amount(amount, minus, preCommodity, postCommodity))
  }

  constructor(
    public readonly amount: Token<'number'> | undefined,
    public readonly minus: Token<'hyphen'> | undefined,
    public readonly preCommodity: Group | undefined,
    public readonly postCommodity: Group | undefined
  ) {
    super('amount')
  }
}

export class Comment extends ParseNOde<'comment'> {
  static parse(parser: Parser): Result<Comment, ParseError> {
    return parser
      .expect('comment')
      .thenTap(() => parser.expectEndOfLine())
      .map(comment => {
        let commentChar = comment.innerText()[0]
        let text = comment.innerText().slice(1)
        let tags: Record<string, string | undefined> = {}
        let typedTags: Record<string, unknown> = {}

        return new Comment(comment, commentChar, text, tags, typedTags)
      })
  }

  constructor(
    public readonly comment: Token<'comment'> | Group | undefined,
    public readonly commentChar: string,
    public readonly text: string,
    public readonly tags: Record<string, string | undefined>,
    public readonly typedTags: Record<string, unknown> = {}
  ) {
    super('comment')
  }
}

export class AuxDate extends ParseNOde<'auxDate'> {
  static parse(parser: Parser): Result<AuxDate, ParseError> {
    return Result.all(
      () => parser.expect('equal'),
      () => DateNode.parse(parser)
    ).map(([equal, date]) => new AuxDate(equal, date))
  }

  constructor(public readonly equal: Token<'equal'>, public readonly date: DateNode) {
    super('auxDate')
  }
}

export class Transaction extends ParseNOde<'transaction'> {
  public static parse(parser: Parser): Result<Transaction, ParseError> {
    let comments: Comment[] = []
    return Result.all(
      () => DateNode.parse(parser),
      () => parser.ifPeek('equal', () => AuxDate.parse(parser)),
      () => parser.inlineSpace(),
      () => parser.skipIf(['bang', 'star']),
      () => parser.inlineSpace(),
      () => parser.ifPeek('lparen', () => SurroundedBy.parse(parser, 'lparen', 'rparen')),
      () => parser.inlineSpace(),
      () => parser.ifLineHasNext(() => Payee.parse(parser)),
      () => parser.ifPeek('comment', () => Comment.parse(parser)),
      () => parser.expectEndOfLine(),
      () => this.parsePostings(parser, comments)
    ).map(([date, auxDate, , flag, , code, , payee, comment, , postings]) => {
      if (comment) comments.push(comment)
      let cleared = flag?.type === 'star' ? (flag as Token<'star'>) : undefined
      let pending = flag?.type === 'bang' ? (flag as Token<'bang'>) : undefined
      return new Transaction(date, auxDate, cleared, pending, code, payee, comments, postings)
    })
  }

  private static parsePostings(parser: Parser, comments: Comment[]): Result<Posting[], ParseError> {
    let postings: Posting[] = []

    while (parser.nextIsIndented()) {
      let next = parser.peek()
      switch (next.type) {
        case 'comment': {
          let comment = Comment.parse(parser).thenTap(() => parser.expectEndOfLine())
          if (comment.isErr()) {
            return comment
          }

          let lastPosting = postings[postings.length - 1]
          if (lastPosting) {
            lastPosting.comments.push(comment.unwrap())
          } else {
            comments.push(comment.unwrap())
          }

          break
        }
        default: {
          let posting = Posting.parse(parser).thenTap(() => parser.expectEndOfLine())

          if (posting.isErr()) {
            return posting
          }
          postings.push(posting.unwrap())
        }
      }
    }

    return Result.ok(postings)
  }

  constructor(
    public readonly date: DateNode,
    public readonly auxDate: AuxDate | undefined,
    public readonly cleared: Token<'star'> | undefined,
    public readonly pending: Token<'bang'> | undefined,
    public readonly code: SurroundedBy<'lparen', 'rparen'> | undefined,
    public readonly payee: Payee | undefined,
    public readonly comments: Comment[],
    public readonly postings: Posting[]
  ) {
    super('transaction')
  }
}

export class Posting extends ParseNOde<'posting'> {
  public readonly comments: Comment[] = []

  public static parse(parser: Parser): Result<Posting, ParseError> {
    return Result.all(
      () => AccountRef.parse(parser),
      () => parser.ifLineHasNext(() => Amount.parse(parser))
    ).map(([account, amount]) => {
      parser.declareAccount(account.accountName(), account.location)
      return new Posting(account, amount)
    })
  }

  constructor(public readonly account: AccountRef, public readonly amount: Amount | undefined) {
    super('posting')
  }
}

export class Directive extends ParseNOde<'directive'> {
  static parse(parser: Parser): Result<ASTChild, ParseError> {
    let next = parser.peek()
    if (next.type !== 'identifier') {
      return Result.err(ParseError.unexpectedToken(parser.next(), ['identifier']))
    }

    switch (next.innerText()) {
      case 'alias':
        return Alias.parse(parser)
      case 'apply':
        return Apply.parse(parser)
      case 'comment':
      case 'test':
        return CommentDirective.parse(parser)
      case 'end':
        return End.parse(parser)
      default:
        return this.parseStandardDirective(parser)
    }
  }

  private static parseStandardDirective(parser: Parser): Result<Directive, ParseError> {
    return Result.all(
      () => parser.expect('identifier'),
      () => parser.slurpOpt(),
      () => parser.expectEndOfLine(),
      () => this.parseSubdirectives(parser)
    ).map(([name, arg, , subDirectives]) => {
      return new Directive(name, arg, subDirectives)
    })
  }

  private static parseSubdirectives(parser: Parser): Result<SubDirective[], ParseError> {
    return parser.whileIndented(() => SubDirective.parse(parser))
  }

  constructor(
    public readonly name: Token<'identifier'>,
    public readonly arg: Group | undefined,
    public readonly subDirectives: SubDirective[]
  ) {
    super('directive')
  }
}

export class CommentDirective extends ParseNOde<'commentDirective'> {
  public static parse(parser: Parser): Result<CommentDirective, ParseError> {
    return Result.all(
      () => parser.expect('identifier'),
      () => parser.expectEndOfLine(),
      name => parser.untilSequence('end', name.innerText())
    ).map(([name, newline, [body, end, endName]]) => {
      let bodyStr = body ? `${newline.trailingSpace}${body.outerText()}` : ''
      return new CommentDirective(name, bodyStr, end, endName)
    })
  }

  constructor(
    public readonly startName: Token<'identifier'>,
    public readonly body: string,
    public readonly end: Token<'identifier'>,
    public readonly endName: Token<'identifier'>
  ) {
    super('commentDirective')
  }
}

export class SubDirective extends ParseNOde<'subDirective'> {
  public static parse(parser: Parser): Result<SubDirective, ParseError> {
    return Result.all(
      () => parser.expect('identifier'),
      () => parser.slurpOpt()
    ).map(([key, value]) => new SubDirective(key, value))
  }

  constructor(public readonly key: Token<'identifier'>, public readonly value: Group | undefined) {
    super('subDirective')
  }
}

export class Apply extends ParseNOde<'apply'> {
  public static parse(parser: Parser): Result<Apply, ParseError> {
    return Result.all(
      () => parser.expect('identifier'),
      () => parser.expect('identifier'),
      () => parser.slurpOpt(),
      () => parser.expectEndOfLine()
    ).map(([apply, name, args]) => {
      return new Apply(apply, name, args)
    })
  }

  constructor(
    public readonly apply: Token<'identifier'>,
    public readonly name: Token<'identifier'>,
    public readonly args: Group | undefined
  ) {
    super('apply')
  }
}

export class End extends ParseNOde<'end'> {
  public static parse(parser: Parser): Result<End, ParseError> {
    return Result.all(
      () => parser.expectIdentifier('end'),
      () => parser.skipIfIdentifier('apply'),
      () => parser.expect('identifier'),
      () => parser.expectEndOfLine()
    ).map(([end, apply, name]) => {
      return new End(end, apply, name)
    })
  }

  constructor(
    public readonly end: Token<'identifier'>,
    public readonly apply: Token<'identifier'> | undefined,
    public readonly name: Token<'identifier'>
  ) {
    super('end')
  }
}

export class Alias extends ParseNOde<'alias'> {
  public static parse(parser: Parser): Result<Alias, ParseError> {
    return Result.all(
      () => parser.expectIdentifier('alias'),
      () => parser.slurpUntil('equal'),
      () => parser.expect('equal'),
      () => parser.slurp(),
      () => parser.expectEndOfLine()
    ).map(([alias, name, eq, value]) => {
      return new Alias(alias, name, eq, value)
    })
  }

  constructor(
    public readonly alias: Token<'identifier'>,
    public readonly name: Group,
    public readonly eq: Token<'equal'>,
    public readonly value: Group
  ) {
    super('alias')
  }
}

export class File extends ParseNOde<'file'> {
  static parse(parser: Parser): File {
    let children: ASTChild[] = []

    while (parser.hasNext()) {
      let next = parser.peek()
      let result: Result<ASTChild, ParseError>

      if (parser.nextIsIndented()) {
        let err = ParseError.leadingSpace(next)
        parser.synchronize(err)
        continue
      }

      switch (next.type) {
        case 'number':
          result = Transaction.parse(parser)
          break
        case 'comment':
          result = Comment.parse(parser)
          break
        case 'identifier':
          result = Directive.parse(parser)
          break
        default:
          parser.synchronize(ParseError.unexpectedToken(parser.next()))
          continue
      }

      if (result.isOk()) {
        children.push(result.unwrap())
      } else {
        parser.synchronize(result.unwrapErr())
      }
    }

    return new File(children)
  }

  constructor(public readonly children: ASTChild[]) {
    super('file')
  }
}

export type ASTChild = Transaction | Directive | Comment | Apply | End | Alias | CommentDirective

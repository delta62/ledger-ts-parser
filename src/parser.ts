import Lexer, { Token, MooTokenType } from './lexer'
import { SymbolTable } from './symbol-table'
import { ParseError } from './parse-error'
import { Result } from './result'
import { File, Trivia } from './node'
import { Group, GroupBuilder } from './group'
import { TupleToUnion } from './types'
import { ok, unimplemented } from './util'
import { Location, getLocation, defaultLocation } from './location'

export interface ParserResult {
  file: File
  diagnostics: ParseError[]
  accounts: SymbolTable
  payees: SymbolTable
}

export class Parser {
  private accounts = new SymbolTable()
  private payees = new SymbolTable()
  private diagnostics: ParseError[] = []
  private triviaBuffer: Trivia[] = []

  constructor(private lexer: Lexer) {}

  public parse(): ParserResult {
    let file = File.parse(this)

    return {
      accounts: this.accounts,
      file,
      diagnostics: this.diagnostics,
      payees: this.payees,
    }
  }

  public declarePayee(name: string, location: Location): void {
    if (!this.payees.has(name)) {
      this.payees.add(name, location)
    }
  }

  public declareAccount(name: string, location: Location): void {
    if (!this.accounts.has(name)) {
      this.accounts.add(name, location)
    }
  }

  public synchronize(err: ParseError): void {
    this.diagnostics.push(err)
    unimplemented()
  }

  public skipIf(): Token | undefined
  public skipIf<T extends MooTokenType>(type: T): Token<T> | undefined
  public skipIf<T extends readonly MooTokenType[]>(types: T): Token<TupleToUnion<T>> | undefined
  public skipIf(types?: MooTokenType | MooTokenType[]): Token | undefined {
    let nextType = this.peek().type
    let acceptedTypes = Array.isArray(types) ? types : [types]

    if (acceptedTypes.includes(nextType)) {
      return this.next()
    }

    return undefined
  }

  public peekType(type: MooTokenType, ...alt: MooTokenType[]): boolean {
    let types = [type, ...alt]
    return types.includes(this.lexer.peek().type)
  }

  public next(): [Trivia[], Token, Trivia[]] {
    while (this.peekType('ws', 'newline', 'comment')) {
      this.triviaBuffer.push(this.lexer.next())
    }

    let preTrivia = this.triviaBuffer
    let token = this.lexer.next()
    let postTrivia: Trivia[] = []

    this.triviaBuffer = []

    if (!this.hasNext()) {
      postTrivia = this.triviaBuffer
      this.triviaBuffer = []
    }

    return [preTrivia, token, postTrivia]
  }

  public hasNext(): boolean {
    while (this.peekType('ws', 'newline', 'comment')) {
      this.triviaBuffer.push(this.next())
    }

    return this.lexer.hasNext()
  }

  public peek(): Token {
    while (this.peekType('ws', 'newline', 'comment')) {
      this.triviaBuffer.add(this.next())
    }

    return this.lexer.peek()
  }

  private getPreviousLocation(): Location {
    let previous = this.lexer.previous()
    return previous ? getLocation(previous) : defaultLocation()
  }

  public expect<T extends MooTokenType>(type: T): Result<Token<T>, ParseError>
  public expect<T extends readonly MooTokenType[]>(types: T): Result<Token<TupleToUnion<T>>, ParseError>
  public expect(type: MooTokenType, ...alt: MooTokenType[]): Result<Token, ParseError> {
    let next = this.next()
    let types = [type, ...alt]

    if (next.type === 'eof') {
      let location = this.getPreviousLocation()
      return Result.err(ParseError.unexpectedEOF(location, types))
    }

    if (!type.includes(next.type)) {
      return Result.err(ParseError.unexpectedToken(next, types))
    }

    return Result.ok(next)
  }

  public expectEndOfLine(): Result<void, ParseError> {
    let next = this.next()

    return ['newline', 'eof'].includes(next.type)
      ? Result.ok(undefined)
      : Result.err(ParseError.unexpectedToken(next, 'newline'))
  }

  /**
   * Special form of `expect` that expects an integer token. Similar to `expect('number')`, but numeric tokens may not be decimals, NaN, or Infinity.
   * @returns A Result containing the token if it is an integer, or a ParseError if it is not.
   */
  public expectInteger(): Result<Token<'number'>, ParseError> {
    return this.expect('number').andThen(token => {
      if (!Number.isInteger(parseFloat(token.value))) {
        return Result.err(ParseError.invalidInteger(token))
      }

      return Result.ok(token)
    })
  }

  /**
   * Consumes tokens until a newline or the end of file is encountered.
   * @returns All tokens consumed
   */
  public slurp(): Result<Group, ParseError> {
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
  public slurpUntil(
    type: MooTokenType | MooTokenType[],
    opts?: { and: (t: Token) => boolean }
  ): Result<Group, ParseError> {
    let tokens = new GroupBuilder()
    let predicate = opts?.and ?? ok
    let next = this.peek()

    if (!Array.isArray(type)) {
      type = [type]
    }

    while (next.type !== 'eof' && (!type.includes(next.type) || !predicate(next)) && next.type !== 'newline') {
      tokens.add(this.next()!)
      next = this.peek()
    }

    let group = tokens.build()

    if (!group) {
      if (next.type === 'eof') {
        return Result.err(ParseError.unexpectedEOF(getLocation(next), type))
      } else {
        return Result.err(ParseError.unexpectedToken(next, type))
      }
    } else {
      return Result.ok(group)
    }
  }
}

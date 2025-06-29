import Lexer, { Token, TokenType } from './lexer'
import { SymbolTable } from './symbol-table'
import { ParseError } from './parse-error'
import { Result } from './result'
import { File } from './parse-node'
import { Group, GroupBuilder } from './group'
import { TupleToUnion } from './types'
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

    while (this.hasNext()) {
      let previous = this.lexer.previous()
      let next = this.peek()

      let newline = (previous?.type ?? 'newline') === 'newline'
      let indented = previous?.endsWithSpace() || next.beginsWithSpace()

      if (newline && !indented) {
        break
      } else {
        this.next()
      }
    }
  }

  public skipIf(): Token | undefined
  public skipIf<T extends TokenType>(type: T): Token<T> | undefined
  public skipIf<T extends readonly TokenType[]>(types: T): Token<TupleToUnion<T>> | undefined
  public skipIf(types?: TokenType | TokenType[]): Token | undefined {
    let nextType = this.peek().type
    let acceptedTypes = Array.isArray(types) ? types : [types]

    if (acceptedTypes.includes(nextType)) {
      return this.next()
    }
  }

  public peekType(type: TokenType, ...alt: TokenType[]): boolean {
    let types = [type, ...alt]
    return types.includes(this.lexer.peek().type)
  }

  public next(): Token {
    return this.lexer.next()
  }

  public hasNext(): boolean {
    return this.lexer.hasNext()
  }

  public lineHasNext(): boolean {
    let next = this.lexer.peek()
    if (next.type === 'eof') return false

    return next.type !== 'newline'
  }

  public peek(): Token {
    return this.lexer.peek()
  }

  public ifPeek<T extends TokenType, R>(type: T, f: () => Result<R, ParseError>): Result<R | undefined, ParseError> {
    return this.peekType(type) ? f() : Result.ok(undefined)
  }

  public nextIsIndented(): boolean {
    let eof = this.peek().type === 'eof'
    let newLine = this.lexer.previous()?.type ?? 'newline' === 'newline'
    let indented = this.lexer.previous()?.endsWithSpace() || this.peek().beginsWithSpace()
    return !eof && newLine && indented
  }

  private getPreviousLocation(): Location {
    let previous = this.lexer.previous()
    return previous ? getLocation(previous) : defaultLocation()
  }

  public expect<T extends TokenType>(type: T): Result<Token<T>, ParseError>
  public expect<T extends TokenType>(...types: T[]): Result<Token<T>, ParseError>
  public expect(type: TokenType, ...alt: TokenType[]): Result<Token, ParseError> {
    let next = this.next()
    let types = [type, ...alt]

    if (next.type === 'eof') {
      let location = this.getPreviousLocation()
      return Result.err(ParseError.unexpectedEOF(location, types))
    }

    if (!types.includes(next.type)) {
      return Result.err(ParseError.unexpectedToken(next, types))
    }

    return Result.ok(next)
  }

  public expectIdentifier(name: string): Result<Token<'identifier'>, ParseError> {
    return this.expect('identifier').andThen(token => {
      if (token.innerText() !== name) {
        return Result.err(ParseError.unexpectedToken(token, `identifier`))
      }

      return Result.ok(token)
    })
  }

  public expectHardSpace(): Result<void, ParseError> {
    if (this.peek().beginsWithHardSpace() || this.lexer.previous()?.endsWithHardSpace()) {
      return Result.ok(undefined)
    }

    let err = ParseError.unexpectedToken(this.peek(), 'hard space')
    return Result.err(err)
  }

  public skipIfIdentifier(name: string): Token<'identifier'> | undefined {
    let next = this.peek()
    if (next.type === 'identifier' && next.innerText() === name) {
      return this.next() as Token<'identifier'>
    }
    return undefined
  }

  public expectEndOfLine(): Result<Token<'eof'> | Token<'newline'>, ParseError> {
    let next = this.next()
    let lineEnding: TokenType[] = ['newline', 'eof']

    return lineEnding.includes(next.type)
      ? Result.ok(next as Token<'eof'> | Token<'newline'>)
      : Result.err(ParseError.unexpectedToken(next, 'newline'))
  }

  /**
   * Special form of `expect` that expects an integer token. Similar to `expect('number')`, but numeric tokens may not be decimals, NaN, or Infinity.
   * @returns A Result containing the token if it is an integer, or a ParseError if it is not.
   */
  public expectInteger(): Result<Token<'number'>, ParseError> {
    return this.expect('number').andThen(token => {
      if (!Number.isInteger(parseFloat(token.innerText()))) {
        return Result.err(ParseError.invalidInteger(token))
      }

      return Result.ok(token)
    })
  }

  public inlineSpace(): Result<void, ParseError> {
    if (!this.lineHasNext()) {
      return Result.ok(undefined)
    }

    let before = this.lexer.previous()?.endsWithSpace() ?? false
    let after = this.peek().beginsWithSpace()

    if (before || after) {
      return Result.ok(undefined)
    }

    let err = ParseError.unexpectedToken(this.peek())
    return Result.err(err)
  }

  /**
   * Consumes tokens until a newline or the end of file is encountered.
   * @returns All tokens consumed
   */
  public slurp(): Result<Group, ParseError> {
    return this.slurpUntil('newline')
  }

  public slurpOpt(): Group | undefined {
    return this.slurp().unwrapOr(undefined)
  }

  public slurpUntilHardSpace(): Result<Group, ParseError> {
    let tokens = new GroupBuilder()
    let next = this.peek()

    while (next.type !== 'eof' && next.type !== 'newline' && !next.beginsWithHardSpace()) {
      tokens.add(this.next())
      if (next.endsWithHardSpace()) {
        break
      }

      next = this.peek()
    }

    let group = tokens.build()

    if (!group) {
      if (next.type === 'eof') {
        return Result.err(ParseError.unexpectedEOF(getLocation(next)))
      } else {
        return Result.err(ParseError.unexpectedToken(next))
      }
    } else {
      return Result.ok(group)
    }
  }

  public ifLineHasNext<T>(f: () => Result<T, ParseError>): Result<T | undefined, ParseError> {
    return this.lineHasNext() ? f() : Result.ok(undefined)
  }

  public whileIndented<T>(f: () => Result<T, ParseError>): Result<T[], ParseError> {
    let result: T[] = []

    while (this.hasNext()) {
      if (!this.nextIsIndented()) {
        break
      }

      let next = f().andThen(value => {
        return this.expectEndOfLine().map(() => value)
      })

      if (next.isErr()) {
        return next
      }

      result.push(next.unwrap())
    }

    return Result.ok(result)
  }

  public untilSequence(
    end: string,
    ...rest: string[]
  ): Result<[Group | undefined, ...Token<'identifier'>[]], ParseError> {
    let search = [end, ...rest]
    let searchIndex = 0
    let buffer = new GroupBuilder()
    let identifiers: Token<'identifier'>[] = []

    while (searchIndex < search.length) {
      let next = this.next()

      if (next.type === 'eof') {
        let err = ParseError.unexpectedEOF(getLocation(next), ['identifier'])
        return Result.err(err)
      }

      if (next.type === 'identifier' && next.innerText() === search[searchIndex]) {
        searchIndex++
        identifiers.push(next as Token<'identifier'>)
      } else {
        searchIndex = 0
        for (let identifier of identifiers) {
          buffer.add(identifier)
        }
        buffer.add(next)
      }
    }

    return Result.ok([buffer.build(), ...identifiers])
  }

  /**
   * Consumes tokens until the specified type is encountered, a newline, or the
   * end of file.
   * @param type The type of token to consume until
   * @returns All tokens consumed until the specified type, newline, or end of
   *    file is encountered
   */
  public slurpUntil(type: TokenType | TokenType[]): Result<Group, ParseError> {
    let tokens = new GroupBuilder()
    let next = this.peek()

    if (!Array.isArray(type)) {
      type = [type]
    }

    while (next.type !== 'eof' && !type.includes(next.type) && next.type !== 'newline') {
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

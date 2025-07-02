import type { Token } from './token'
import { combineSpans, Span } from './location'
import { TokenType } from './lexer'

export class GroupBuilder {
  private tokens: Token<TokenType>[] = []

  public add(token: Token<TokenType>): GroupBuilder {
    this.tokens.push(token)
    return this
  }

  public append(group: Group | undefined): GroupBuilder {
    if (group) {
      for (let token of group) {
        this.tokens.push(token)
      }
    }

    return this
  }

  public build(): Group | undefined {
    if (this.tokens.length === 0) {
      return undefined
    }

    // SAFETY: empty set of tokens was already checked above
    return Group.UNSAFE_nonEmpty(...this.tokens)
  }
}

export class Group {
  private tokens: Token<TokenType>[]
  public readonly type = 'group'

  /**
   * Create a new Group instance with the provided tokens. The runtime cannot ensure that the tokens
   * are non-empty; it's the caller's responsibility to ensure that. Creating empty groups of tokens
   * will lead to crashes while parsing because no location metadata can be derived from them.
   * @param tokens A non-empty array of tokens.
   * @returns A new Group instance containing the provided tokens.
   */
  public static UNSAFE_nonEmpty(...tokens: Token<TokenType>[]): Group {
    return new Group(...tokens)
  }

  private constructor(...tokens: Token<TokenType>[]) {
    this.tokens = tokens
  }

  public get length() {
    return this.tokens.length
  }

  public get span(): Span {
    return combineSpans(this.tokens[0].span, this.tokens[this.tokens.length - 1].span)
  }

  public innerText(): string {
    if (this.tokens.length < 2) {
      return this.tokens[0].innerText()
    }

    return this.tokens.reduce((acc, token, i) => {
      if (i === 0) {
        return acc + token.outerText().trimStart()
      }

      if (i === this.tokens.length - 1) {
        return acc + token.outerText().trimEnd()
      }

      return acc + token.outerText()
    }, '')
  }

  public outerText(): string {
    return this.tokens.map(t => t.outerText()).join('')
  }

  public innerLength(): number {
    return this.innerText().length
  }

  public outerLength(): number {
    return this.outerText().length
  }

  public beginsWithSpace(): boolean {
    return this.tokens[0].beginsWithSpace()
  }

  public endsWithSpace(): boolean {
    return this.tokens[this.tokens.length - 1].endsWithSpace()
  }

  public beginsWithHardSpace(): boolean {
    return this.tokens[0].beginsWithHardSpace()
  }

  public endsWithHardSpace(): boolean {
    return this.tokens[this.tokens.length - 1].endsWithHardSpace()
  }

  public push(token: Token<TokenType>) {
    this.tokens.push(token)
  }

  public concat(...groups: Group[]) {
    let newGroup = new Group(...this.tokens)
    for (let group of groups) {
      newGroup.tokens.push(...group.tokens)
    }

    return newGroup
  }

  public [Symbol.iterator]() {
    return this.tokens[Symbol.iterator]()
  }
}

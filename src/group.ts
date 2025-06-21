import type { Token } from './lexer'
import type { Location } from './location'

export class GroupBuilder {
  private tokens: Token[] = []

  public add(token: Token): GroupBuilder {
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
  private tokens: Token[]
  public readonly type = 'group'

  /**
   * Create a new Group instance with the provided tokens. The runtime cannot ensure that the tokens
   * are non-empty; it's the caller's responsibility to ensure that. Creating empty groups of tokens
   * will lead to crashes while parsing because no location metadata can be derived from them.
   * @param tokens A non-empty array of tokens.
   * @returns A new Group instance containing the provided tokens.
   */
  public static UNSAFE_nonEmpty(...tokens: Token[]): Group {
    return new Group(...tokens)
  }

  private constructor(...tokens: Token[]) {
    this.tokens = tokens
  }

  public get length() {
    return this.tokens.length
  }

  public get location(): Location {
    return {
      line: this.tokens[0].line,
      column: this.tokens[0].col,
      offset: this.tokens[0].offset,
    }
  }

  public push(token: Token) {
    this.tokens.push(token)
  }

  public concat(...groups: Group[]) {
    let newGroup = new Group(...this.tokens)
    for (let group of groups) {
      newGroup.tokens.push(...group.tokens)
    }

    return newGroup
  }

  public toString() {
    return this.tokens.map(t => t.text).join('')
  }

  public [Symbol.iterator]() {
    return this.tokens[Symbol.iterator]()
  }
}

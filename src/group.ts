import type { Token } from './lexer'
import type { Location } from './location'

export class Group {
  private tokens: Token[]
  public readonly type = 'group'

  constructor(...tokens: Token[]) {
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

  public isEmpty(): boolean {
    return this.tokens.length === 0
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

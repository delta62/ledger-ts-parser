import type { Token } from './lexer'

export class Group {
  private tokens: Token[]
  public readonly type = 'group'

  constructor(...tokens: Token[]) {
    this.tokens = tokens
  }

  public get length() {
    return this.tokens.length
  }

  public get location() {
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

  public toString() {
    return this.tokens.map(t => t.text).join('')
  }

  public [Symbol.iterator]() {
    return this.tokens[Symbol.iterator]()
  }
}

export interface Node<T> {
  type: T
}

export interface Location {
  line: number
  column: number
  offset: number
}

export interface AccountRef extends Node<'accountRef'> {
  name: Group
}

export interface Payee extends Node<'payee'> {
  name: Group
}

export interface DateNode extends Node<'date'> {
  parsed: Date
  raw: Group
}

export interface Amount extends Node<'amount'> {
  amount: Token
  parsedAmount: number
  commodity: Group
  unitPlacement: 'pre' | 'post'
}

export interface Comment extends Node<'comment'> {
  comment: Token
}

export interface AuxDate extends Node<'auxDate'> {
  equal: Token
  date: DateNode
}

export interface Code extends Node<'code'> {
  lparen: Token
  contents: Group
  rparen: Token
}

export interface Transaction extends Node<'transaction'> {
  date: DateNode
  auxDate?: AuxDate
  cleared?: Token
  pending?: Token
  code?: Code
  payee?: Payee
  comments: Comment[]
  postings: Posting[]
}

export interface Posting extends Node<'posting'> {
  account: AccountRef
  amount?: Amount
  comments: Comment[]
}

export interface Directive extends Node<'directive'> {
  name: Token
  arg?: Group
  subDirectives: SubDirective[]
}

export interface SubDirective extends Node<'subDirective'> {
  key: Token
  value?: Group
}

export type ASTChild = Transaction | Directive

export interface AST {
  children: ASTChild[]
}

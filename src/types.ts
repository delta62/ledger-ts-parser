import type { Token } from './lexer'
import type { Group } from './group'

export interface Node<T> {
  type: T
}

export interface AccountRef extends Node<'accountRef'> {
  name: Group
}

export interface Payee extends Node<'payee'> {
  name: Group
}

export interface DateNode extends Node<'date'> {
  raw: Group
}

export interface Amount extends Node<'amount'> {
  amount: Token<'number'>
  minus?: Token<'hyphen'>
  commodity: Group
  unitPlacement: 'pre' | 'post'
}

export interface Comment extends Node<'comment'> {
  comment: Token<'comment'>
  commentChar: string
  text: string
  tags: Record<string, string | undefined>
  typedTags: Record<string, unknown>
}

export interface AuxDate extends Node<'auxDate'> {
  equal: Token<'equal'>
  date: DateNode
}

export interface Code extends Node<'code'> {
  lparen: Token<'lparen'>
  contents: Group
  rparen: Token<'rparen'>
}

export interface Transaction extends Node<'transaction'> {
  date: DateNode
  auxDate?: AuxDate
  cleared?: Token<'star'>
  pending?: Token<'bang'>
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
  name: Token<'identifier'>
  arg?: Group
  subDirectives: SubDirective[]
}

export interface SubDirective extends Node<'subDirective'> {
  key: Token<'identifier'>
  value?: Group
}

export type ASTChild = Transaction | Directive | Comment

export interface AST {
  children: ASTChild[]
}

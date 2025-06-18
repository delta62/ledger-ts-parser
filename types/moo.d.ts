export as namespace moo

/**
 * Reserved token for indicating a parse fail.
 */
export interface ErrorRule {
  error: true
}

export let error: ErrorRule

/**
 * Reserved token for indicating a fallback rule.
 */
export interface FallbackRule {
  fallback: true
}

export let fallback: FallbackRule

export type TypeMapper = (x: string) => string

export function keywords(kws: Record<string, string | string[]>): TypeMapper

export function compile<R extends Rules>(rules: R): Lexer<R>

export function states(states: Record<string, Rules>, start?: string): Lexer

export interface Rule<T> {
  match?: RegExp | string | string[]
  /**
   * Moo tracks detailed information about the input for you.
   * It will track line numbers, as long as you apply the `lineBreaks: true`
   * option to any tokens which might contain newlines. Moo will try to warn you if you forget to do this.
   */
  lineBreaks?: boolean
  /**
   * Moves the lexer to a new state, and pushes the old state onto the stack.
   */
  push?: string
  /**
   * Returns to a previous state, by removing one or more states from the stack.
   */
  pop?: number
  /**
   * Moves to a new state, but does not affect the stack.
   */
  next?: string
  /**
   * You can have a token type that both matches tokens and contains error values.
   */
  error?: true
  /**
   * Moo doesn't allow capturing groups, but you can supply a transform function, value(),
   * which will be called on the value before storing it in the Token object.
   */
  value?: (x: string) => T

  /**
   * Used for mapping one set of types to another.
   * See https://github.com/no-context/moo#keywords for an example
   */
  type?: TypeMapper
}
export type Rules = Record<string, RegExp | RegExp[] | string | string[] | Rule | Rule[] | ErrorRule | FallbackRule>

export interface Lexer<R extends Rules> {
  /**
   * Returns a string with a pretty error message.
   */
  formatError(token?: Token<R>, message?: string): string
  /**
   * @deprecated since 0.5.0. Now just returns true
   */
  has(tokenType: string): boolean
  /**
   * When you reach the end of Moo's internal buffer, next() will return undefined.
   * You can always reset() it and feed it more data when that happens.
   */
  next(): Token<R> | undefined
  /**
   * Empty the internal buffer of the lexer, and set the line, column, and offset counts back to their initial value.
   */
  reset(chunk?: string, state?: LexerState): this
  /**
   * Returns current state, which you can later pass it as the second argument
   * to reset() to explicitly control the internal state of the lexer.
   */
  save(): LexerState
  /**
   * Transitions to the provided state and pushes the state onto the state
   * stack.
   */
  pushState(state: string): void
  /**
   * Returns back to the previous state in the stack.
   */
  popState(): void
  /**
   * Transitiosn to the provided state. Does not push onto the state stack.
   */
  setState(state: string): void

  [Symbol.iterator](): Iterator<Token<R>>
}

export interface Token<R extends Rules, T extends keyof R = keyof R> {
  /**
   * Returns value of the token, or its type if value isn't available.
   */
  toString(): string
  /**
   * The name of the group, as passed to compile.
   */
  type: T
  /**
   * The match contents.
   */
  value: T extends keyof R ? ReturnType<R[T]['value']> : unknown
  /**
   * The number of bytes from the start of the buffer where the match starts.
   */
  offset: number
  /**
   * The complete match.
   */
  text: string
  /**
   * The number of line breaks found in the match. (Always zero if this rule has lineBreaks: false.)
   */
  lineBreaks: number
  /**
   * The line number of the beginning of the match, starting from 1.
   */
  line: number
  /**
   * The column where the match begins, starting from 1.
   */
  col: number
}

export interface LexerState {
  line: number
  col: number
  state: string
}

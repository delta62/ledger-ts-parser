import type { Token } from './lexer'

export interface Location {
  line: number
  column: number
  offset: number
}

export function getLocation(token: Token): Location {
  return {
    line: token.line,
    column: token.col,
    offset: token.offset,
  }
}

export function defaultLocation(): Location {
  return {
    line: 1,
    column: 1,
    offset: 0,
  }
}

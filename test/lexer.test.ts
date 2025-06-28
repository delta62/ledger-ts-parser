import { describe, it, expect } from 'vitest'
import Lexer, { Token } from '../src/lexer'

function lexAll(input: string, opts?: { keepNewlines?: boolean; keepEof?: boolean }): Token[] {
  let lexer = new Lexer(input)
  let tokens: Token[] = []
  let keepNewlines = opts?.keepNewlines ?? false
  let keepEof = opts?.keepEof ?? false

  for (let token of lexer) {
    if (token.type === 'eof' && !keepEof) {
      break
    }

    if (token.type === 'newline' && !keepNewlines) {
      continue
    }

    tokens.push(token)
  }

  return tokens
}

function lexOne(input: string): Token {
  let lexer = new Lexer(input)
  let next = lexer.next()
  let next2 = lexer.next()

  expect(next).not.toHaveProperty('type', 'eof')
  expect(next2).toHaveProperty('type', 'eof')

  return next
}

describe('Lexer', () => {
  it('lexes empty input', () => {
    let tokens = lexAll('')
    expect(tokens.length).toBe(0)
  })

  it('is an iterable', () => {
    let lexer = new Lexer('1 2 3 !')
    let tokens = Array.from(lexer).filter(t => t.type !== 'eof')

    expect(tokens.length).toBe(4)
    expect(tokens[0].type).toBe('number')
    expect(tokens[1].type).toBe('number')
    expect(tokens[2].type).toBe('number')
    expect(tokens[3].type).toBe('bang')
  })

  it('lexes newline', () => {
    let token = lexOne('\n')
    expect(token).toHaveTokenType('newline')
  })

  it('lexes windows newline', () => {
    let token = lexOne('\r\n')
    expect(token).toHaveTokenType('newline')
  })

  it('lexes comment', () => {
    let token = lexOne('; this is a comment')
    expect(token).toHaveTokenType('comment')
    expect(token.innerText()).toBe('; this is a comment')
  })

  it('lexes integer', () => {
    let token = lexOne('2024')
    expect(token).toHaveTokenType('number')
    expect(token.innerText()).toBe('2024')
  })

  it('lexes cleared', () => {
    // Must start with whitespace so it isn't interpreted as a comment
    let [token] = lexAll(' *')
    expect(token).toHaveTokenType('star')
  })

  it('lexes pending', () => {
    let token = lexOne('!')
    expect(token).toHaveTokenType('bang')
  })

  it('lexes identifiers', () => {
    let token = lexOne('someString')
    expect(token).toHaveTokenType('identifier')
    expect(token.innerText()).toBe('someString')
  })

  it('lexes at', () => {
    let at = lexOne('@')
    expect(at).toHaveTokenType('at')
  })

  it('lexes number', () => {
    let token = lexOne('123.45')
    expect(token).toHaveTokenType('number')
    expect(token.innerText()).toBe('123.45')
  })

  it('lexes hyphen separately from numbers', () => {
    let [hyphen, amount] = lexAll('-123.45')
    expect(hyphen).toHaveTokenType('hyphen')
    expect(amount).toHaveTokenType('number')
  })

  it('lexes numbers with commas', () => {
    let num = lexOne('1,234.56')
    expect(num).toHaveTokenType('number')
    expect(num.innerText()).toBe('1,234.56')
  })

  it('lexes symbols', () => {
    let [currency, amount] = lexAll('€ 123,45')
    expect(currency).toHaveTokenType('symbol')
    expect(amount).toHaveTokenType('number')
  })

  it('lexes symbols adjacent to numbers', () => {
    let [commodity, amount] = lexAll('€123,45')
    expect(commodity).toHaveTokenType('symbol')
    expect(amount).toHaveTokenType('number')
  })

  it('lexes lparen and rparen', () => {
    let tokens = lexAll('()')
    expect(tokens[0]).toHaveTokenType('lparen')
    expect(tokens[1]).toHaveTokenType('rparen')
  })

  it('lexes lbrace and rbrace', () => {
    let tokens = lexAll('{}')
    expect(tokens[0]).toHaveTokenType('lbrace')
    expect(tokens[1]).toHaveTokenType('rbrace')
  })

  it('lexes lbracket and rbracket', () => {
    let tokens = lexAll('[]')
    expect(tokens[0]).toHaveTokenType('lbracket')
    expect(tokens[1]).toHaveTokenType('rbracket')
  })

  it('lexes colon', () => {
    let token = lexOne(':')
    expect(token).toHaveTokenType('colon')
  })
})

describe('hasNext', () => {
  it('returns false for empty input', () => {
    let lexer = new Lexer('')
    expect(lexer.hasNext()).toBe(false)
  })

  it('returns true if there is at least one token', () => {
    let lexer = new Lexer('foo')
    expect(lexer.hasNext()).toBe(true)
  })

  it('returns false after all tokens are consumed', () => {
    let lexer = new Lexer('foo')
    while (lexer.next().type !== 'eof') {
      /* consume all tokens */
    }
    expect(lexer.hasNext()).toBe(false)
  })

  it('returns true before consuming the last token', () => {
    let lexer = new Lexer('-=')
    expect(lexer.hasNext()).toBe(true)
    lexer.next() // -
    expect(lexer.hasNext()).toBe(true)
    lexer.next() // =
    expect(lexer.hasNext()).toBe(false)
  })

  it('does not advance the lexer', () => {
    let lexer = new Lexer('foo')
    expect(lexer.hasNext()).toBe(true)
    let token = lexer.next()
    expect(token.innerText()).toBe('foo')
    expect(lexer.hasNext()).toBe(false)
  })
})

describe('whitespace', () => {
  it('eagerly consumes whitespace', () => {
    let tokens = lexAll('  foo  bar  ')
    let [foo, bar] = tokens
    expect(tokens.length).toBe(2)

    expect(foo.innerText()).toBe('foo')
    expect(foo.outerText()).toBe('  foo  ')

    expect(bar.innerText()).toBe('bar')
    expect(bar.outerText()).toBe('bar  ')
  })

  it('parses input with only whitespace', () => {
    let tokens = lexAll('\t  ', { keepEof: true })

    expect(tokens).toHaveLength(1)

    expect(tokens[0]).toHaveTokenType('eof')
    expect(tokens[0].innerText()).toBe('')
    expect(tokens[0].outerText()).toBe('\t  ')
  })
})

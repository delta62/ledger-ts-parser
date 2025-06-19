import { describe, it, expect } from 'vitest'
import Lexer, { Token } from '../src/lexer'
import { Group } from '../src/group'

function lexAll(input: string, opts?: { keepWhitespace?: boolean }): Token[] {
  let lexer = new Lexer(input)
  let tokens: Token[] = []
  let keepWhitespace = opts?.keepWhitespace ?? false

  while (true) {
    let token = lexer.next()

    if (!token) {
      break
    }

    if (!keepWhitespace && (token.type === 'ws' || token.type === 'newline')) {
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

  expect(next).toBeDefined()
  expect(next2, 'Expected only one token in the stream, but got multiple').not.toBeDefined()

  return next as Token
}

describe('Lexer', () => {
  it('lexes empty input', () => {
    let tokens = lexAll('')
    expect(tokens.length).toBe(0)
  })

  it('is an iterable', () => {
    let lexer = new Lexer('1 2 3 !')

    let tokens = Array.from(lexer).filter(t => t.type !== 'ws' && t.type !== 'newline')

    expect(tokens.length).toBe(4)
    expect(tokens[0].type).toBe('number')
    expect(tokens[1].type).toBe('number')
    expect(tokens[2].type).toBe('number')
    expect(tokens[3].type).toBe('bang')
  })

  it('lexes whitespace', () => {
    let token = lexOne('   \t')
    expect(token).toHaveTokenType('ws')
    expect(token.value).toBe('   \t')
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
    expect(token.value).toBe('; this is a comment')
  })

  it('lexes integer', () => {
    let token = lexOne('2024')
    expect(token).toHaveTokenType('number')
    expect(token).toHaveProperty('value', '2024')
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

  it('lexes directives', () => {
    let directives = ['include', 'account', 'alias', 'bucket', 'payee', 'tag']
    for (let dir of directives) {
      let token = lexOne(dir)
      expect(token).toHaveTokenType('identifier')
      expect(token.value).toBe(dir)
    }
  })

  it('lexes tag', () => {
    let [at, id] = lexAll('@WholeFoods')
    expect(at).toHaveTokenType('at')
    expect(id).toHaveTokenType('identifier')
    expect(id.value).toBe('WholeFoods')
  })

  it('lexes number', () => {
    let token = lexOne('123.45')
    expect(token).toHaveTokenType('number')
    expect(token).toHaveProperty('value', '123.45')
  })

  it('lexes negative amount', () => {
    let [hyphen, dollar, amount] = lexAll('-$123.45')
    expect(hyphen).toHaveTokenType('hyphen')
    expect(dollar).toHaveTokenType('symbol')
    expect(amount).toHaveProperty('value', '123.45')
  })

  it('lexes negative amount following currency sign', () => {
    let [dollar, hyphen, amount] = lexAll('$-123.45')
    expect(dollar).toHaveTokenType('symbol')
    expect(hyphen).toHaveTokenType('hyphen')
    expect(amount).toHaveProperty('value', '123.45')
  })

  it('lexes amount with comma', () => {
    let [commodity, amount] = lexAll('$1,234.56')
    expect(commodity).toHaveTokenType('symbol')
    expect(commodity.value).toBe('$')
    expect(amount).toHaveTokenType('number')
    expect(amount.value).toBe('1,234.56')
  })

  it('lexes an amount in euros', () => {
    let [currency, amount] = lexAll('€ 123,45')
    expect(currency).toHaveTokenType('symbol')
    expect(amount).toHaveTokenType('number')
    expect(amount).toHaveProperty('value', '123,45')
  })

  it('lexes an amount in euros with no space', () => {
    let [commodity, amount] = lexAll('€123,45')
    expect(commodity).toHaveTokenType('symbol')
    expect(commodity).toHaveProperty('text', '€')
    expect(amount).toHaveTokenType('number')
    expect(amount).toHaveProperty('value', '123,45')
  })

  it('lexes account', () => {
    let tokens = lexAll('Assets:Bank:Checking')
    let group = new Group(...tokens)
    expect(group.toString()).toBe('Assets:Bank:Checking')
  })

  it('lexes lparen and rparen', () => {
    let tokens = lexAll('()')
    expect(tokens[0]).toHaveTokenType('lparen')
    expect(tokens[1]).toHaveTokenType('rparen')
  })

  it('lexes colon', () => {
    let token = lexOne(':')
    expect(token).toHaveTokenType('colon')
  })

  it('lexes at', () => {
    let token = lexOne('@')
    expect(token).toHaveTokenType('at')
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
    while (lexer.next()) {
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
    expect(token?.value).toBe('foo')
    expect(lexer.hasNext()).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { Parser } from '../src/parser'
import { Lexer } from '../src/lexer'
import { ASTChild, Transaction, Posting, Directive, SubDirective, File } from '../src/parse-node'

function parse(input: string) {
  let lexer = new Lexer(input)
  let parser = new Parser(lexer)
  return parser.parse()
}

function parseTransaction(input: string): Transaction {
  let result = parse(input)
  let { file } = result
  let tx = getChild(file, 0, 'transaction')

  expect(result).not.toHaveDiagnostic()
  expect(file.children).toHaveLength(1)
  expect(tx).toHaveProperty('type', 'transaction')

  return tx as Transaction
}

function parsePosting(input: string): Posting {
  let tx = parseTransaction(input)
  expect(tx.postings).toHaveLength(1)
  return tx.postings[0]
}

function parseDirective(input: string): Directive {
  let result = parse(input)
  let { file } = result
  expect(result).not.toHaveDiagnostic()
  expect(file.children).toHaveLength(1)

  let directive = getChild(file, 0, 'directive')
  expect(directive).toHaveProperty('type', 'directive')

  return directive
}

function getChild<T extends ASTChild['type']>(
  file: File,
  index: number,
  type: T
): Extract<File['children'][number], { type: T }> {
  let child = file.children[index]
  expect(child, `Expected child at index ${index} to exist, but it didn't.`).toBeDefined()
  expect(child, `Expected child at index ${index} to have type ${type}, but it was ${child.type}`).toHaveProperty(
    'type',
    type
  )
  return child as Extract<File['children'][number], { type: T }>
}

function getSubDirective(directive: Directive, key: string): SubDirective {
  let subDirective = directive.subDirectives.find(d => d.key.innerText() === key)
  expect(subDirective).toBeDefined()
  return subDirective!
}

interface PostingSpec {
  account: string
  amount?: string
}

interface TransactionSpec {
  date: string
  auxDate: string
  payee: string
  pending: boolean
  cleared: boolean
  postings: PostingSpec[]
}

function formatTransaction(spec: Partial<TransactionSpec> = {}): string {
  let date = spec.date || '2024-06-12'
  let auxDate = spec.auxDate ? `=${spec.auxDate}` : ''
  let payee = spec.payee || 'Test Payee'
  let pending = spec.pending ? ' !' : ''
  let cleared = spec.cleared ? ' *' : ''
  let postings = spec.postings || [{ account: 'Assets:Bank:Checking', amount: '$100.00' }]

  let postingLines = postings
    .map(p => {
      let line = `  ${p.account}`
      if (p.amount) {
        line += `  ${p.amount}`
      }
      return line
    })
    .join('\n')

  return `${date}${auxDate}${pending}${cleared} ${payee}\n${postingLines}`
}

describe('Ledger Parser', () => {
  it('adds accounts in postrings to the symbol table', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking', amount: '$100.00' }] })
    let result = parse(input)

    expect(result.accounts).toHaveSymbol('Assets:Bank:Checking')
  })

  it('fails to parse transactions beginning with whitespace', () => {
    let input = '  2024-06-12 Test Payee'
    expect(input).failsToParse(/leading space/i)
  })
})

describe('Dates', () => {
  it('parses dates in YYYY-MM-DD format', () => {
    let input = formatTransaction({ date: '2024-06-12' })
    let tx = parseTransaction(input)

    expect(tx).toHaveDate('2024-06-12')
  })

  it('parses dates in YYYY-M-D format', () => {
    let input = formatTransaction({ date: '2024-6-2' })
    let tx = parseTransaction(input)

    expect(tx).toHaveDate('2024-6-2')
  })

  it('parses dates in YYYY/MM/DD format', () => {
    let input = formatTransaction({ date: '2024/06/12' })
    let tx = parseTransaction(input)

    expect(tx).toHaveDate('2024/06/12')
  })

  it('parses dates in YY/M/D format', () => {
    let input = formatTransaction({ date: '24/6/1' })
    let tx = parseTransaction(input)

    expect(tx).toHaveDate('24/6/1')
  })

  it('parses dates in YYYY/MM format', () => {
    let input = formatTransaction({ date: '2024/12' })
    let tx = parseTransaction(input)

    expect(tx).toHaveDate('2024/12')
  })

  it('parses dates in MM/DD format', () => {
    let input = formatTransaction({ date: '06/12' })
    let tx = parseTransaction(input)

    expect(tx).toHaveDate(`06/12`)
  })

  it('fails to parse dates with non-numeric characters', () => {
    let input = formatTransaction({ date: '2024-06-12abc' })
    expect(input).failsToParse(/unexpected token/i)
  })

  it('fails to parse dates with decimal points', () => {
    let input = formatTransaction({ date: '2024-06-12.5' })
    expect(input).failsToParse(/integer/i)
  })
})

describe('auxiliary dates', () => {
  it('parses auxiliary dates', () => {
    let input = formatTransaction({ date: '2024-06-12', auxDate: '2024-06-13' })
    let tx = parseTransaction(input)

    expect(tx).toHaveAuxDate('2024-06-13')
  })

  it('fails to parse auxiliary with only an equal sign', () => {
    let input = '2024-06-12= Grocery Store'
    expect(input).failsToParse(/Unexpected token/i)
  })
})

describe('transaction flags', () => {
  it('parses cleared transactions', () => {
    let input = formatTransaction({ payee: 'Test Payee', cleared: true })
    let tx = parseTransaction(input)

    expect(tx).toBeCleared()
    expect(tx).not.toBePending()
    expect(tx).toHavePayee('Test Payee')
  })

  it('parses pending transactions', () => {
    let input = formatTransaction({ payee: 'Test Payee', pending: true })
    let tx = parseTransaction(input)

    expect(tx).toBePending()
    expect(tx).not.toBeCleared()
    expect(tx).toHavePayee('Test Payee')
  })

  it('parses transactions with no flags', () => {
    let input = formatTransaction({ payee: 'Test Payee' })
    let tx = parseTransaction(input)
    expect(tx).not.toBePending()
    expect(tx).not.toBeCleared()
    expect(tx).toHavePayee('Test Payee')
  })

  describe('multiple flags', () => {
    it('fails to parse transactions with both flags, cleared first', () => {
      let input = '2024-06-12 *! Test Payee'
      expect(input).failsToParse(/Unexpected token/i)
    })

    it('parses transactions with both flags, pending first', () => {
      let input = '2024-06-12 !* Test Payee'
      expect(input).failsToParse(/Unexpected token/i)
    })
  })
})

describe('payees', () => {
  describe('no payee', () => {
    it('parses transactions that end in newline', () => {
      let input = '2024-06-12\n'
      let tx = parseTransaction(input)

      expect(tx).not.toHavePayee()
    })

    it('parses transactions that end in spaces and then newline', () => {
      let input = '2024-06-12    \n'
      let tx = parseTransaction(input)

      expect(tx).not.toHavePayee()
    })

    it('parses transactions that end in EOF', () => {
      let input = '2024-06-12    \n'
      let tx = parseTransaction(input)

      expect(tx).not.toHavePayee()
    })

    it('parses transactions that end in spaces and then EOF', () => {
      let input = '2024-06-12    '
      let tx = parseTransaction(input)

      expect(tx).not.toHavePayee()
    })
  })

  it('parses payees', () => {
    let input = formatTransaction({ payee: 'KFC' })
    let tx = parseTransaction(input)

    expect(tx).toHavePayee('KFC')
  })

  it('parses payees with spaces', () => {
    let input = formatTransaction({ payee: 'Local Coffee Shop' })
    let tx = parseTransaction(input)

    expect(tx).toHavePayee('Local Coffee Shop')
  })

  it('parses payees with big spaces', () => {
    let input = formatTransaction({ payee: 'Local\tCoffee   Shop' })
    let tx = parseTransaction(input)

    expect(tx).toHavePayee('Local\tCoffee   Shop')
  })

  it('parses payees with special characters', () => {
    let input = formatTransaction({ payee: 'Grocery Store & Co.' })
    let tx = parseTransaction(input)

    expect(tx).toHavePayee('Grocery Store & Co.')
  })

  it('adds payees to the symbol table', () => {
    let input = formatTransaction({ payee: 'Grocery Store' })
    let result = parse(input)

    expect(result.payees).toHaveSymbol('Grocery Store')
  })
})

describe('postings', () => {
  it('parses account names', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking' }] })
    let posting = parsePosting(input)

    expect(posting).toHaveAccountName('Assets:Bank:Checking')
  })

  it('parses account names with special characters', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:l33tsp#@K' }] })
    let posting = parsePosting(input)

    expect(posting).toHaveAccountName('Assets:Bank:l33tsp#@K')
  })

  it('parses account names with spaces', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking Account' }] })
    let posting = parsePosting(input)

    expect(posting).toHaveAccountName('Assets:Bank:Checking Account')
  })

  it('parses postings with amounts', () => {
    let input = formatTransaction({
      postings: [{ account: 'Assets:Bank:Checking', amount: '100 USD' }],
    })
    let posting = parsePosting(input)

    expect(posting).toHaveAmount('100')
    expect(posting).toHaveCommodity('USD', { position: 'post' })
  })

  describe('virtual accounts', () => {
    it('parses virtual accounts', () => {
      let input = formatTransaction({ postings: [{ account: '(Assets:Virtual:Account)' }] })
      let posting = parsePosting(input)

      expect(posting).toHaveAccountName('Assets:Virtual:Account')
      expect(posting).toBeVirtual({ balanced: false })
    })

    it('parses balancing virtual accounts', () => {
      let input = formatTransaction({ postings: [{ account: '[Assets:Virtual:Account]' }] })
      let posting = parsePosting(input)

      expect(posting).toHaveAccountName('Assets:Virtual:Account')
      expect(posting).toBeVirtual({ balanced: true })
    })

    it('parses virtual accounts with amounts', () => {
      let input = formatTransaction({ postings: [{ account: '(Assets:Virtual:Account)', amount: '$300' }] })
      let posting = parsePosting(input)

      expect(posting).toHaveAccountName('Assets:Virtual:Account')
      expect(posting).toHaveAmount('300')
      expect(posting).toHaveCommodity('$', { position: 'pre' })
      expect(posting).toBeVirtual({ balanced: false })
    })

    it('fails to parse unbalanced parentheses in virtual accounts', () => {
      let input = formatTransaction({ postings: [{ account: '(Assets:Virtual:Account]', amount: '$300' }] })
      expect(input).failsToParse(/rparen/i)
    })

    it('fails to parse unbalanced brackets balanced in virtual accounts', () => {
      let input = formatTransaction({ postings: [{ account: '[Assets:Virtual:Account', amount: '$300' }] })
      expect(input).failsToParse(/rbracket/i)
    })

    it('parses balancing virtual accounts with amounts', () => {
      let input = formatTransaction({ postings: [{ account: '[Assets:Virtual:Account]', amount: '$300' }] })
      let posting = parsePosting(input)

      expect(posting).toHaveAccountName('Assets:Virtual:Account')
      expect(posting).toHaveAmount('300')
      expect(posting).toHaveCommodity('$', { position: 'pre' })
      expect(posting).toBeVirtual({ balanced: true })
    })

    it('fails to parse virtual accounts with no hard space before the amount', () => {
      let input = '2024-06-12 Test Payee\n  (Assets:Virtual:Account) $300'
      expect(input).failsToParse(/unexpected token/i)
    })

    it('fails to parse balanced virtual accounts with no hard space before the amount', () => {
      let input = '2024-06-12 Test Payee\n  [Assets:Virtual:Account]$300'
      expect(input).failsToParse(/unexpected token/i)
    })
  })

  it('parses postings with negative amounts', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking', amount: '-$100.00' }] })
    let posting = parsePosting(input)

    expect(posting).toHaveAmount('-100.00')
    expect(posting).toHaveCommodity('$', { position: 'pre' })
  })

  it('parses postings with zero amounts', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking', amount: '0 AAPL' }] })
    let posting = parsePosting(input)

    expect(posting).toHaveAmount('0')
    expect(posting).toHaveCommodity('AAPL', { position: 'post' })
  })

  it('parses postings with no amount', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking' }] })
    let posting = parsePosting(input)

    expect(posting).not.toHaveAmount()
    expect(posting).not.toHaveCommodity()
  })

  it('parses postings with no amounts but trailing spaces', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking', amount: '   ' }] })
    let posting = parsePosting(input)

    expect(posting).not.toHaveAmount()
    expect(posting).not.toHaveCommodity()
  })

  it('parses multiple postings', () => {
    let input = formatTransaction({
      postings: [
        { account: 'Assets:Bank:Checking', amount: '$100.00' },
        { account: 'Expenses:Food', amount: '$50.00' },
      ],
    })
    let { postings } = parseTransaction(input)

    expect(postings).toHaveLength(2)
  })

  it('parses postings with amounts in different formats', () => {
    let input = formatTransaction({
      postings: [
        { account: 'Assets:Bank:Checking', amount: '$100' },
        { account: 'Expenses:Food', amount: '€50,25' },
        { account: 'Liabilities:CreditCard', amount: '30.1 AAPL' },
      ],
    })
    let { postings } = parseTransaction(input)
    let [first, second, third] = postings

    expect(postings).toHaveLength(3)

    expect(first).toHaveAccountName('Assets:Bank:Checking')
    expect(first).toHaveAmount('100')
    expect(first).toHaveCommodity('$', { position: 'pre' })

    expect(second).toHaveAccountName('Expenses:Food')
    expect(second).toHaveAmount('50,25')
    expect(second).toHaveCommodity('€', { position: 'pre' })

    expect(third).toHaveAccountName('Liabilities:CreditCard')
    expect(third).toHaveAmount('30.1')
    expect(third).toHaveCommodity('AAPL', { position: 'post' })
  })

  it('fails to parse postings with double commodities', () => {
    let input = formatTransaction({
      postings: [{ account: 'Assets:Bank:Checking', amount: '$100 USD' }],
    })
    expect(input).failsToParse(/newline/i)
  })
})

describe('comments', () => {
  it.for(['#', ';', '%', '|', '*'])("parses comments starting with '%s'", (commentChar: string) => {
    let input = `${commentChar} This is a comment`
    let { file } = parse(input)
    let comment = getChild(file, 0, 'comment')

    expect(comment.text).toBe(input.substring(1))
    expect(comment.commentChar).toBe(commentChar)
  })

  it('parses transactions after comments', () => {
    let input = `# This is a comment\n2024-06-12 Test Payee`
    let { file } = parse(input)
    let comment = getChild(file, 0, 'comment')
    let tx = getChild(file, 1, 'transaction')

    expect(comment.comment?.innerText()).toBe('# This is a comment')
    expect(tx).toHaveDate('2024-06-12')
    expect(tx).toHavePayee('Test Payee')
  })

  it('ends transactions with un-indented comments', () => {
    let input = `2024-06-12 Test Payee\n; This is a comment\n  Accounts:Checking $100.00`
    let { file, diagnostics } = parse(input)

    expect(diagnostics).toHaveLength(1)
    expect(file.children).toHaveLength(2)

    let tx = getChild(file, 0, 'transaction')
    let comment = getChild(file, 1, 'comment')

    expect(tx).toHaveDate('2024-06-12')
    expect(tx).toHavePayee('Test Payee')
    expect(comment.comment?.innerText()).toBe('; This is a comment')
    expect(diagnostics[0].message).toMatch(/leading space/i)
  })

  it('parses comments on the same line as a transaction', () => {
    let input = `2024-06-12 Test Payee  ; This is a comment`
    let tx = parseTransaction(input)

    expect(tx).toHaveComment(/this is a comment/i)
  })

  it('does not parse comments on the same line as a transaction without a big space', () => {
    let input = `2024-06-12 Test Payee ;This is not a comment`
    let tx = parseTransaction(input)

    expect(tx).not.toHaveComment()
    expect(tx).toHavePayee('Test Payee ;This is not a comment')
  })

  it('parses comments within a transaction', () => {
    let input = `2024-06-12 Test Payee\n  ; This is a comment`
    let tx = parseTransaction(input)

    expect(tx).toHaveComment(/this is a comment/i)
  })

  it('parses comments within a posting', () => {
    let input = `2024-06-12 Test Payee\n  Assets:Checking $42\n  ; This is a comment`
    let posting = parsePosting(input)

    expect(posting).toHaveComment(/this is a comment/i)
  })

  it.todo('parses postings after comments')

  it.todo('parses tag names in comments')

  it.todo('parses tag values in comments')

  it.todo('parses typed tags in comments')

  it.todo('parses chained tags in comments')

  it('parses comment directives', () => {
    let input = `comment\n  This is a comment\nAnd this is another\nend comment`
    let { file } = parse(input)
    let comment = getChild(file, 0, 'commentDirective')

    expect(comment.startName.innerText()).toBe('comment')
    expect(comment.body).toBe('  This is a comment\nAnd this is another\n')
  })

  it('parses test directives', () => {
    let input = `test\n  This is a test comment\nend test`
    let { file } = parse(input)
    let comment = getChild(file, 0, 'commentDirective')

    expect(comment.startName.innerText()).toBe('test')
    expect(comment.body).toBe('  This is a test comment\n')
  })

  it('skips over arbitrary "end" tokens in comments', () => {
    let input = `comment\n  This is a false "end comment"\nend comment`
    let { file } = parse(input)
    let comment = getChild(file, 0, 'commentDirective')

    expect(comment.startName.innerText()).toBe('comment')
    expect(comment.body).toContain('"end comment"')
    expect(comment.end).toBeDefined()
    expect(comment.endName.innerText()).toBe('comment')
  })

  it('rejects "end test" when comment began with "comment"', () => {
    let input = `comment\n  This is a comment\nend test`
    expect(input).failsToParse(/unexpected end of file/i)
  })

  it('rejects "end comment" when comment began with "test"', () => {
    let input = `test\n  This is a comment\nend comment`
    expect(input).failsToParse(/unexpected end of file/i)
  })
})

describe('panic mode', () => {
  it('does not crash on unexpected tokens', () => {
    let input = '2024-06-12 Test Payee\n$100.00'
    let result = parse(input)

    expect(result).toHaveDiagnostic(/Unexpected token/i)
    expect(result.file.children).toHaveLength(1)
  })

  it('continues parsing after an error', () => {
    let input = '2024-06-12 Test Payee\n$100.00\n2024-06-13 Another Payee'
    let result = parse(input)

    expect(result).toHaveDiagnostic(/Unexpected token/i)
    expect(result.file.children).toHaveLength(2)

    let tx = getChild(result.file, 1, 'transaction')
    expect(tx).toHavePayee('Another Payee')
  })
})

describe('directives', () => {
  it('parses a directive without an argument', () => {
    let input = 'year'
    let { file } = parse(input)
    let directive = getChild(file, 0, 'directive')

    expect(directive.name.innerText()).toBe('year')
    expect(directive.arg).toBeUndefined()
  })

  it('parses a directive with an argument', () => {
    let input = 'account Assets:Bank:Checking'
    let { file } = parse(input)
    let directive = getChild(file, 0, 'directive')

    expect(directive.name.innerText()).toBe('account')
    expect(directive.arg?.innerText()).toBe('Assets:Bank:Checking')
  })

  it('parses directives with sub-directives', () => {
    let input = 'account Assets:Bank:Checking\n  alias Checking'
    let { file } = parse(input)
    let directive = getChild(file, 0, 'directive')

    expect(directive.subDirectives).toHaveLength(1)

    let subDirective = directive.subDirectives[0]
    expect(subDirective.key.innerText()).toBe('alias')
    expect(subDirective.value?.innerText()).toBe('Checking')
  })

  it('parses sub-directive values with spaces in them', () => {
    let input = 'account Foo\n  alias Bar Baz'
    let directive = parseDirective(input)
    let alias = getSubDirective(directive, 'alias')

    expect(alias.key.innerText()).toBe('alias')
    expect(alias.value?.innerText()).toBe('Bar Baz')
  })

  it('parses sub-directives with big spaces', () => {
    let input = 'account Foo\n  alias Bar   Baz'
    let directive = parseDirective(input)
    let alias = getSubDirective(directive, 'alias')

    expect(alias.key.innerText()).toBe('alias')
    expect(alias.value?.innerText()).toBe('Bar   Baz')
  })

  it('parses sub-directives with special characters', () => {
    let input = 'account Foo\n  alias Bar#^%!@&Baz'
    let directive = parseDirective(input)
    let alias = getSubDirective(directive, 'alias')

    expect(alias.key.innerText()).toBe('alias')
    expect(alias.value?.innerText()).toBe('Bar#^%!@&Baz')
  })

  it('parses apply directives', () => {
    let input = 'apply Foo'
    let { file } = parse(input)
    let apply = getChild(file, 0, 'apply')

    expect(apply.apply.innerText()).toBe('apply')
    expect(apply.name.innerText()).toBe('Foo')
    expect(apply.args).toBeUndefined()
  })

  it('parses apply tag directives with values', () => {
    let input = 'apply tag foo'
    let { file } = parse(input)
    let apply = getChild(file, 0, 'apply')

    expect(apply.apply.innerText()).toBe('apply')
    expect(apply.name.innerText()).toBe('tag')
    expect(apply.args?.innerText()).toBe('foo')
  })

  it('parses apply tag directives with k/v pairs', () => {
    let input = 'apply tag foo: bar'
    let { file } = parse(input)
    let apply = getChild(file, 0, 'apply')
    let [key, colon, value] = Array.from(apply.args ?? [])

    expect(key.innerText()).toBe('foo')
    expect(colon.innerText()).toBe(':')
    expect(value.innerText()).toBe('bar')
  })

  it('parses apply directives with arguments', () => {
    let input = 'apply Foo bar baz'
    let { file } = parse(input)
    let apply = getChild(file, 0, 'apply')

    expect(apply.apply.innerText()).toBe('apply')
    expect(apply.name.innerText()).toBe('Foo')
    expect(apply.args?.innerText()).toBe('bar baz')
  })

  it('parses end directives', () => {
    let input = 'end Foo'
    let { file } = parse(input)
    let end = getChild(file, 0, 'end')

    expect(end.end.innerText()).toBe('end')
    expect(end.name.innerText()).toBe('Foo')
  })

  it('parses end apply directives', () => {
    let input = 'end apply Foo'
    let { file } = parse(input)
    let endApply = getChild(file, 0, 'end')

    expect(endApply.end.innerText()).toBe('end')
    expect(endApply.apply?.innerText()).toBe('apply')
    expect(endApply.name.innerText()).toBe('Foo')
  })

  it('parses alias directives', () => {
    let input = 'alias Foo=Bar'
    let { file } = parse(input)
    let alias = getChild(file, 0, 'alias')

    expect(alias.alias.innerText()).toBe('alias')
    expect(alias.name?.innerText()).toBe('Foo')
    expect(alias.value?.innerText()).toBe('Bar')
  })

  it('parses alias directives with special characters', () => {
    let input = 'alias Foo#^%!@&=Bar#^%!@&'
    let { file } = parse(input)
    let alias = getChild(file, 0, 'alias')

    expect(alias.name?.innerText()).toBe('Foo#^%!@&')
    expect(alias.value?.innerText()).toBe('Bar#^%!@&')
  })

  it('parses alias directives with spaces in the source & target', () => {
    let input = 'alias Foo Bar=Bar Baz'
    let { file } = parse(input)
    let alias = getChild(file, 0, 'alias')

    expect(alias.name?.innerText()).toBe('Foo Bar')
    expect(alias.value?.innerText()).toBe('Bar Baz')
  })

  it('fails to parse alias with a blank left hand side', () => {
    let input = 'alias =Bar Baz'
    expect(input).failsToParse(/Unexpected token/i)
  })

  it('parses alias directives with a blank right hand side', () => {
    let input = 'alias Foo='
    expect(input).failsToParse(/Unexpected end of file/i)
  })

  it('parses blank alias directives', () => {
    let input = 'alias'
    expect(input).failsToParse(/Unexpected end of file/i)
  })

  it('parses alias directives containing = signs', () => {
    let input = 'alias Foo=Bar=Baz'
    let { file } = parse(input)
    let alias = getChild(file, 0, 'alias')

    expect(alias.name?.innerText()).toBe('Foo')
    expect(alias.eq?.innerText()).toBe('=') // The equal sign is still present
    expect(alias.value?.innerText()).toBe('Bar=Baz')
  })

  it('parses alias directives with spaces around the = sign', () => {
    let input = 'alias Foo = Bar'
    let { file } = parse(input)
    let alias = getChild(file, 0, 'alias')

    expect(alias.name?.innerText()).toBe('Foo')
    expect(alias.eq?.innerText()).toBe('=')
    expect(alias.value?.innerText()).toBe('Bar')
  })
})

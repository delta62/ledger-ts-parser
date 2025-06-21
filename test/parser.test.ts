import { describe, it, expect } from 'vitest'
import { Parser } from '../src/parser'
import { Lexer } from '../src/lexer'
import { AST, ASTChild, Transaction, Posting, Directive, SubDirective } from '../src/types'

function parse(input: string) {
  let lexer = new Lexer(input)
  let parser = new Parser(lexer)
  return parser.parse()
}

function parseTransaction(input: string): Transaction {
  let result = parse(input)
  let { ast } = result
  let tx = getChild(ast, 0, 'transaction')

  expect(result).not.toHaveDiagnostic()
  expect(ast.children).toHaveLength(1)
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
  let { ast } = result
  expect(result).not.toHaveDiagnostic()
  expect(ast.children).toHaveLength(1)

  let directive = getChild(ast, 0, 'directive')
  expect(directive).toHaveProperty('type', 'directive')

  return directive
}

function getChild<T extends ASTChild['type']>(
  ast: AST,
  index: number,
  type: T
): Extract<AST['children'][number], { type: T }> {
  let child = ast.children[index]
  expect(child).toBeDefined()
  expect(child).toHaveProperty('type', type)
  return child as Extract<AST['children'][number], { type: T }>
}

function getSubDirective(directive: Directive, key: string): SubDirective {
  let subDirective = directive.subDirectives.find(d => d.key.toString() === key)
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
    expect(input).failsToParse(/Unexpected token/i)
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
    expect(input).failsToParse(/abc/)
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
    it('parses transactions with both flags, cleared first', () => {
      let input = '2024-06-12 *! Test Payee'
      let tx = parseTransaction(input)

      expect(tx).toBePending()
      expect(tx).toBeCleared()
      expect(tx).toHavePayee('Test Payee')
    })

    it('parses transactions with both flags, pending first', () => {
      let input = '2024-06-12 !* Test Payee'
      let tx = parseTransaction(input)

      expect(tx).toBeCleared()
      expect(tx).toBePending()
      expect(tx).toHavePayee('Test Payee')
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

  it('parses postings with no amounts but traling spaces', () => {
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
    let { ast } = parse(input)
    let comment = getChild(ast, 0, 'comment')

    expect(comment.text).toBe(input.substring(1))
    expect(comment.commentChar).toBe(commentChar)
  })

  it('parses transactions after comments', () => {
    let input = `# This is a comment\n2024-06-12 Test Payee`
    let { ast } = parse(input)
    let comment = getChild(ast, 0, 'comment')
    let tx = getChild(ast, 1, 'transaction')

    expect(comment.comment.toString()).toBe('# This is a comment')
    expect(tx).toHaveDate('2024-06-12')
    expect(tx).toHavePayee('Test Payee')
  })

  it('ends transactions with un-indented comments', () => {
    let input = `2024-06-12 Test Payee\n; This is a comment\n  Accounts:Checking $100.00`
    let { ast, diagnostics } = parse(input)

    expect(diagnostics).toHaveLength(2)
    expect(ast.children).toHaveLength(2)

    let tx = getChild(ast, 0, 'transaction')
    let comment = getChild(ast, 1, 'comment')

    expect(tx).toHaveDate('2024-06-12')
    expect(tx).toHavePayee('Test Payee')
    expect(comment.comment.toString()).toBe('; This is a comment')
    expect(diagnostics[0].message).toContain('Unexpected token')
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
    let { ast } = parse(input)
    let comment = getChild(ast, 0, 'comment')

    expect(comment.commentChar).toBe('comment')
    expect(comment.text).toBe('  This is a comment\nAnd this is another\n')
  })

  it('skips over arbitrary "end" tokens in comments', () => {
    let input = `comment\n  This is a false "end comment"\nend comment`
    let { ast } = parse(input)
    let comment = getChild(ast, 0, 'comment')

    expect(comment.commentChar).toBe('comment')
    expect(comment.text).toContain('"end comment"')
  })
})

describe('panic mode', () => {
  it('recovers from unexpected tokens', () => {
    let input = '2024-06-12 Test Payee\n$100.00'
    let result = parse(input)

    expect(result).toHaveDiagnostic(/Unexpected token/i)
    expect(result.ast.children).toHaveLength(1)
  })

  it('continues parsing after an error', () => {
    let input = '2024-06-12 Test Payee\n$100.00\n2024-06-13 Another Payee'
    let result = parse(input)

    expect(result).toHaveDiagnostic(/Unexpected token/i)
    expect(result.ast.children).toHaveLength(2)

    let tx = getChild(result.ast, 1, 'transaction')
    expect(tx).toHavePayee('Another Payee')
  })
})

describe('directives', () => {
  it('parses a directive without an argument', () => {
    let input = 'year'
    let { ast } = parse(input)
    let directive = getChild(ast, 0, 'directive')

    expect(directive.name.toString()).toBe('year')
    expect(directive.arg).toBeUndefined()
  })

  it('parses a directive with an argument', () => {
    let input = 'account Assets:Bank:Checking'
    let { ast } = parse(input)
    let directive = getChild(ast, 0, 'directive')

    expect(directive.name.toString()).toBe('account')
    expect(directive.arg?.toString()).toBe('Assets:Bank:Checking')
  })

  it('parses directives with sub-directives', () => {
    let input = 'account Assets:Bank:Checking\n  alias Checking'
    let { ast } = parse(input)
    let directive = getChild(ast, 0, 'directive')

    expect(directive.subDirectives).toHaveLength(1)

    let subDirective = directive.subDirectives[0]
    expect(subDirective.key.toString()).toBe('alias')
    expect(subDirective.value?.toString()).toBe('Checking')
  })

  it('parses sub-directive values with spaces in them', () => {
    let input = 'account Foo\n  alias Bar Baz'
    let directive = parseDirective(input)
    let alias = getSubDirective(directive, 'alias')

    expect(alias.key.text).toBe('alias')
    expect(alias.value?.toString()).toBe('Bar Baz')
  })

  it('parses sub-directives with big spaces', () => {
    let input = 'account Foo\n  alias Bar   Baz'
    let directive = parseDirective(input)
    let alias = getSubDirective(directive, 'alias')

    expect(alias.key.text).toBe('alias')
    expect(alias.value?.toString()).toBe('Bar   Baz')
  })

  it('parses sub-directives with special characters', () => {
    let input = 'account Foo\n  alias Bar#^%!@&Baz'
    let directive = parseDirective(input)
    let alias = getSubDirective(directive, 'alias')

    expect(alias.key.text).toBe('alias')
    expect(alias.value?.toString()).toBe('Bar#^%!@&Baz')
  })

  it('parses apply directives', () => {
    let input = 'apply Foo'
    let { ast } = parse(input)
    let apply = getChild(ast, 0, 'apply')

    expect(apply.apply.toString()).toBe('apply')
    expect(apply.name.toString()).toBe('Foo')
    expect(apply.args).toBeUndefined()
  })

  it('parses apply directives with arguments', () => {
    let input = 'apply Foo bar baz'
    let { ast } = parse(input)
    let apply = getChild(ast, 0, 'apply')

    expect(apply.apply.toString()).toBe('apply')
    expect(apply.name.toString()).toBe('Foo')
    expect(apply.args?.toString()).toBe('bar baz')
  })

  it('parses end directives', () => {
    let input = 'end Foo'
    let { ast } = parse(input)
    let end = getChild(ast, 0, 'end')

    expect(end.end.toString()).toBe('end')
    expect(end.name.toString()).toBe('Foo')
  })
})

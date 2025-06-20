import { describe, it, expect } from 'vitest'
import { Parser } from '../src/parser'
import { Lexer } from '../src/lexer'
import { Transaction, Comment } from '../src/types'

function parse(input: string) {
  let lexer = new Lexer(input)
  let parser = new Parser(lexer)
  return parser.parse()
}

function parseTransaction(input: string): Transaction {
  let result = parse(input)
  let ast = result.ast
  let tx = ast.children[0]

  expect(result.diagnostics).toHaveLength(0)
  expect(ast.children).toHaveLength(1)
  expect(tx).toHaveProperty('type', 'transaction')

  return tx as Transaction
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
  it('parses a posting', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking', amount: '$100.00' }] })
    let tx = parseTransaction(input)

    expect(tx.postings).toHaveLength(1)
    expect(tx.postings[0]).toHaveAccountName('Assets:Bank:Checking')
  })

  it('adds accounts in postrings to the symbol table', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking', amount: '$100.00' }] })
    let result = parse(input)

    expect(result.accounts).toHaveSymbol('Assets:Bank:Checking')
  })

  it('parses multiple postings', () => {
    let input = formatTransaction({
      postings: [
        { account: 'Assets:Bank:Checking', amount: '$100.00' },
        { account: 'Expenses:Food', amount: '$50.00' },
      ],
    })
    let tx = parseTransaction(input)
    let [posting1, posting2] = tx.postings

    expect(tx.postings).toHaveLength(2)
    expect(posting1).toHaveAccountName('Assets:Bank:Checking')
    expect(posting2).toHaveAccountName('Expenses:Food')
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
    expect(input).failsToParse()
  })

  it('fails to parse dates with decimal points', () => {
    let input = formatTransaction({ date: '2024-06-12.5' })
    expect(input).failsToParse('integer')
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
    expect(input).failsToParse('Expected number')
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
    let tx = parseTransaction(input)

    expect(tx.postings).toHaveLength(1)
    expect(tx.postings[0]).toHaveAccountName('Assets:Bank:Checking')
  })

  it('parses account names with special characters', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:l33tsp#@K' }] })
    let tx = parseTransaction(input)

    expect(tx.postings[0]).toHaveAccountName('Assets:Bank:l33tsp#@K')
  })

  it('parses account names with spaces', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking Account' }] })
    let tx = parseTransaction(input)

    expect(tx.postings[0]).toHaveAccountName('Assets:Bank:Checking Account')
  })

  it('parses postings with amounts', () => {
    let input = formatTransaction({
      postings: [{ account: 'Assets:Bank:Checking', amount: '100 USD' }],
    })
    let [posting] = parseTransaction(input).postings

    expect(posting).toHaveAmount('100')
    expect(posting).toHaveCommodity('USD', { position: 'post' })
  })

  it('parses postings with negative amounts', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking', amount: '-$100.00' }] })
    let [posting] = parseTransaction(input).postings

    expect(posting).toHaveAmount('-100.00')
    expect(posting).toHaveCommodity('$', { position: 'pre' })
  })

  it('parses postings with zero amounts', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking', amount: '0 AAPL' }] })
    let [posting] = parseTransaction(input).postings

    expect(posting).toHaveAmount('0')
    expect(posting).toHaveCommodity('AAPL', { position: 'post' })
  })

  it('parses postings with no amount', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking' }] })
    let [posting] = parseTransaction(input).postings

    expect(posting).not.toHaveAmount()
    expect(posting).not.toHaveCommodity()
  })

  it('parses postings with no amounts but traling spaces', () => {
    let input = formatTransaction({ postings: [{ account: 'Assets:Bank:Checking', amount: '   ' }] })
    let [posting] = parseTransaction(input).postings

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
    expect(input).failsToParse('newline or end of file')
  })
})

describe('comments', () => {
  it('parses top-level comments', () => {
    let input = '; This is a comment'
    let { diagnostics, ast } = parse(input)

    expect(diagnostics).toHaveLength(0)
    expect(ast.children).toHaveLength(1)
    expect(ast.children[0]).toHaveProperty('type', 'comment')

    let comment = ast.children[0] as Comment
    expect(comment.comment.text).toBe('; This is a comment')
  })

  it.todo('parses transactions after comments')

  it.todo('parses top-level comments starting with alternat characters')

  it.todo('parses comments on the same line as a transaction')

  it.todo('parses comments within a transaction')

  it.todo('parses comments within a posting')

  it.todo('parses postings after comments')

  it('parses tag names in comments', () => {
    let input = '; :tag1:'
    let { diagnostics, ast } = parse(input)

    expect(diagnostics).toHaveLength(0)
    expect(ast.children).toHaveLength(1)
    expect(ast.children[0]).toHaveProperty('type', 'comment')

    let comment = ast.children[0] as Comment
    expect(comment.tags).toHaveProperty('tag1')
  })

  it('parses tag values in comments', () => {
    let input = '; tag1: value1'
    let { diagnostics, ast } = parse(input)

    expect(diagnostics).toHaveLength(0)
    expect(ast.children).toHaveLength(1)
    expect(ast.children[0]).toHaveProperty('type', 'comment')

    let comment = ast.children[0] as Comment
    expect(comment.tags).toHaveProperty('tag1', 'value1')
  })

  it.todo('parses typed tags in comments')

  it('parses chained tags in comments', () => {
    let input = '; :tag1:tag2:tag3:'
    let { diagnostics, ast } = parse(input)

    expect(diagnostics).toHaveLength(0)
    expect(ast.children).toHaveLength(1)
    expect(ast.children[0]).toHaveProperty('type', 'comment')

    let comment = ast.children[0] as Comment
    expect(comment.tags).toHaveProperty('tag1')
    expect(comment.tags).toHaveProperty('tag2')
    expect(comment.tags).toHaveProperty('tag3')
  })
})

describe('panic mode', () => {
  it('recovers from unexpected tokens', () => {
    let input = '2024-06-12 Test Payee\n$100.00'
    let { diagnostics, ast } = parse(input)

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].message).toContain('Unexpected symbol')
    expect(ast.children).toHaveLength(1)
  })

  it('continues parsing after an error', () => {
    let input = '2024-06-12 Test Payee\n$100.00\n2024-06-13 Another Payee'
    let result = parse(input)

    expect(result.diagnostics).toHaveLength(1)
    expect(result.ast.children).toHaveLength(2)

    let tx = result.ast.children[1] as Transaction
    expect(tx).toHavePayee('Another Payee')
  })
})

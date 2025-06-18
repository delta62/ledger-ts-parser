import { describe, it, expect } from 'vitest'
import { Parser } from '../src/parser'
import { Lexer } from '../src/lexer'
import { Transaction } from '../src/types'

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
  accountName: string
  amount?: string
}

interface TransactionSpec {
  date: string
  payee: string
  postings: PostingSpec[]
}

function formatTransaction(spec: Partial<TransactionSpec> = {}): string {
  let date = spec.date || '2024-06-12'
  let payee = spec.payee || 'Test Payee'
  let postings = spec.postings || [{ accountName: 'Assets:Bank:Checking', amount: '$100.00' }]

  let postingLines = postings
    .map(p => {
      let line = `  ${p.accountName}`
      if (p.amount) {
        line += `  ${p.amount}`
      }
      return line
    })
    .join('\n')

  return `${date} ${payee}\n${postingLines}`
}

describe('Ledger Parser', () => {
  it('parses payees', () => {
    let input = formatTransaction({ payee: 'Whole Foods' })
    let tx = parseTransaction(input)

    expect(tx).toHavePayee('Whole Foods')
  })

  it('adds payees to the symbol table', () => {
    let input = formatTransaction({ payee: 'Grocery Store' })
    let result = parse(input)

    expect(result.payees).toHaveSymbol('Grocery Store')
  })

  it('parses a posting', () => {
    let input = formatTransaction({ postings: [{ accountName: 'Assets:Bank:Checking', amount: '$100.00' }] })
    let tx = parseTransaction(input)

    expect(tx.postings).toHaveLength(1)
    expect(tx.postings[0]).toHaveAccountName('Assets:Bank:Checking')
  })

  it('adds accounts in postrings to the symbol table', () => {
    let input = formatTransaction({ postings: [{ accountName: 'Assets:Bank:Checking', amount: '$100.00' }] })
    let result = parse(input)

    expect(result.accounts).toHaveSymbol('Assets:Bank:Checking')
  })

  it('parses multiple postings', () => {
    let input = formatTransaction({
      postings: [
        { accountName: 'Assets:Bank:Checking', amount: '$100.00' },
        { accountName: 'Expenses:Food', amount: '$50.00' },
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

    expect(tx).toHaveDate(new Date(2024, 5, 12))
  })

  it('parses dates in YYYY-M-D format', () => {
    let input = formatTransaction({ date: '2024-6-2' })
    let tx = parseTransaction(input)

    expect(tx).toHaveDate(new Date(2024, 5, 2))
  })

  it('parses dates in YYYY/MM/DD format', () => {
    let input = formatTransaction({ date: '2024/06/12' })
    let tx = parseTransaction(input)

    expect(tx).toHaveDate(new Date(2024, 5, 12))
  })

  it('parses dates in YY/M/D format', () => {
    let input = formatTransaction({ date: '24/6/1' })
    let tx = parseTransaction(input)

    expect(tx).toHaveDate(new Date(2024, 5, 1))
  })

  it('parses dates in YYYY/MM format', () => {
    let input = formatTransaction({ date: '2024/12' })
    let tx = parseTransaction(input)

    expect(tx).toHaveDate(new Date(2024, 11, 1))
  })

  it('parses dates in MM/DD format', () => {
    let input = formatTransaction({ date: '06/12' })
    let tx = parseTransaction(input)
    let thisYear = new Date().getFullYear()

    expect(tx).toHaveDate(new Date(thisYear, 5, 12))
  })

  it('fails to parse invalid dates', () => {
    let input = formatTransaction({ date: '2024-06-31' }) // June has only 30 days
    expect(input).failsToParse('Invalid day')
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

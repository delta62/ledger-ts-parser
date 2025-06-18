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

  return `${date}${auxDate}${pending}${cleared} ${payee}\n${postingLines}`
}

describe('Ledger Parser', () => {
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

describe('auxiliary dates', () => {
  it('parses auxiliary dates', () => {
    let input = formatTransaction({ date: '2024-06-12', auxDate: '2024-06-13' })
    let tx = parseTransaction(input)

    expect(tx).toHaveAuxDate(new Date(2024, 5, 13))
  })

  it('parses auxiliary dates with equal sign', () => {
    let input = formatTransaction({ date: '2024-06-12', auxDate: '2024-06-13' })
    let tx = parseTransaction(input)

    expect(tx).toHaveAuxDate(new Date(2024, 5, 13))
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

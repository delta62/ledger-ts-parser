import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser'

describe('Ledger Parser', () => {
  let content = `
; Test ledger file

include common.ledger

2025-06-01 * Grocery Store @WholeFoods :groceries:
    Expenses:Food     $50.23
    Assets:Bank:Checking

`
  let result = parse(content)
  let tx = result.transactions[0]

  it('parses comments', () => {
    expect(result.comments.length).toBe(1)
    expect(result.comments[0]).toBe('; Test ledger file')
  })

  it('parses directives', () => {
    expect(result.directives.length).toBe(1)
    expect(result.directives[0].type).toBe('include')
    expect(result.directives[0].args).toBe('common.ledger')
  })

  it('parses transactions', () => {
    expect(result.transactions.length).toBe(1)
    expect(tx.date).toBe('2025-06-01')
    expect(tx.cleared).toBe('cleared')
    expect(tx.payee).toBe('Grocery Store')
  })

  it('parses tags', () => {
    expect(tx.tags).toContain('@WholeFoods')
    expect(tx.tags).toContain(':groceries:')
  })

  it('parses postings', () => {
    expect(tx.postings.length).toBe(2)
    expect(tx.postings[0].account).toBe('Expenses:Food')
    expect(tx.postings[0].amount).toBe('$50.23')
    expect(tx.postings[1].account).toBe('Assets:Bank:Checking')
  })
})

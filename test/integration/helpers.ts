import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { Parser } from '../../src'
import Lexer from '../../src/lexer'
import { Group } from '../../src/group'

const TMP_DIR = 'ledger-test'

interface Posting {
  payee: string
  amount: string
}

async function createTempFile(fileName: string, content: string): Promise<string> {
  let filePath = path.join(tmpdir(), TMP_DIR, `${fileName}.ledger`)
  let folder = path.dirname(filePath)

  await fs.mkdir(folder, { recursive: true })

  let stat = await fs.stat(filePath).catch(() => null)
  if (stat) {
    await fs.unlink(filePath)
  }
  await fs.writeFile(filePath, content)

  return filePath
}

function exec(command: string, args: string[]): Promise<string> {
  let child = spawn(command, args)
  let stdout = ''
  let stderr = ''

  return new Promise((resolve, reject) => {
    child.stdout.on('data', data => {
      stdout += data.toString()
    })

    child.stderr.on('data', data => {
      stderr += data.toString()
    })

    child.on('error', err => {
      reject(`Failed to start process: ${err.message}`)
    })

    child.on('close', code => {
      if (code !== 0) {
        reject(stderr)
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

function formatPosting(posting: Posting): string {
  return `2025-01-01 Test Payee
  ${posting.payee}  ${posting.amount}
  Assets:Cash
`
}

function randomFileName(): string {
  return `test-${Math.random().toString(36).substring(2, 15)}.ledger`
}

export interface Entry {
  date: string
  payee: string
  account: string
  commodity: string
  amount: number
}

export interface Comparison {
  ledger: Entry[]
  lsp: Entry[]
}

export async function runLedger(posting: Posting): Promise<Comparison> {
  let fileName = randomFileName()
  let tx = formatPosting(posting)
  let ledger = await createTempFile(fileName, tx)

  let command = `/usr/bin/ledger`
  let args = ['csv', '-f', ledger]
  let output = await exec(command, args)

  let ledgerOutput = output
    .split('\n')
    .map(row => row.split(',').map(col => col.trim().substring(1, col.length - 1)))
    .map(([date, , payee, account, commodity, amount]) => ({
      date,
      payee,
      account,
      commodity,
      amount: parseFloat(amount.replace(/,/, '.')),
    }))

  let lexer = new Lexer(tx)
  let lspOutput: Entry[] = new Parser(lexer)
    .parse()
    .ast.children.filter(child => child.type === 'transaction')
    .map(child => ({
      date: child.date.raw.toString(),
      payee: tokensToString(child.payee?.name),
      account: tokensToString(child.postings[0].account.name),
      commodity: tokensToString(child.postings[0].amount?.commodity),
      amount: parseFloat(child.postings[0].amount?.amount.toString() ?? '0'),
    }))

  return {
    ledger: ledgerOutput,
    lsp: lspOutput,
  }
}

function tokensToString(group: Group | undefined): string {
  return group?.toString() ?? ''
}

import { LedgerFile, Transaction, Posting, Directive } from './types'

export function parse(content: string): LedgerFile {
  let lines = content.split(/\r?\n/)
  let transactions: Transaction[] = []
  let directives: Directive[] = []
  let comments: string[] = []

  let currentTx: Transaction | null = null

  for (let line of lines) {
    if (/^\s*$/.test(line)) {
      currentTx = null
      continue
    }

    if (/^[;#]/.test(line)) {
      if (currentTx) {
        currentTx.comments.push(line)
        currentTx.raw.push(line)
      } else {
        comments.push(line)
      }
      continue
    }

    let directiveMatch = line.match(
      /^ *(include|account|alias|bucket|payee|tag)\b(.*)$/
    )
    if (directiveMatch) {
      directives.push({
        type: directiveMatch[1],
        args: directiveMatch[2].trim(),
        raw: line,
      })
      continue
    }

    let txHeaderMatch = line.match(
      /^(\d{4}[-/]\d{2}[-/]\d{2})\s+([*!])?\s*(.*)$/
    )
    if (txHeaderMatch) {
      currentTx = {
        date: txHeaderMatch[1],
        cleared:
          txHeaderMatch[2] === '*'
            ? 'cleared'
            : txHeaderMatch[2] === '!'
            ? 'pending'
            : undefined,
        payee: undefined,
        tags: [],
        postings: [],
        comments: [],
        raw: [line],
      }

      let rest = txHeaderMatch[3]
      let tagMatches = rest.match(/([@:][^ \t]+)/g)
      if (tagMatches) {
        currentTx.tags = tagMatches.map(tag => tag.trim())
      }

      let payee = rest.replace(/([@:][^ \t]+)/g, '').trim()
      if (payee.length > 0) {
        currentTx.payee = payee
      }

      transactions.push(currentTx)
      continue
    }

    if (/^ {2}/.test(line)) {
      if (!currentTx) {
        console.warn(`Posting outside transaction: "${line}"`)
        continue
      }

      let postingMatch = line.match(
        /^\s{2,}([^ \t]+(?:[^\t]*?))\s{2,}([^\t;]+)?(?:\s*[;#](.*))?$/
      )
      let posting: Posting = {
        account: '',
        raw: line,
      }

      if (postingMatch) {
        posting.account = postingMatch[1].trim()
        if (postingMatch[2]) {
          posting.amount = postingMatch[2].trim()
        }
        if (postingMatch[3]) {
          posting.comment = postingMatch[3].trim()
        }
      } else {
        posting.account = line.trim()
      }

      currentTx.postings.push(posting)
      currentTx.raw.push(line)
      continue
    }

    console.warn(`Unknown line type: "${line}"`)
  }

  return {
    transactions,
    directives,
    comments,
  }
}

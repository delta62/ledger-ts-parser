export interface LedgerFile {
  transactions: Transaction[]
  directives: Directive[]
  comments: string[]
}

export interface Transaction {
  date: string
  cleared?: 'cleared' | 'pending'
  payee?: string
  tags: string[]
  postings: Posting[]
  comments: string[]
  raw: string[]
}

export interface Posting {
  account: string
  amount?: string
  comment?: string
  raw: string
}

export interface Directive {
  type: string
  args: string
  raw: string
}

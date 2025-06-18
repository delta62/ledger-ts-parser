import { Location } from './types'

export type ErrorCode = 'UNEXPECTED_TOKEN' | 'UNEXPECTED_EOF' | 'INVALID_DATE' | 'INVALID_ACCOUNT' | 'INVALID_INTEGER'

export class ParseError extends Error {
  constructor(message: string, public code: ErrorCode, public location?: Location) {
    super(message)
    this.name = 'ParseError'
  }
}

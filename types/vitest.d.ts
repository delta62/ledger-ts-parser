import 'vitest'
import { Location } from './src'

interface TokenMatchers<R = unknown> {
  toHaveTokenType: (type: string) => R
  toHaveSymbol: (key: string, location?: Location) => R
  toHaveAccountName: (expectedName: string) => R
  toHavePayee: (name: string) => R
  toHaveDate: (date: Date) => R
  failsToParse: (messageIncludes?: string) => R
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any
  interface Matchers<T = any> extends TokenMatchers<T> {}
}

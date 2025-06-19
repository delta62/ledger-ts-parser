import 'vitest'
import { Location } from './src'

interface TokenMatchers<R = unknown> {
  toHaveTokenType: (type: string) => R
  toHaveSymbol: (key: string, location?: Location) => R
  toHaveAccountName: (expectedName: string) => R
  toHavePayee: (name?: string) => R
  toBeCleared: () => R
  toBePending: () => R
  toHaveDate: (date: string) => R
  toHaveAuxDate: (date: string) => R
  failsToParse: (messageIncludes?: string) => R
  toHaveAmount: (amount?: string) => R
  toHaveCommodity: (commodity?: string, opts?: { position: 'pre' | 'post' }) => R
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any
  interface Matchers<T = any> extends TokenMatchers<T> {}
}

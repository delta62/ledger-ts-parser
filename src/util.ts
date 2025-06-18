export function id<T>(x: T): T {
  return x
}

export function unimplemented(message?: string): never {
  let msg = message ?? 'Not implemented yet'
  throw new Error(msg)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ok(...args: unknown[]): true {
  return true
}

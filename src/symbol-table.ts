import type { Span } from './location'

export class SymbolTable {
  private table = new Map<string, Span>()

  public add(key: string, span: Span) {
    if (this.table.has(key)) {
      throw new Error(`Re-definition of symbol ${key} at ${span[0]}`)
    }

    this.table.set(key, span)
  }

  public get(key: string): Span | undefined {
    return this.table.get(key)
  }

  public has(key: string): boolean {
    return this.table.has(key)
  }
}

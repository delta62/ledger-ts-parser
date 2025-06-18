import { Location } from './types'

export class SymbolTable {
  private table = new Map<string, Location>()

  public add(key: string, location: Location) {
    if (this.table.has(key)) {
      throw new Error(`Re-definition of symbol ${key} at ${location}`)
    }

    this.table.set(key, location)
  }

  public get(key: string): Location | undefined {
    return this.table.get(key)
  }

  public has(key: string): boolean {
    return this.table.has(key)
  }
}

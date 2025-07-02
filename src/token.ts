import type { Span } from './location'

export interface TokenLike<T> {
  type: T
  offset: number
  text: string
}

export class Token<T extends string> {
  private leadingSpace: string
  private text: string
  public readonly trailingSpace: string
  private offset: number
  public readonly type: T

  public static virtual<T extends string>(type: T, offset: number, leadingSpace = ''): Token<T> {
    let fakeToken = {
      type,
      text: '',
      value: '',
      lineBreaks: 0,
      line: 1,
      col: 1,
      offset,
    }

    let t = new Token<T>(fakeToken)
    t.leadingSpace = leadingSpace
    return t
  }

  public get span(): Span {
    let startOffset = this.offset + this.leadingSpace.length
    let endOffset = startOffset + this.innerLength()
    return [startOffset, endOffset]
  }

  constructor(from: TokenLike<T>, leadingSpace = '', trailingSpace = '') {
    this.type = from.type
    this.offset = from.offset
    this.text = from.text
    this.leadingSpace = leadingSpace
    this.trailingSpace = trailingSpace
  }

  public innerText(): string {
    return this.text
  }

  public outerText(): string {
    return this.leadingSpace + this.text + this.trailingSpace
  }

  public innerLength(): number {
    return this.text.length
  }

  public outerLength(): number {
    return this.text.length + this.leadingSpace.length + this.trailingSpace.length
  }

  public beginsWithSpace(): boolean {
    return this.leadingSpace.length > 0
  }

  public endsWithSpace(): boolean {
    return this.trailingSpace.length > 0
  }

  public beginsWithHardSpace(): boolean {
    return isHardSpace(this.leadingSpace)
  }

  public endsWithHardSpace(): boolean {
    return isHardSpace(this.trailingSpace)
  }
}

function isHardSpace(s: string): boolean {
  return /\t| {2,}/.test(s)
}

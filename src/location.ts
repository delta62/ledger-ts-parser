export interface Location {
  line: number
  column: number
  offset: number
}

export type Span = [number, number]

export function combineSpans(...spans: (Span | undefined)[]): Span {
  let min = Infinity
  let max = -Infinity

  spans
    .filter(span => !!span)
    .forEach(([lo, hi]) => {
      if (lo < min) min = lo
      if (hi > max) max = hi
    })

  return [min, max]
}

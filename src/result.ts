/* eslint-disable @typescript-eslint/no-explicit-any */

export class Result<T, E> {
  private value: T | null = null
  private error: E | null = null

  static ok<U>(value: U): Result<U, never> {
    let result = new Result<U, never>()
    result.value = value
    return result
  }

  static err<U>(error: U): Result<never, U> {
    let result = new Result<never, U>()
    result.error = error
    return result
  }

  static unit<T, E>(val: Result<T, E> | T): Result<T, E> {
    if (val instanceof Result) {
      return val
    }
    return Result.ok(val)
  }

  isOk(): this is Result<T, never> {
    return this.error === null
  }

  isErr(): this is Result<never, E> {
    return this.value === null
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isOk()) {
      return Result.ok(fn(this.value as T))
    }
    return Result.err(this.error as E)
  }

  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isOk()) {
      return fn(this.value as T)
    }
    return Result.err(this.error as E)
  }

  unwrap(): T {
    if (this.isErr()) {
      throw new Error('Cannot unwrap an error result')
    }
    return this.value as T
  }

  unwrapErr(): E {
    if (this.isOk()) {
      throw new Error('Cannot unwrap a successful result')
    }
    return this.error as E
  }

  seq<R1>(f1: ResultFn<T, R1, E>): Result<R1, E>
  seq<R1, R2>(f1: ResultFn<T, R1, E>, f2: ResultFn<R1, R2, E>): Result<R2, E>
  seq<R1, R2, R3>(f1: ResultFn<T, R1, E>, f2: ResultFn<R1, R2, E>, f3: ResultFn<R2, R3, E>): Result<R3, E>
  // prettier-ignore
  seq<R1, R2, R3, R4>( f1: ResultFn<T, R1, E>, f2: ResultFn<R1, R2, E>, f3: ResultFn<R2, R3, E>, f4: ResultFn<R3, R4, E> ): Result<R4, E>
  // prettier-ignore
  seq<R1, R2, R3, R4, R5>( f1: ResultFn<T, R1, E>, f2: ResultFn<R1, R2, E>, f3: ResultFn<R2, R3, E>, f4: ResultFn<R3, R4, E>, f5: ResultFn<R4, R5, E> ): Result<R5, E>
  // prettier-ignore
  seq<R1, R2, R3, R4, R5, R6>( f1: ResultFn<T, R1, E>, f2: ResultFn<R1, R2, E>, f3: ResultFn<R2, R3, E>, f4: ResultFn<R3, R4, E>, f5: ResultFn<R4, R5, E>, f6: ResultFn<R5, R6, E> ): Result<R6, E>
  // prettier-ignore
  seq<R1, R2, R3, R4, R5, R6, R7>( f1: ResultFn<T, R1, E>, f2: ResultFn<R1, R2, E>, f3: ResultFn<R2, R3, E>, f4: ResultFn<R3, R4, E>, f5: ResultFn<R4, R5, E>, f6: ResultFn<R5, R6, E>, f7: ResultFn<R6, R7, E> ): Result<R7, E>
  // prettier-ignore
  seq<R1, R2, R3, R4, R5, R6, R7, R8>( f1: ResultFn<T, R1, E>, f2: ResultFn<R1, R2, E>, f3: ResultFn<R2, R3, E>, f4: ResultFn<R3, R4, E>, f5: ResultFn<R4, R5, E>, f6: ResultFn<R5, R6, E>, f7: ResultFn<R6, R7, E>, f8: ResultFn<R7, R8, E> ): Result<R8, E>
  // prettier-ignore
  seq<R1, R2, R3, R4, R5, R6, R7, R8, R9>( f1: ResultFn<T, R1, E>, f2: ResultFn<R1, R2, E>, f3: ResultFn<R2, R3, E>, f4: ResultFn<R3, R4, E>, f5: ResultFn<R4, R5, E>, f6: ResultFn<R5, R6, E>, f7: ResultFn<R6, R7, E>, f8: ResultFn<R7, R8, E>, f9: ResultFn<R8, R9, E> ): Result<R9, E>
  // prettier-ignore
  seq<R1, R2, R3, R4, R5, R6, R7, R8, R9, R10>( f1: ResultFn<T, R1, E>, f2: ResultFn<R1, R2, E>, f3: ResultFn<R2, R3, E>, f4: ResultFn<R3, R4, E>, f5: ResultFn<R4, R5, E>, f6: ResultFn<R5, R6, E>, f7: ResultFn<R6, R7, E>, f8: ResultFn<R7, R8, E>, f9: ResultFn<R8, R9, E>, f10: ResultFn<R9, T, E> ): Result<R10, E>
  seq(...fns: ResultFn<any, any, any>[]): Result<any, any> {
    return fns.reduce((acc, fn) => {
      return acc.andThen(value => Result.unit(fn(value)))
    }, this as Result<T, E>)
  }

  static all(): Result<never[], never>
  static all<R1, E>(r1: () => Result<R1, E>): Result<[R1], E>
  static all<R1, R2, E>(r1: () => Result<R1, E>, r2: (r1: R1) => Result<R2, E>): Result<[R1, R2], E>
  // prettier-ignore
  static all<R1, R2, R3, E>( r1: () => Result<R1, E>, r2: (r1: R1) => Result<R2, E>, r3: (r1: R1, r2: R2) => Result<R3, E> ): Result<[R1, R2, R3], E>
  // prettier-ignore
  static all<R1, R2, R3, R4, E>( r1: () => Result<R1, E>, r2: (r1: R1) => Result<R2, E>, r3: (r1: R1, r2: R2) => Result<R3, E>, r4: (r1: R1, r2: R2, r3: R3) => Result<R4, E> ): Result<[R1, R2, R3, R4], E>
  // prettier-ignore
  static all<R1, R2, R3, R4, R5, E>( r1: () => Result<R1, E>, r2: (r1: R1) => Result<R2, E>, r3: (r1: R1, r2: R2) => Result<R3, E>, r4: (r1: R1, r2: R2, r3: R3) => Result<R4, E>, r5: (r1: R1, r2: R2, r3: R3, r4: R4) => Result<R5, E> ): Result<[R1, R2, R3, R4, R5], E>
  // prettier-ignore
  static all<R1, R2, R3, R4, R5, R6, E>( r1: () => Result<R1, E>, r2: (r1: R1) => Result<R2, E>, r3: (r1: R1, r2: R2) => Result<R3, E>, r4: (r1: R1, r2: R2, r3: R3) => Result<R4, E>, r5: (r1: R1, r2: R2, r3: R3, r4: R4) => Result<R5, E>, r6: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5) => Result<R6, E> ): Result<[R1, R2, R3, R4, R5, R6], E>
  // prettier-ignore
  static all<R1, R2, R3, R4, R5, R6, R7, E>( r1: () => Result<R1, E>, r2: (r1: R1) => Result<R2, E>, r3: (r1: R1, r2: R2) => Result<R3, E>, r4: (r1: R1, r2: R2, r3: R3) => Result<R4, E>, r5: (r1: R1, r2: R2, r3: R3, r4: R4) => Result<R5, E>, r6: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5) => Result<R6, E>, r7: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, r6: R6) => Result<R7, E> ): Result<[R1, R2, R3, R4, R5, R6, R7], E>
  // prettier-ignore
  static all<R1, R2, R3, R4, R5, R6, R7, R8, E>( r1: () => Result<R1, E>, r2: (r1: R1) => Result<R2, E>, r3: (r1: R1, r2: R2) => Result<R3, E>, r4: (r1: R1, r2: R2, r3: R3) => Result<R4, E>, r5: (r1: R1, r2: R2, r3: R3, r4: R4) => Result<R5, E>, r6: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5) => Result<R6, E>, r7: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, r6: R6) => Result<R7, E>, r8: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, r6: R6, r7: R7) => Result<R8, E> ): Result<[R1, R2, R3, R4, R5, R6, R7, R8], E>
  // prettier-ignore
  static all<R1, R2, R3, R4, R5, R6, R7, R8, R9, E>( r1: () => Result<R1, E>, r2: (r1: R1) => Result<R2, E>, r3: (r1: R1, r2: R2) => Result<R3, E>, r4: (r1: R1, r2: R2, r3: R3) => Result<R4, E>, r5: (r1: R1, r2: R2, r3: R3, r4: R4) => Result<R5, E>, r6: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5) => Result<R6, E>, r7: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, r6: R6) => Result<R7, E>, r8: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, r6: R6, r7: R7) => Result<R8, E>, r9: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, r6: R6, r7: R7, r8: R8) => Result<R9, E> ): Result<[R1, R2, R3, R4, R5, R6, R7, R8, R9], E>
  // prettier-ignore
  static all<R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, E>( r1: () => Result<R1, E>, r2: (r1: R1) => Result<R2, E>, r3: (r1: R1, r2: R2) => Result<R3, E>, r4: (r1: R1, r2: R2, r3: R3) => Result<R4, E>, r5: (r1: R1, r2: R2, r3: R3, r4: R4) => Result<R5, E>, r6: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5) => Result<R6, E>, r7: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, r6: R6) => Result<R7, E>, r8: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, r6: R6, r7: R7) => Result<R8, E>, r9: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, r6: R6, r7: R7, r8: R8) => Result<R9, E>, r10: (r1: R1, r2: R2, r3: R3, r4: R4, r5: R5, r6: R6, r7: R7, r8: R8, r9: R9) => Result<R10, E> ): Result<[R1, R2, R3, R4, R5, R6, R7, R8, R9, R10], E>
  static all(...fns: ResultAllFn<any, any, any>[]): Result<any[], any> {
    let values: any[] = []

    for (let fn of fns) {
      let result = Result.unit(fn(...values))
      if (result.isOk()) {
        values.push(result.unwrap())
      } else {
        return result
      }
    }

    return Result.ok(values)
  }
}

type ResultFn<T, R, E> = (value: Result<T, E> | T) => Result<R, E> | R
type ResultAllFn<T, E, A extends []> = (...args: A) => Result<T, E> | T

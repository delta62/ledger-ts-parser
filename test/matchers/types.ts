import type { expect } from 'vitest'

export type Matcher = Parameters<(typeof expect)['extend']>[0][string]

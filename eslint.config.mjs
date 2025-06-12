// @ts-check

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import preferLet from './eslint-rules/prefer-let.mjs'

export default [
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      'prefer-let/prefer-let': 'warn',
      'prefer-const': 'off',
    },
    plugins: {
      'prefer-let': {
        rules: { 'prefer-let': preferLet },
      },
    },
  },
]

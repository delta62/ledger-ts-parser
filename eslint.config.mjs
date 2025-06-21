// @ts-check

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import preferLet from './eslint-rules/prefer-let.mjs'
import safetyComment from './eslint-rules/safety-comment.mjs'

export default [
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      'prefer-let/prefer-let': 'warn',
      'prefer-const': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'safety-comment/safety-comment': 'error',
    },
    plugins: {
      'prefer-let': {
        rules: { 'prefer-let': preferLet },
      },
      'safety-comment': {
        rules: { 'safety-comment': safetyComment },
      },
    },
  },
]

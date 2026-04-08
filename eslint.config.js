// @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'eslint.config.js',
      'prettier.config.js',
    ],
  },
  ...tanstackConfig,
]

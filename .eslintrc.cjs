/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'vite.config.ts', 'coverage'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // テストは Vitest のグローバル(describe/it/expect/vi)を使用。
      // TypeScript が型チェックするため no-undef は無効化する。
      files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**'],
      rules: { 'no-undef': 'off' },
    },
  ],
}

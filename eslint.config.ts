import antfu from '@antfu/eslint-config'

export default antfu({
  unocss: true,
  formatters: true,
  pnpm: true,
  // 禁用被忽略文件的警告
}, {
  ignores: ['node_modules', '**/node_modules/**', 'dist', '**/dist/**', 'public', '**/public/**'],
  rules: {
    'ts/no-explicit-any': 'off',
    'no-console': 'off',
    'brace-style': ['error', '1tbs'],
    'style/brace-style': ['error', '1tbs'],
  },
})

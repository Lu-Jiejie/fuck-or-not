import antfu from '@antfu/eslint-config'

export default antfu(
  {
    unocss: false,
    formatters: true,
    pnpm: true,
  },
).removeRules(
  'no-irregular-whitespace',
  'vue/no-irregular-whitespace',
  'no-console',
  'no-alert',
)

import antfu from '@antfu/eslint-config'

export default antfu(
  {
    unocss: false,
    formatters: true,
  },
).removeRules(
  'no-irregular-whitespace',
  'no-console',
  'no-alert',
)

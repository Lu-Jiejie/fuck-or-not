import transformerDirectives from '@unocss/transformer-directives'
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetWebFonts,
  presetWind4,
} from 'unocss'

export default defineConfig({
  shortcuts: [
    {
      'bg-base': 'bg-white dark:bg-black',
      'border-base': 'border-gray-300 dark:border-gray-800',
      'border-focus-base': 'focus:border-teal-600 focus:dark:border-teal-700',
      'border-hover-base': 'hover:border-teal-600 dark:hover:border-teal-700 transition duration-200',
      'label': 'text-sm block font-semibold text-left mb-2 text-gray-700 dark:text-gray-300',
      'icon-btn': 'text-[0.9em] inline-block cursor-pointer select-none opacity-75 transition duration-200 hover:opacity-100 hover:text-teal-600',
      'btn': 'px-4 py-1 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50',
    },
  ],
  theme: {
    colors: {
      black: '#121212',
    },
  },
  presets: [
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
    }),
    presetWind4(),
  ],
  transformers: [
    transformerDirectives(),
  ],
})

/// <reference types="vitest" />

import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '~/': `${path.resolve(__dirname, 'src')}/`,
    },
  },
  plugins: [
    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    UnoCSS(),

    Vue({
      script: {
        propsDestructure: true,
      },
    }),
    // https://github.com/posva/unplugin-vue-router
    VueRouter(),

  ],

  // https://github.com/vitest-dev/vitest
  test: {
    environment: 'jsdom',
  },
})

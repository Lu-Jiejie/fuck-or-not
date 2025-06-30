<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { toggleDark } from '~/logic'

const router = useRouter()
const route = useRoute()
</script>

<template>
  <nav text-xl mt-6 inline-flex gap-2>
    <button icon-btn title="Theme" @click="toggleDark()">
      <div i-carbon-sun dark:i-carbon-moon />
    </button>

    <a v-if="route.path !== '/settings'" title="Settings" icon-btn href="/settings" target="_blank">
      <div i-carbon-settings />
    </a>
    <button v-else icon-btn title="Home" @click="router.push('/')">
      <div i-carbon-home />
    </button>

    <a
      i-carbon-logo-github icon-btn
      rel="noreferrer"
      href="https://github.com/Lu-Jiejie/fuck-or-not"
      target="_blank"
      title="GitHub"
    />
  </nav>
</template>

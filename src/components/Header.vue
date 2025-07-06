<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { toggleDark } from '~/logic'

const router = useRouter()
const route = useRoute()
</script>

<template>
  <header w-full flex items-center justify-end p-8>
    <nav text-xl inline-flex gap-4>
      <button
        v-if="route.path !== '/favorites'"
        icon-btn title="Favorites"
        @click="router.push('/favorites')"
      >
        <div i-carbon-bookmark />
      </button>
      <button
        v-else
        icon-btn title="Home"
        @click="router.push('/')"
      >
        <div i-carbon-home />
      </button>

      <button
        v-if="route.path !== '/settings'"
        icon-btn title="Settings"
        @click="router.push('/settings')"
      >
        <div i-carbon-settings />
      </button>
      <button
        v-else
        icon-btn title="Home"
        @click="router.push('/')"
      >
        <div i-carbon-home />
      </button>

      <a
        i-carbon-logo-github icon-btn
        rel="noreferrer"
        href="https://github.com/Lu-Jiejie/fuck-or-not"
        target="_blank"
        title="GitHub"
      />

      <button icon-btn title="Theme" @click="toggleDark()">
        <div i-carbon-sun dark:i-carbon-moon />
      </button>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { useChangelog } from '~/composables/useChangelog'
import { toggleDark } from '~/logic'

const { hasUnseen, openChangelog } = useChangelog()
</script>

<template>
  <header w-full flex items-center justify-end p-8>
    <nav text-xl inline-flex gap-4>
      <router-link
        to="/"
        icon-btn title="Home"
      >
        <div i-carbon-home />
      </router-link>

      <router-link
        to="/favorites"
        icon-btn title="Favorites"
      >
        <div i-carbon-bookmark />
      </router-link>

      <router-link
        to="/settings"
        icon-btn title="Settings"
      >
        <div i-carbon-settings />
      </router-link>

      <button
        icon-btn relative
        :title="hasUnseen ? '有新版本，查看更新历史' : '更新历史'"
        @click="openChangelog"
      >
        <div i-carbon-recently-viewed />
        <span
          v-if="hasUnseen"
          absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-teal-500
        />
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

<script setup lang="ts">
import { toggleDark } from '~/logic'
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

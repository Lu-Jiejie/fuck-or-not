<script setup lang="ts">
import { RouterView } from 'vue-router'
import TheFooter from './components/Footer.vue'
</script>

<template>
  <main
    font-sans p="x-4 y-10" m-auto max-w-180
    text="center gray-700 dark:gray-200" select-none
  >
    <RouterView />
    <TheFooter />
  </main>
</template>

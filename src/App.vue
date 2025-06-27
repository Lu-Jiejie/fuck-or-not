<script setup lang="ts">
import { RouterView } from 'vue-router'
import TheFooter from './components/TheFooter.vue'
</script>

<template>
  <main font-sans p="x-4 y-10" text="center gray-700 dark:gray-200">
    <RouterView />
    <TheFooter />
  </main>
</template>

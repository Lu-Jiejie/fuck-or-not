<script setup lang="ts">
import type { FavoriteResult } from '~/types'

const props = defineProps<{
  item: FavoriteResult
}>()

function formatTime(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <div
    p="4" mb-4
    border="~ base hover-base rounded-md"
    bg="light/80 dark:dark/80"
    flex flex-col gap-3 items-stretch
  >
    <div flex="~ row" items-center justify-between mb-1>
      <div text="sm gray-500 dark:gray-400">
        <span font-bold>{{ props.item.model }}</span>
        <span mx-2>·</span>
        <span capitalize>{{ props.item.mode }}</span>
        <span mx-2>·</span>
        <span text-xs>{{ formatTime(props.item.time) }}</span>
      </div>

      <div flex gap-2>
        <!-- placeholder -->
      </div>
    </div>

    <div
      border="~ base rounded"
      bg="light dark:dark"
      w-full min-h-40
      flex items-center justify-center
    >
      <img
        :src="`data:image/png;base64,${props.item.image}`"
        rounded max-h-100 max-w-full object-contain
        bg-transparent block
      >
    </div>

    <div
      p="x-4 y-3"
      border="~ base rounded"
      whitespace-pre-wrap
      text-left font-mono text-base
      bg="light dark:dark"
      select-text w-full
    >
      {{ props.item.result }}
    </div>
  </div>
</template>

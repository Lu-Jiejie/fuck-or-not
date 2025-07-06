<script setup lang="ts">
import type { FavoriteResult } from '~/types'

const props = defineProps<{
  item: FavoriteResult
}>()
const emit = defineEmits(['delete'])

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
    <div flex="~ row" items-center justify-between>
      <div text="sm gray-500 dark:gray-400">
        <span font-bold>{{ props.item.model }}</span>
        <span mx-2>·</span>
        <span capitalize>{{ props.item.mode }}</span>
        <span mx-2>·</span>
        <span text-xs>{{ formatTime(props.item.time) }}</span>
      </div>

      <div flex gap-2>
        <button
          type="button" title="Delete this item"
          p-1 rounded text-white
          bg="red-600 hover:red-700"
          transition-colors duration-200
          @click="emit('delete')"
        >
          <div i-carbon-trash-can />
        </button>
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
        :alt="`Favorite item image at ${formatTime(props.item.time)}`"
        class="preview"
        rounded max-h-100 max-w-full object-contain
        bg-transparent block
      >
    </div>

    <div
      p="x-4 y-3"
      border="~ base rounded"
      whitespace-pre-wrap
      text-left text-base
      bg="light dark:dark"
      select-text w-full
    >
      {{ props.item.result }}
    </div>
  </div>
</template>

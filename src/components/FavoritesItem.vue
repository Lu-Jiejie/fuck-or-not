<script setup lang="ts">
import type { FavoriteResult } from '~/types'
import { computed, ref } from 'vue'
import MarkdownRenderer from '~/components/MarkdownRenderer.vue'
import { getImageByHash } from '~/logic'

const props = defineProps<{
  item: FavoriteResult
  // hide result by adding expand button on mobile
  isMobile: boolean
}>()

const emit = defineEmits(['delete'])

const expanded = ref(false)
const shouldExpand = computed(() => {
  return expanded.value || !props.isMobile
})

const modeMap = {
  concise: '简洁模式',
  detailed: '详细模式',
  novel: '小说模式',
  custom: '自定义模式',
}

const imageData = computed(() => getImageByHash(props.item.imageHash))
const imageSrc = computed(() => {
  const { base64, mimeType } = imageData.value
  if (!base64)
    return ''
  return `data:${mimeType};base64,${base64}`
})

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
      <div text="sm" opacity-80>
        <span font-bold>{{ props.item.model }}</span>
        <span mx-2>·</span>
        <span capitalize>{{ modeMap[props.item.mode] }}</span>
        <span mx-2>·</span>
        <span text-xs>{{ formatTime(props.item.time) }}</span>
      </div>

      <div flex gap-2>
        <button
          type="button" title="Delete this item"
          p-1 rounded text-white
          bg="red-400 hover:red-500"
          transition-colors duration-200 cursor-pointer
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
        :src="imageSrc"
        :alt="`Favorite item image at ${formatTime(props.item.time)}`"
        class="preview"
        rounded max-h-100 max-w-full object-contain
        bg-transparent block
      >
    </div>

    <div
      border="~ base rounded"
      bg="light dark:dark"
      text="left base"
      select-text w-full
      :class="[
        shouldExpand
          ? 'px-4 py-3'
          : 'bg-light-700 dark:bg-dark-700!',
      ]"
    >
      <div
        v-if="!shouldExpand"
        i-carbon-overflow-menu-horizontal
        m-auto w-full cursor-pointer py-4 opacity-60
        @click="expanded = !expanded"
      />
      <Transition name="fade">
        <MarkdownRenderer v-if="shouldExpand" :content="props.item.result" />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}
</style>

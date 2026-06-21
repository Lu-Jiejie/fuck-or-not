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

const contentExpanded = ref(false)
const showContent = computed(() => {
  return contentExpanded.value || !props.isMobile
})

function toggleContent(expand: boolean) {
  const currentScrollY = window.scrollY
  contentExpanded.value = expand
  requestAnimationFrame(() => {
    window.scrollTo(0, currentScrollY)
  })
}

const modeMap: Record<string, string> = {
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
      text="left base"
      select-text w-full
      overflow-hidden
    >
      <div
        v-if="props.isMobile && !showContent"
        flex items-center justify-center
        cursor-pointer py-2
        bg="light-700 dark:dark-700"
        transition-colors duration-200
        hover:opacity-80
        select-none
        @click="toggleContent(true)"
      >
        <div i-carbon-chevron-down w-5 h-5 opacity-60 />
      </div>

      <div
        v-else
        bg="light dark:dark"
      >
        <div
          v-if="props.isMobile"
          flex items-center justify-center
          cursor-pointer py-2
          border="b base"
          transition-colors duration-200
          hover:opacity-60
          select-none
          @click="toggleContent(false)"
        >
          <div i-carbon-chevron-up w-5 h-5 opacity-60 />
        </div>
        <div px-4 py-3>
          <MarkdownRenderer :content="props.item.result" />
        </div>
      </div>
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

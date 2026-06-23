<script setup lang="ts">
import type { FavoriteResult } from '~/types'
import { computed, ref } from 'vue'
import MarkdownRenderer from '~/components/MarkdownRenderer.vue'
import { getImageByHash, getPromptById } from '~/logic'

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

const legacyModeMap: Record<string, string> = {
  concise: '简洁模式',
  detailed: '详细模式',
  novel: '小说模式',
  custom: '自定义模式',
}

const modeLabel = computed(() => {
  const prompt = getPromptById(props.item.mode)
  if (prompt)
    return prompt.name
  return legacyModeMap[props.item.mode] ?? props.item.mode
})

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

type CopyKey = 'result' | 'prompt' | 'additionalPrompt'
const copiedKey = ref<CopyKey | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function copyText(key: CopyKey, text: string) {
  if (!text)
    return
  try {
    await navigator.clipboard.writeText(text)
  }
  catch {
    // 降级方案：clipboard API 不可用时使用 textarea
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copiedKey.value = key
  if (copiedTimer)
    clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copiedKey.value = null
  }, 1500)
}
</script>

<template>
  <div
    p="4" mb-4
    border="~ base hover-base rounded-md"
    bg="light/80 dark:dark/80"
    flex flex-col gap-3 items-stretch
  >
    <div flex="~ col gap-3">
      <div text="sm" opacity-80>
        <span font-bold>{{ props.item.model }}</span>
        <span mx-2>·</span>
        <span capitalize>{{ modeLabel }}</span>
        <span mx-2>·</span>
        <span text-xs>{{ formatTime(props.item.time) }}</span>
      </div>

      <div flex="~ wrap gap-2">
        <button
          type="button" title="复制结果"
          flex="~ items-center gap-1" px-2.5 py-1 rounded-md text-xs
          border="~ base" cursor-pointer transition-colors duration-200
          hover="border-teal-500 text-teal-600"
          @click="copyText('result', props.item.result)"
        >
          <div :class="copiedKey === 'result' ? 'i-carbon-checkmark text-teal-500' : 'i-carbon-copy'" />
          {{ copiedKey === 'result' ? '已复制' : '复制结果' }}
        </button>
        <button
          type="button" title="复制 Prompt"
          flex="~ items-center gap-1" px-2.5 py-1 rounded-md text-xs
          border="~ base" transition-colors duration-200
          :class="props.item.prompt
            ? 'cursor-pointer hover:border-teal-500 hover:text-teal-600'
            : 'op-30 cursor-not-allowed'"
          :disabled="!props.item.prompt"
          @click="copyText('prompt', props.item.prompt ?? '')"
        >
          <div :class="copiedKey === 'prompt' ? 'i-carbon-checkmark text-teal-500' : 'i-carbon-document'" />
          {{ copiedKey === 'prompt' ? '已复制' : '复制 Prompt' }}
        </button>
        <button
          type="button" title="复制额外提示词"
          flex="~ items-center gap-1" px-2.5 py-1 rounded-md text-xs
          border="~ base" transition-colors duration-200
          :class="props.item.additionalPrompt
            ? 'cursor-pointer hover:border-teal-500 hover:text-teal-600'
            : 'op-30 cursor-not-allowed'"
          :disabled="!props.item.additionalPrompt"
          @click="copyText('additionalPrompt', props.item.additionalPrompt ?? '')"
        >
          <div :class="copiedKey === 'additionalPrompt' ? 'i-carbon-checkmark text-teal-500' : 'i-carbon-add-comment'" />
          {{ copiedKey === 'additionalPrompt' ? '已复制' : '复制额外提示词' }}
        </button>
        <button
          type="button" title="删除此项"
          flex="~ items-center gap-1" px-2.5 py-1 rounded-md text-xs ml-auto
          border="~ base" cursor-pointer transition-colors duration-200
          hover="border-red-400 text-red-500"
          @click="emit('delete')"
        >
          <div i-carbon-trash-can />
          删除
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

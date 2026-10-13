<script setup lang="ts">
import type { HistoryEntry } from '~/types'
import { computed, ref } from 'vue'
import MarkdownRenderer from '~/components/MarkdownRenderer.vue'
import { favoriteHistory, unfavoriteHistory } from '~/composables/useHistory'
import { getPromptById } from '~/logic'

// 历史项只提供「收藏 / 取消收藏」与复制；
// 编辑结果等操作放在收藏页，这里保持只读，避免误改未保存的内容
const props = defineProps<{
  item: HistoryEntry
}>()

const emit = defineEmits<{
  restore: []
}>()

const busy = ref(false)
const contentExpanded = ref(false)

const legacyModeMap: Record<string, string> = {
  concise: '简洁模式',
  detailed: '详细模式',
  novel: '小说模式',
  custom: '自定义模式',
}

const modeLabel = computed(() => {
  const prompt = getPromptById(props.item.mode)
  return prompt ? prompt.name : (legacyModeMap[props.item.mode] ?? props.item.mode)
})

const imageSrc = computed(() => {
  if (props.item.imageUrl)
    return props.item.imageUrl
  if (!props.item.imageBase64)
    return ''
  return `data:${props.item.mimeType};base64,${props.item.imageBase64}`
})

function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  copiedTimer = setTimeout(() => { copiedKey.value = null }, 1500)
}

async function toggleFavorite() {
  if (busy.value)
    return
  busy.value = true
  try {
    if (props.item.saved)
      await unfavoriteHistory(props.item)
    else
      await favoriteHistory(props.item)
  }
  catch (e) {
    console.error('[History] 收藏操作失败', e)
    alert(`操作失败：${(e as Error).message}`)
  }
  finally {
    busy.value = false
  }
}

function downloadImage() {
  if (props.item.imageUrl) {
    window.open(props.item.imageUrl, '_blank')
    return
  }
  if (!props.item.imageBase64)
    return
  const binary = atob(props.item.imageBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i)
  const ext = props.item.mimeType?.split('/')[1] || 'png'
  const url = URL.createObjectURL(new Blob([bytes], { type: props.item.mimeType }))
  const a = document.createElement('a')
  a.href = url
  a.download = `history-${props.item.time}.${ext}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
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
      <div flex="~ wrap items-center gap-x-2 gap-y-1" text-sm opacity-80>
        <span font-bold truncate min-w-0>{{ props.item.model }}</span>
        <span capitalize truncate min-w-0>{{ modeLabel }}</span>
        <span text-xs truncate min-w-0>{{ formatTime(props.item.time) }}</span>
        <span
          v-if="props.item.imageUrl"
          px-1 py-0 rounded text-2xs font-medium
          bg-yellow-100 text-yellow-800
          dark:bg-yellow-900 dark:text-yellow-200
        >
          外部链接
        </span>
        <span
          v-else
          px-1 py-0 rounded text-2xs font-medium
          bg-teal-100 text-teal-800
          dark:bg-teal-900 dark:text-teal-200
        >
          图片文件
        </span>
        <span
          v-if="!props.item.saved"
          px-1 py-0 rounded text-2xs font-medium
          bg-amber-100 text-amber-800
          dark:bg-amber-900 dark:text-amber-200
        >
          未收藏
        </span>
      </div>

      <div flex="~ wrap gap-x-2 gap-y-3" justify-between>
        <!-- 收藏 / 取消收藏 -->
        <div flex="~ wrap gap-2">
          <button
            type="button"
            :title="props.item.saved ? '从收藏夹移除' : '加入收藏夹'"
            flex="~ items-center gap-1" px-3 py-1.5 rounded-md text-xs text-white font-bold
            transition-colors duration-200
            :class="[
              props.item.saved ? 'bg-gray-500 hover:bg-gray-600' : 'bg-teal-600 hover:bg-teal-500',
              busy ? 'op-50 cursor-wait' : 'cursor-pointer',
            ]"
            :disabled="busy"
            @click="toggleFavorite"
          >
            <div :class="props.item.saved ? 'i-carbon-bookmark-filled' : 'i-carbon-bookmark'" />
            {{ props.item.saved ? '取消收藏' : '收藏' }}
          </button>

          <button
            type="button" title="复制结果"
            flex="~ items-center gap-1" px-3 py-1.5 rounded-md text-xs text-white font-bold
            bg-teal-600 hover:bg-teal-500
            cursor-pointer transition-colors duration-200
            @click="copyText('result', props.item.result)"
          >
            <div :class="copiedKey === 'result' ? 'i-carbon-checkmark' : 'i-carbon-copy'" />
            {{ copiedKey === 'result' ? '已复制' : '复制结果' }}
          </button>

          <button
            type="button" title="复制 Prompt"
            flex="~ items-center gap-1" px-3 py-1.5 rounded-md text-xs text-white font-bold
            transition-colors duration-200
            :class="props.item.prompt
              ? 'bg-teal-600 hover:bg-teal-500 cursor-pointer'
              : 'bg-teal-600 op-40 cursor-not-allowed'"
            :disabled="!props.item.prompt"
            @click="copyText('prompt', props.item.prompt ?? '')"
          >
            <div :class="copiedKey === 'prompt' ? 'i-carbon-checkmark' : 'i-carbon-document'" />
            {{ copiedKey === 'prompt' ? '已复制' : '复制 Prompt' }}
          </button>

          <button
            type="button" title="复制额外提示词"
            flex="~ items-center gap-1" px-3 py-1.5 rounded-md text-xs text-white font-bold
            transition-colors duration-200
            :class="props.item.additionalPrompt
              ? 'bg-teal-600 hover:bg-teal-500 cursor-pointer'
              : 'bg-teal-600 op-40 cursor-not-allowed'"
            :disabled="!props.item.additionalPrompt"
            @click="copyText('additionalPrompt', props.item.additionalPrompt ?? '')"
          >
            <div :class="copiedKey === 'additionalPrompt' ? 'i-carbon-checkmark' : 'i-carbon-add-comment'" />
            {{ copiedKey === 'additionalPrompt' ? '已复制' : '复制额外提示词' }}
          </button>

          <button
            type="button" title="下载图片"
            flex="~ items-center gap-1" px-3 py-1.5 rounded-md text-xs text-white font-bold
            bg-teal-600 hover:bg-teal-500
            cursor-pointer transition-colors duration-200
            @click="downloadImage"
          >
            <div i-carbon-download />
            下载图片
          </button>
        </div>

        <!-- 恢复到分析页 -->
        <div flex="~ gap-2">
          <button
            type="button" title="载入到分析页"
            flex="~ items-center gap-1" px-3 py-1.5 rounded-md text-xs text-white font-bold
            bg-amber-600 hover:bg-amber-500
            cursor-pointer transition-colors duration-200
            @click="emit('restore')"
          >
            <div i-carbon-arrow-right />
            载入
          </button>
        </div>
      </div>
    </div>

    <!-- 图片 -->
    <div
      v-if="imageSrc"
      border="~ base rounded"
      bg="light dark:dark"
      w-full min-h-40
      flex items-center justify-center
      class="relative"
    >
      <img
        :src="imageSrc"
        :alt="`History image at ${formatTime(props.item.time)}`"
        class="preview"
        rounded max-h-100 max-w-full object-contain
        bg-transparent block
      >
    </div>

    <!-- 结果 -->
    <div
      border="~ base rounded"
      text="left base"
      select-text w-full
      overflow-hidden
    >
      <div
        v-if="!contentExpanded"
        flex items-center justify-center
        cursor-pointer py-2
        bg="light-700 dark:dark-700"
        transition-colors duration-200
        hover:opacity-80
        select-none
        @click="contentExpanded = true"
      >
        <div i-carbon-chevron-down w-5 h-5 opacity-60 />
      </div>

      <div v-else bg="light dark:dark">
        <div
          flex items-center justify-center
          cursor-pointer py-2
          border="b base"
          transition-colors duration-200
          hover:opacity-60
          select-none
          @click="contentExpanded = false"
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

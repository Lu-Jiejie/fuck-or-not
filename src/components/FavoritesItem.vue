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

const emit = defineEmits<{
  delete: []
  update: [result: string]
  updateImageUrl: [imageUrl: string]
}>()

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
  if (props.item.imageUrl)
    return props.item.imageUrl
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

// 结果编辑
const isEditing = ref(false)
const editedText = ref('')

// 链接编辑
const isEditingUrl = ref(false)
const editedUrl = ref('')
const previewUrl = ref('')
const previewLoading = ref(false)
const previewError = ref(false)

function startEdit() {
  editedText.value = props.item.result
  isEditing.value = true
  if (props.isMobile)
    contentExpanded.value = true
}

function confirmEdit() {
  emit('update', editedText.value)
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}

function startEditUrl() {
  editedUrl.value = props.item.imageUrl ?? ''
  isEditingUrl.value = true
  previewUrl.value = ''
  previewLoading.value = false
  previewError.value = false
}

function confirmEditUrl() {
  const url = editedUrl.value.trim()
  if (!url) {
    editedUrl.value = props.item.imageUrl ?? ''
    isEditingUrl.value = false
    return
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url)
  }
  catch {
    editedUrl.value = props.item.imageUrl ?? ''
    isEditingUrl.value = false
    return
  }
  emit('updateImageUrl', url)
  isEditingUrl.value = false
}

function cancelEditUrl() {
  isEditingUrl.value = false
  previewUrl.value = ''
  previewLoading.value = false
  previewError.value = false
}

function preview() {
  const url = editedUrl.value.trim()
  if (!url)
    return
  try {
    // eslint-disable-next-line no-new
    new URL(url)
  }
  catch {
    return
  }

  previewLoading.value = true
  previewError.value = false
  previewUrl.value = ''

  const img = new Image()
  img.onload = () => {
    previewUrl.value = url
    previewLoading.value = false
  }
  img.onerror = () => {
    previewError.value = true
    previewLoading.value = false
  }
  img.src = url
}

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

function downloadImage() {
  if (props.item.imageUrl) {
    window.open(props.item.imageUrl, '_blank')
    return
  }
  const { base64, mimeType } = imageData.value
  if (!base64)
    return
  const ext = mimeType?.split('/')[1] || 'png'
  const filename = `${props.item.imageHash}.${ext}`
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
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
      </div>

      <div flex="~ wrap gap-x-2 gap-y-3" justify-between>
        <!-- 复制按钮组 -->
        <div flex="~ wrap gap-2">
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
          <button
            type="button" title="编辑图片链接"
            flex="~ items-center gap-1" px-3 py-1.5 rounded-md text-xs text-white font-bold
            bg-teal-600 hover:bg-teal-500
            cursor-pointer transition-colors duration-200
            @click="startEditUrl"
          >
            <div i-carbon-link />
            编辑图片链接
          </button>
        </div>

        <!-- 编辑 / 删除按钮组 -->
        <div flex="~ gap-2">
          <button
            v-if="!isEditing"
            type="button" title="编辑结果"
            flex="~ items-center gap-1" px-3 py-1.5 rounded-md text-xs text-white font-bold
            bg-teal-600 hover:bg-teal-500
            cursor-pointer transition-colors duration-200
            @click="startEdit"
          >
            <div i-carbon-edit />
            编辑
          </button>
          <button
            type="button" title="删除此项"
            flex="~ items-center gap-1" px-3 py-1.5 rounded-md text-xs text-white font-bold
            bg-red-500 hover:bg-red-400
            cursor-pointer transition-colors duration-200
            @click="emit('delete')"
          >
            <div i-carbon-trash-can />
            删除
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="isEditingUrl"
      border="~ base rounded"
      bg="light dark:dark"
      w-full p-4
      flex="~ col gap-3"
    >
      <input
        v-model="editedUrl"
        type="url"
        placeholder="输入新的图片链接"
        w-full px-3 py-2 rounded-lg
        border="~ base focus:teal-600"
        bg="transparent"
        outline="none"
        transition-colors duration-200
        @keydown.enter="confirmEditUrl"
      >
      <div flex="~ justify-end gap-2">
        <button
          type="button"
          text-xs text-white font-bold rounded-md px-4 py-2
          bg-amber-600 hover:bg-amber-700
          cursor-pointer transition-colors duration-200
          @click="preview"
        >
          预览
        </button>
        <button
          type="button"
          text-xs text-white font-bold rounded-md px-4 py-2
          bg-teal-600 hover:bg-teal-700
          cursor-pointer transition-colors duration-200
          @click="confirmEditUrl"
        >
          确认链接
        </button>
        <button
          type="button"
          text-xs text-white font-bold rounded-md px-4 py-2
          bg-red-400 hover:bg-red-500
          cursor-pointer transition-colors duration-200
          @click="cancelEditUrl"
        >
          取消
        </button>
      </div>
      <div v-if="previewLoading" text-center text-xs opacity-60 py-4>
        加载中...
      </div>
      <div
        v-if="previewUrl"
        mt-2 border="~ base rounded" p-2
      >
        <img
          :src="previewUrl"
          class="preview"
          rounded max-h-60 max-w-full object-contain mx-auto
        >
      </div>
      <div v-if="previewError" text-center text-xs text-red-500 py-4>
        无法加载图片，请检查链接是否正确
      </div>
    </div>
    <div
      v-else
      border="~ base rounded"
      bg="light dark:dark"
      w-full min-h-40
      flex items-center justify-center
      class="relative"
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

        <!-- 编辑模式 -->
        <div v-if="isEditing" px-4 py-3 flex="~ col gap-2">
          <textarea
            v-model="editedText"
            rows="12"
            w-full px-3 py-2 rounded-lg
            border="~ base focus:teal-600"
            bg="transparent"
            outline="none"
            resize-y
            transition-colors duration-200
          />
          <div flex="~ justify-end gap-2">
            <button
              type="button"
              text-xs text-white font-bold rounded-md px-4 py-2
              bg-teal-600 hover:bg-teal-700
              cursor-pointer transition-colors duration-200
              @click="confirmEdit"
            >
              确认编辑
            </button>
            <button
              type="button"
              text-xs text-white font-bold rounded-md px-4 py-2
              bg-red-400 hover:bg-red-500
              cursor-pointer transition-colors duration-200
              @click="cancelEdit"
            >
              取消
            </button>
          </div>
        </div>

        <!-- 展示模式 -->
        <div v-else px-4 py-3>
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

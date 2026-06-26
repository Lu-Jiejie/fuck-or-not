<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  maxSize?: number
}>(), {
  maxSize: 20,
})
const emit = defineEmits<{
  uploaded: [file: File]
  error: [message: string]
}>()

const modelValue = defineModel<File | string | null>()
const fileInput = ref<HTMLInputElement>()
const dragCounter = ref(0)
const isDragOver = computed(() => dragCounter.value > 0)

// 模式切换: 'file' 上传文件, 'url' 图片链接
const inputMode = ref<'file' | 'url'>('file')
const urlInput = ref('')

// 是否有值
const hasValue = computed(() => {
  if (inputMode.value === 'file')
    return modelValue.value instanceof File
  return typeof modelValue.value === 'string' && modelValue.value.length > 0
})

// 预览 URL
const previewUrl = ref<string>()

function handleInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    handleFileSelect(file)
  }
}

function handleFileSelect(file: File) {
  if (!file.type.startsWith('image/')) {
    emit('error', '请选择图片格式')
    return
  }

  const maxSizeInBytes = props.maxSize * 1024 * 1024
  if (file.size > maxSizeInBytes) {
    emit('error', `图片大小不能超过 ${props.maxSize}MB`)
    return
  }

  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  modelValue.value = file
  previewUrl.value = URL.createObjectURL(file)
  emit('uploaded', file)
}

function removeImage() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = undefined
  }
  modelValue.value = null
  urlInput.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function handleClick() {
  if (inputMode.value === 'file')
    fileInput.value?.click()
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  if (inputMode.value !== 'file')
    return
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    handleFileSelect(files[0])
  }
}

function handlePreview() {
  if (previewUrl.value) {
    const img = new window.Image()
    img.src = previewUrl.value
    img.alt = 'preview image'
    img.className = 'preview image-uploader'
    document.body.appendChild(img)
    img.click()
    document.body.removeChild(img)
  }
}

function confirmUrl() {
  const url = urlInput.value.trim()
  if (!url) {
    removeImage()
    return
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url)
  }
  catch {
    emit('error', '链接格式不正确')
    return
  }
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  modelValue.value = url
  previewUrl.value = url
  // 预加载图片检查是否可访问
  const img = new window.Image()
  img.onload = () => {
    emit('uploaded', url as any)
  }
  img.onerror = () => {
    emit('error', '图片链接无法访问，请检查链接是否有效')
  }
  img.src = url
  // 收起键盘
  ;(document.activeElement as HTMLElement)?.blur()
}

function switchMode(mode: 'file' | 'url') {
  removeImage()
  inputMode.value = mode
}
</script>

<template>
  <div>
    <!-- 模式切换 -->
    <div mb-3 flex="~ gap-1" p-1 rounded-lg bg-gray-100 dark:bg-gray-800 w-fit>
      <button
        px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 cursor-pointer
        :class="inputMode === 'file'
          ? 'bg-teal-600 text-white shadow-sm'
          : 'text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400'"
        @click="switchMode('file')"
      >
        图片文件
      </button>
      <button
        px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 cursor-pointer
        :class="inputMode === 'url'
          ? 'bg-teal-600 text-white shadow-sm'
          : 'text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400'"
        @click="switchMode('url')"
      >
        外部链接
      </button>
    </div>

    <!-- 文件上传模式 -->
    <div v-if="inputMode === 'file'" @drop="handleDrop" @dragleave.prevent.stop="dragCounter--" @dragenter.prevent.stop="dragCounter++" @dragover.prevent.stop>
      <div
        border="2 base hover-base rounded-md"
        :class="[
          !hasValue ? 'border-dashed' : 'border-solid',
          isDragOver ? '!border-teal-600 !dark:border-teal-700' : '',
        ]"
        min-h-40 w-full cursor-pointer relative overflow-hidden
        @click="handleClick"
      >
        <input
          ref="fileInput" accept="image/*" type="file" hidden
          @change="handleInputChange"
        >

        <div
          v-show="!hasValue && !isDragOver"
          flex="~ col items-center justify-center"
          opacity-60
          h-full min-h-40
        >
          <div i-carbon-add-large text-2xl />
        </div>

        <div
          v-show="!hasValue && isDragOver"
          flex="~ col items-center justify-center"
          bg="light dark:dark"
          opacity-60 h-full min-h-40 transition duration-200
        >
          <div i-carbon-document-add text-2xl />
        </div>

        <div
          v-show="hasValue"
          flex="~ col items-center justify-center relative"
        >
          <img
            :src="previewUrl"
            class="preview"
            rounded max-h-100 max-w-full object-contain block
          >
          <button
            absolute top-2 right-2 z-10 p-1
            border="rounded-full" transition
            hover="bg-dark/20 dark:bg-light/20"
            cursor-pointer
            title="preview image"
            @click.stop="handlePreview"
          >
            <div i-stash-expand-diagonal-duotone text-2xl text-teal-700 />
          </button>
        </div>
      </div>
    </div>

    <!-- URL 模式 -->
    <div v-else flex="~ col gap-3">
      <input
        v-model="urlInput"
        type="url"
        placeholder="粘贴图片链接，回车确认"
        w-full px-3 py-2 rounded-lg
        border="~ base focus:teal-600"
        bg="transparent"
        outline="none"
        transition-colors duration-200
        @keydown.enter="confirmUrl"
      >
      <div
        v-if="hasValue"
        border="~ base rounded-md"
        min-h-40 w-full
        flex flex-col items-center justify-center relative overflow-hidden
      >
        <img
          :src="previewUrl"
          class="preview"
          rounded max-h-100 max-w-full object-contain block p-2
        >
      </div>
    </div>
  </div>
</template>

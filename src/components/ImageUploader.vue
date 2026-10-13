<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  maxSize?: number
  // 载入文件图时 bytes 不在 modelValue 里（它只表示 File 或外链），
  // 通过这个 props 把 base64 与 mime 传进来显示预览
  inlineBase64?: string | null
  inlineMimeType?: string
}>(), {
  maxSize: 20,
  inlineBase64: null,
  inlineMimeType: 'image/png',
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

// 预览地址。外部直接改写 modelValue（载入历史/收藏）时也要能显示，
// 因此用 computed 从 modelValue 推导，而不是只在交互里赋值。
const localPreviewUrl = ref<string>()

const derivedPreview = computed(() => {
  const v = modelValue.value
  if (v)
    return v instanceof File ? localPreviewUrl.value : v
  // 载入的文件图：bytes 由 props 传入
  if (props.inlineBase64)
    return `data:${props.inlineMimeType};base64,${props.inlineBase64}`
  return undefined
})

const previewUrl = computed(() => localPreviewUrl.value ?? derivedPreview.value)

// 是否有值：File、外链、或载入的 base64 都算
const hasValue = computed(() =>
  Boolean(modelValue.value) || Boolean(props.inlineBase64),
)

// 外部载入（切页/载入历史或收藏）时同步模式与输入框。
// 用「值来源是否变化」判断，避免用户在 URL 框里打字时被回写覆盖。
let lastSyncedKey: string | null = null

watch([modelValue, () => props.inlineBase64], ([v, inline]) => {
  const key = v instanceof File
    ? `file:${v.name}:${v.size}`
    : inline
      ? `inline:${String(inline).length}`
      : typeof v === 'string' && v
        ? `url:${v}`
        : null

  if (key === lastSyncedKey)
    return
  lastSyncedKey = key

  if (typeof v === 'string' && v) {
    inputMode.value = 'url'
    urlInput.value = v
  }
  else if (inline) {
    // 载入的文件图：bytes 在 props 里，切到文件模式显示预览
    inputMode.value = 'file'
    urlInput.value = ''
  }
  else if (!v) {
    urlInput.value = ''
    if (fileInput.value)
      fileInput.value.value = ''
  }
}, { immediate: true })

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

  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
  }
  modelValue.value = file
  localPreviewUrl.value = URL.createObjectURL(file)
  emit('uploaded', file)
}

function removeImage() {
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = undefined
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
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = undefined
  }
  modelValue.value = url
  // 外链直接由 derivedPreview 提供预览，无需另存
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

// 切换模式只换视图，不改动已选的图片：
// 之前这里会 removeImage()，来回点一下 tab 图片就没了。
function switchMode(mode: 'file' | 'url') {
  if (mode === inputMode.value)
    return
  // URL 模式下输入框回填当前链接，方便继续编辑
  if (mode === 'url' && typeof modelValue.value === 'string')
    urlInput.value = modelValue.value
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

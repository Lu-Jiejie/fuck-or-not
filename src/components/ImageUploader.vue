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
const modelValue = defineModel<File | null>()
const fileInput = ref<HTMLInputElement>()
const isEmpty = computed(() => !modelValue.value)
const previewUrl = ref<string>()
const dragCounter = ref(0)
const isDragOver = computed(() => dragCounter.value > 0)

function handleInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    handleFileSelect(file)
  }
  else {
    removeImage()
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
  previewUrl.value = URL.createObjectURL(file)
  modelValue.value = file
  emit('uploaded', file)
}

function removeImage() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = undefined
  }
  modelValue.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function handleClick() {
  fileInput.value?.click()
}

function handleDrop(e: DragEvent) {
  e.preventDefault()

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    handleFileSelect(files[0])
  }
}
</script>

<template>
  <div
    border="2 base hover-base rounded-md"
    :class="[
      isEmpty
        ? 'border-dashed'
        : 'border-solid',
      isDragOver ? '!border-teal-600 !dark:border-teal-700' : '',
    ]"
    min-h-50 w-full cursor-pointer relative overflow-hidden
    @click="handleClick"
    @drop="handleDrop"
    @dragleave.prevent.stop="dragCounter--"
    @dragenter.prevent.stop="dragCounter++"
    @dragover.prevent.stop
  >
    <input
      ref="fileInput" accept="image/*" type="file" hidden
      @change="handleInputChange"
    >

    <div
      v-show="isEmpty && !isDragOver"
      flex="~ col items-center justify-center"
      text-gray-500 dark:text-gray-400
      h-full min-h-50
    >
      <div i-carbon-add-large text-2xl />
    </div>

    <div
      v-show="isEmpty && isDragOver"
      flex="~ col items-center justify-center"
      text-gray-500 dark:text-gray-400
      bg-light dark:bg-dark
      h-full min-h-50 transition duration-200
    >
      <div i-carbon-document-add text-2xl />
    </div>

    <div
      v-show="!isEmpty"
      flex="~ col items-center justify-center"
    >
      <img
        :src="previewUrl"
        rounded max-h-100 max-w-full object-contain
      >
    </div>
  </div>
</template>

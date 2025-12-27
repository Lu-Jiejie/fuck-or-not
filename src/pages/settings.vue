<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { nextTick, ref } from 'vue'
import Input from '~/components/Input.vue'
import Textarea from '~/components/Textarea.vue'
import { addModel, modelOptions, removeModel, resetModelOptions, updateModel } from '~/logic'
import { defaultConcisePrompt, defaultDetailedPrompt, defaultNovelPrompt } from '~/logic/prompts'

const googleApiKey = useStorage('google-api-key', '')
const concisePrompt = useStorage('concise-prompt', '')
const detailedPrompt = useStorage('detailed-prompt', '')
const novelPrompt = useStorage('novel-prompt', '')
const customPrompts = useStorage('custom-prompt', '')

const defaultPrompts = [
  defaultConcisePrompt,
  defaultDetailedPrompt,
  defaultNovelPrompt,
]
const prompts = [
  concisePrompt,
  detailedPrompt,
  novelPrompt,
]

function getDefaultPrompt(mode: 0 | 1 | 2) {
  const defaultPrompt = defaultPrompts[mode]
  const prompt = prompts[mode]

  if (prompt.value.trim() !== '') {
    if (!confirm('当前模式的 Prompt 已被自定义，获取默认 Prompt 将覆盖现有内容，是否继续？')) {
      return
    }
  }
  prompt.value = defaultPrompt
}

function clearPrompt(mode: 0 | 1 | 2) {
  const prompt = prompts[mode]
  if (prompt.value.trim() !== '') {
    if (!confirm('当前模式的 Prompt 已被自定义，清空将丢失现有内容，是否继续？')) {
      return
    }
  }
  prompt.value = ''
}

// 模型管理
const editingIndex = ref<number | null>(null)
const editingValue = ref('')
const isAdding = ref(false)
const newModelValue = ref('')
const editingInputRef = ref<HTMLInputElement[]>([])
const addingInputRef = ref<HTMLInputElement | null>(null)

function startAdding() {
  isAdding.value = true
  newModelValue.value = ''
  nextTick(() => {
    addingInputRef.value?.focus()
  })
}

function cancelAdding() {
  isAdding.value = false
  newModelValue.value = ''
}

function saveAdding() {
  if (!newModelValue.value.trim()) {
    alert('请填写模型 ID')
    return
  }
  addModel(newModelValue.value.trim())
  cancelAdding()
}

function handleRemoveModel(index: number) {
  if (confirm('确定要删除这个模型吗？')) {
    removeModel(index)
  }
}

function startEditing(index: number, model: string) {
  editingIndex.value = index
  editingValue.value = model
  nextTick(() => {
    editingInputRef.value[0]?.focus()
  })
}

function cancelEditing() {
  editingIndex.value = null
  editingValue.value = ''
}

function saveEditing(index: number) {
  if (!editingValue.value.trim()) {
    alert('请填写模型 ID')
    return
  }
  updateModel(index, editingValue.value.trim())
  cancelEditing()
}

function handleResetModels() {
  if (confirm('确定要重置为默认模型列表吗？这将丢失所有自定义修改。')) {
    resetModelOptions()
  }
}
</script>

<template>
  <h1 text-3xl font-bold>
    设置
  </h1>
  <div py-4 />
  <span label ml-0.5>
    Google API 秘钥
    <a
      href="https://aistudio.google.com/app/apikey"
      target="_blank"
      ml-1 underline cursor-pointer op-70
    >此处获取</a>
  </span>
  <Input v-model="googleApiKey" type="password" />

  <div py-4 />
  <span label ml-0.5>
    模型列表
    <a
      ml-1 underline cursor-pointer op-70
      @click.prevent="handleResetModels"
    >重置为默认</a>
  </span>
  <div
    border="~ base rounded"
    bg="light dark:dark"
    p="x-4"
  >
    <div v-for="(model, index) in modelOptions" :key="index" py-2 flex="~ items-center gap-2" border="b base">
      <template v-if="editingIndex === index">
        <input
          ref="editingInputRef"
          v-model="editingValue"
          type="text"
          placeholder="模型 ID"
          font-mono text-sm flex-1 min-w-0
          p="x-2 y-1"
          bg="transparent"
          border="~ rounded base focus:teal-600"
          outline="none"
          class="h-8"
        >
        <div flex="~ gap-1 items-center">
          <button
            p-2 rounded cursor-pointer
            text-white
            transition-colors duration-200
            class="bg-teal-600 hover:bg-teal-700 h-8 w-8"
            flex items-center justify-center
            title="保存"
            @click="saveEditing(index)"
          >
            <div i-carbon-checkmark />
          </button>
          <button
            p-2 rounded cursor-pointer
            text-white
            transition-colors duration-200
            class="bg-gray-500 hover:bg-gray-600 h-8 w-8"
            flex items-center justify-center
            title="取消"
            @click="cancelEditing"
          >
            <div i-carbon-close />
          </button>
        </div>
      </template>
      <template v-else>
        <span font-mono text-sm truncate flex-1 min-w-0 class="leading-8">{{ model }}</span>
        <div flex="~ gap-1 items-center">
          <button
            p-2 rounded cursor-pointer
            text-white
            transition-colors duration-200
            class="bg-teal-600 hover:bg-teal-700 h-8 w-8"
            flex items-center justify-center
            title="编辑"
            @click="startEditing(index, model)"
          >
            <div i-carbon-edit />
          </button>
          <button
            p-2 rounded cursor-pointer
            text-white
            transition-colors duration-200
            class="bg-red-400 hover:bg-red-500 h-8 w-8"
            flex items-center justify-center
            title="删除"
            @click="handleRemoveModel(index)"
          >
            <div i-carbon-trash-can />
          </button>
        </div>
      </template>
    </div>
    <!-- 添加新模型行 -->
    <div py-2 flex="~ items-center gap-2">
      <template v-if="isAdding">
        <input
          ref="addingInputRef"
          v-model="newModelValue"
          type="text"
          placeholder="模型 ID（如 gemini-2.5-flash）"
          font-mono text-sm flex-1 min-w-0
          p="x-2 y-1"
          bg="transparent"
          border="~ rounded base focus:teal-600"
          outline="none"
          class="h-8"
        >
        <div flex="~ gap-1 items-center">
          <button
            p-2 rounded cursor-pointer
            text-white
            transition-colors duration-200
            class="bg-teal-600 hover:bg-teal-700 h-8 w-8"
            flex items-center justify-center
            title="保存"
            @click="saveAdding"
          >
            <div i-carbon-checkmark />
          </button>
          <button
            p-2 rounded cursor-pointer
            text-white
            transition-colors duration-200
            class="bg-gray-500 hover:bg-gray-600 h-8 w-8"
            flex items-center justify-center
            title="取消"
            @click="cancelAdding"
          >
            <div i-carbon-close />
          </button>
        </div>
      </template>
      <template v-else>
        <span flex-1 min-w-0 class="leading-8" text-gray-400 op-50 font-mono text-sm>...</span>
        <button
          p-2 rounded cursor-pointer
          text-white
          transition-colors duration-200
          class="bg-teal-600 hover:bg-teal-700 h-8 w-8"
          flex items-center justify-center
          title="添加新模型"
          @click="startAdding"
        >
          <div i-carbon-add />
        </button>
      </template>
    </div>
  </div>

  <div py-4 />
  <span label ml-0.5>
    简洁模式 Prompt
    <a
      target="_blank"
      ml-1 underline cursor-pointer op-70
      @click.prevent="getDefaultPrompt(0)"
    >获取默认 Prompt</a>
    <a
      target="_blank"
      ml-2 underline cursor-pointer opacity-70
      @click.prevent="clearPrompt(0)"
    >清空</a>
  </span>
  <Textarea v-model="concisePrompt" placeholder="留空将使用默认配置......" />

  <div py-4 />
  <span label ml-0.5>
    详细模式 Prompt
    <a
      target="_blank"
      ml-1 underline cursor-pointer op-70
      @click.prevent="getDefaultPrompt(1)"
    >获取默认 Prompt</a>
    <a
      target="_blank"
      ml-2 underline cursor-pointer op-70
      @click.prevent="clearPrompt(1)"
    >清空</a>
  </span>
  <Textarea v-model="detailedPrompt" placeholder="留空将使用默认配置......" />

  <div py-4 />
  <span label ml-0.5>
    小说模式 Prompt
    <a
      target="_blank"
      ml-1 underline cursor-pointer op-70
      @click.prevent="getDefaultPrompt(2)"
    >获取默认 Prompt</a>
    <a
      target="_blank"
      ml-2 underline cursor-pointer op-70
      @click.prevent="clearPrompt(2)"
    >清空</a>
  </span>
  <Textarea v-model="novelPrompt" placeholder="留空将使用默认配置......" />

  <div py-4 />
  <span label ml-0.5>
    自定义模式 Prompt
  </span>
  <Textarea v-model="customPrompts" placeholder="也许你需要第四个 prompt ，留空将不启用......" />
</template>

<script setup lang="ts">
import type { AIProvider } from '~/types'
import { useStorage } from '@vueuse/core'
import Sortable from 'sortablejs'
import { nextTick, onMounted, ref } from 'vue'
import Input from '~/components/Input.vue'
import Textarea from '~/components/Textarea.vue'
import { webdavAction, webdavDownload, webdavPassword, webdavProgress, webdavStatus, webdavSyncing, webdavUpload, webdavUrl, webdavUsername } from '~/composables/useWebDAV'
import { addProviderModel, chatgptApiKey, chatgptApiUrl, chatgptModels, geminiApiUrl, geminiModels, grokApiKey, grokApiUrl, grokModels, removeProviderModel, resetProviderModels, updateProviderModel } from '~/logic'

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

const editingIndex = ref<number | null>(null)
const editingModelId = ref('')
const editingProvider = ref<AIProvider>('Gemini')
const isAdding = ref(false)
const newModelId = ref('')
const newModelProvider = ref<AIProvider>('Gemini')
const editingInputRef = ref<HTMLInputElement[]>([])
const addingInputRef = ref<HTMLInputElement | null>(null)

function startEditingProvider(provider: AIProvider, index: number, modelId: string) {
  cancelAdding()
  editingIndex.value = index
  editingModelId.value = modelId
  editingProvider.value = provider
  nextTick(() => {
    editingInputRef.value[0]?.focus()
  })
}

function cancelEditing() {
  editingIndex.value = null
  editingModelId.value = ''
  editingProvider.value = 'Gemini'
}

function saveEditingProvider(provider: AIProvider, index: number) {
  if (!editingModelId.value.trim()) {
    alert('请填写模型 ID')
    return
  }
  updateProviderModel(provider, index, editingModelId.value.trim())
  cancelEditing()
}

function handleResetModels(provider?: AIProvider) {
  const message = provider
    ? `确定要重置 ${provider} 的模型列表为默认吗？这将丢失该提供商的所有自定义修改。`
    : '确定要重置所有提供商的模型列表为默认吗？这将丢失所有自定义修改。'

  if (confirm(message)) {
    resetProviderModels(provider)
  }
}

const geminiListRef = ref<HTMLElement | null>(null)
const grokListRef = ref<HTMLElement | null>(null)
const chatgptListRef = ref<HTMLElement | null>(null)

onMounted(() => {
  // 为每个提供商的模型列表创建可拖拽排序
  if (geminiListRef.value) {
    Sortable.create(geminiListRef.value, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      onEnd({ oldIndex, newIndex }) {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex)
          return
        const list = [...geminiModels.value]
        const [item] = list.splice(oldIndex, 1)
        list.splice(newIndex, 0, item)
        geminiModels.value = list
      },
    })
  }

  if (grokListRef.value) {
    Sortable.create(grokListRef.value, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      onEnd({ oldIndex, newIndex }) {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex)
          return
        const list = [...grokModels.value]
        const [item] = list.splice(oldIndex, 1)
        list.splice(newIndex, 0, item)
        grokModels.value = list
      },
    })
  }

  if (chatgptListRef.value) {
    Sortable.create(chatgptListRef.value, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      onEnd({ oldIndex, newIndex }) {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex)
          return
        const list = [...chatgptModels.value]
        const [item] = list.splice(oldIndex, 1)
        list.splice(newIndex, 0, item)
        chatgptModels.value = list
      },
    })
  }
})

const settingsFileInputRef = ref<HTMLInputElement | null>(null)

function onExportSettings() {
  if (!confirm('确定要导出当前设置吗？')) {
    return
  }
  const settings = {
    googleApiKey: googleApiKey.value,
    geminiApiUrl: geminiApiUrl.value,
    grokApiKey: grokApiKey.value,
    grokApiUrl: grokApiUrl.value,
    chatgptApiKey: chatgptApiKey.value,
    chatgptApiUrl: chatgptApiUrl.value,
    geminiModels: geminiModels.value,
    grokModels: grokModels.value,
    chatgptModels: chatgptModels.value,
    concisePrompt: concisePrompt.value,
    detailedPrompt: detailedPrompt.value,
    novelPrompt: novelPrompt.value,
    customPrompts: customPrompts.value,
  }
  const data = JSON.stringify(settings, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `settings-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function onImportSettingsClick() {
  if (!confirm('导入设置将覆盖当前所有设置，确定要继续吗？')) {
    return
  }
  settingsFileInputRef.value?.click()
}

function onImportSettingsFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string)
      if (typeof data !== 'object' || data === null) {
        alert('导入失败：文件格式不正确')
        return
      }
      if (data.googleApiKey !== undefined)
        googleApiKey.value = data.googleApiKey
      if (data.geminiApiUrl !== undefined)
        geminiApiUrl.value = data.geminiApiUrl
      if (data.grokApiKey !== undefined)
        grokApiKey.value = data.grokApiKey
      if (data.grokApiUrl !== undefined)
        grokApiUrl.value = data.grokApiUrl
      if (data.chatgptApiKey !== undefined)
        chatgptApiKey.value = data.chatgptApiKey
      if (data.chatgptApiUrl !== undefined)
        chatgptApiUrl.value = data.chatgptApiUrl

      // 兼容新格式：按提供商分组的模型列表
      if (Array.isArray(data.geminiModels))
        geminiModels.value = data.geminiModels
      if (Array.isArray(data.grokModels))
        grokModels.value = data.grokModels
      if (Array.isArray(data.chatgptModels))
        chatgptModels.value = data.chatgptModels

      // 兼容旧格式：统一的 modelOptions
      if (Array.isArray(data.modelOptions) && data.modelOptions.length > 0) {
        const gemini: string[] = []
        const grok: string[] = []
        const chatgpt: string[] = []

        for (const model of data.modelOptions) {
          if (model.provider === 'Gemini') {
            gemini.push(model.id)
          }
          else if (model.provider === 'Grok') {
            grok.push(model.id)
          }
          else if (model.provider === 'ChatGPT') {
            chatgpt.push(model.id)
          }
        }

        if (gemini.length > 0)
          geminiModels.value = gemini
        if (grok.length > 0)
          grokModels.value = grok
        if (chatgpt.length > 0)
          chatgptModels.value = chatgpt
      }

      if (data.concisePrompt !== undefined)
        concisePrompt.value = data.concisePrompt
      if (data.detailedPrompt !== undefined)
        detailedPrompt.value = data.detailedPrompt
      if (data.novelPrompt !== undefined)
        novelPrompt.value = data.novelPrompt
      if (data.customPrompts !== undefined)
        customPrompts.value = data.customPrompts
      alert('设置导入成功')
    }
    catch {
      alert('导入失败：文件解析错误')
    }
  }
  reader.readAsText(file)
  input.value = ''
}

function startAdding(provider: AIProvider) {
  cancelEditing()
  isAdding.value = true
  newModelId.value = ''
  newModelProvider.value = provider
  nextTick(() => {
    addingInputRef.value?.focus()
  })
}

function cancelAdding() {
  isAdding.value = false
  newModelId.value = ''
}

function saveAdding() {
  if (!newModelId.value.trim()) {
    alert('请填写模型 ID')
    return
  }
  addProviderModel(newModelProvider.value, newModelId.value.trim())
  cancelAdding()
}

function handleRemoveModel(provider: AIProvider, index: number) {
  if (confirm('确定要删除该模型吗？')) {
    removeProviderModel(provider, index)
  }
}
</script>

<template>
  <div mb-6 text-left px-1>
    <h1 text-3xl font-bold>
      设置
    </h1>
    <p text-sm op-50 mt-1>
      管理 API 密钥、模型和 Prompt 配置
    </p>
  </div>

  <!-- Gemini 配置 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div flex="~ items-center gap-2" mb-5>
      <div w-1 h-6 rounded-full class="bg-teal-500" />
      <h2 text-lg font-semibold>
        Gemini 配置
      </h2>
    </div>

    <div mb-4>
      <span label ml-0.5>
        API 密钥
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          ml-1 underline cursor-pointer op-60 hover:op-100 transition-opacity
        >此处获取</a>
      </span>
      <Input v-model="googleApiKey" type="password" />
    </div>

    <div mb-4>
      <span label ml-0.5>
        API 地址
        <span ml-1 text-xs op-50>(留空使用默认地址)</span>
      </span>
      <Input
        v-model="geminiApiUrl"
        type="text"
        placeholder="https://generativelanguage.googleapis.com"
      />
    </div>

    <div>
      <div flex="~ items-center justify-between" mb-3>
        <span label ml-0.5>模型列表</span>
        <button
          text-sm op-60 hover:op-100 underline cursor-pointer transition-opacity
          @click="handleResetModels('Gemini')"
        >
          重置为默认
        </button>
      </div>
      <div ref="geminiListRef" rounded-lg border="~ base" overflow-hidden>
        <div
          v-for="(modelId, index) in geminiModels"
          :key="modelId"
          px-4 py-2.5 flex="~ items-center gap-2"
          border="b base"
          class="last:border-b-0"
        >
          <template v-if="editingIndex === index && editingProvider === 'Gemini'">
            <input
              ref="editingInputRef"
              v-model="editingModelId"
              type="text"
              placeholder="模型 ID"
              font-mono text-sm w-full
              p="x-2 y-1"
              bg="transparent"
              border="~ rounded base focus:teal-600"
              outline="none"
              class="h-8"
            >
            <div flex="~ gap-1 items-center">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-teal-600 hover:bg-teal-700 h-8 w-8"
                flex items-center justify-center
                title="保存"
                @click="saveEditingProvider('Gemini', index)"
              >
                <div i-carbon-checkmark />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
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
            <div class="drag-handle" i-carbon-draggable op-30 hover:op-70 cursor-grab active:cursor-grabbing flex-shrink-0 p-2 ml--2 />
            <span font-mono text-sm truncate flex-1 class="leading-8">{{ modelId }}</span>
            <div flex="~ gap-1 items-center">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-teal-600 hover:bg-teal-700 h-8 w-8"
                flex items-center justify-center
                title="编辑"
                @click="startEditingProvider('Gemini', index, modelId)"
              >
                <div i-carbon-edit />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-red-400 hover:bg-red-500 h-8 w-8"
                flex items-center justify-center
                title="删除"
                @click="handleRemoveModel('Gemini', index)"
              >
                <div i-carbon-trash-can />
              </button>
            </div>
          </template>
        </div>

        <!-- 添加新模型行 -->
        <div px-4 py-2.5 flex="~ items-center gap-2">
          <template v-if="isAdding && newModelProvider === 'Gemini'">
            <input
              ref="addingInputRef"
              v-model="newModelId"
              type="text"
              placeholder="模型 ID（如 gemini-2.5-flash）"
              font-mono text-sm w-full
              p="x-2 y-1"
              bg="transparent"
              border="~ rounded base focus:teal-600"
              outline="none"
              class="h-8"
            >
            <div flex="~ gap-1 items-center">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-teal-600 hover:bg-teal-700 h-8 w-8"
                flex items-center justify-center
                title="保存"
                @click="saveAdding"
              >
                <div i-carbon-checkmark />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
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
            <button
              flex="~ items-center gap-1.5" text-sm op-60 hover:op-100
              cursor-pointer transition-opacity
              @click="startAdding('Gemini')"
            >
              <div i-carbon-add />
              添加模型
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Grok 配置 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div flex="~ items-center gap-2" mb-5>
      <div w-1 h-6 rounded-full class="bg-purple-500" />
      <h2 text-lg font-semibold>
        Grok 配置
      </h2>
    </div>

    <div mb-4>
      <span label ml-0.5>
        API 密钥
        <a
          href="https://console.x.ai/"
          target="_blank"
          ml-1 underline cursor-pointer op-60 hover:op-100 transition-opacity
        >此处获取</a>
      </span>
      <Input v-model="grokApiKey" type="password" />
    </div>

    <div mb-4>
      <span label ml-0.5>
        API 地址
        <span ml-1 text-xs op-50>(留空使用默认地址)</span>
      </span>
      <Input
        v-model="grokApiUrl"
        type="text"
        placeholder="https://api.x.ai"
      />
    </div>

    <div>
      <div flex="~ items-center justify-between" mb-3>
        <span label ml-0.5>模型列表</span>
        <button
          text-sm op-60 hover:op-100 underline cursor-pointer transition-opacity
          @click="handleResetModels('Grok')"
        >
          重置为默认
        </button>
      </div>
      <div ref="grokListRef" rounded-lg border="~ base" overflow-hidden>
        <div
          v-for="(modelId, index) in grokModels"
          :key="modelId"
          px-4 py-2.5 flex="~ items-center gap-2"
          border="b base"
          class="last:border-b-0"
        >
          <template v-if="editingIndex === index && editingProvider === 'Grok'">
            <input
              ref="editingInputRef"
              v-model="editingModelId"
              type="text"
              placeholder="模型 ID"
              font-mono text-sm w-full
              p="x-2 y-1"
              bg="transparent"
              border="~ rounded base focus:purple-600"
              outline="none"
              class="h-8"
            >
            <div flex="~ gap-1 items-center">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-purple-600 hover:bg-purple-700 h-8 w-8"
                flex items-center justify-center
                title="保存"
                @click="saveEditingProvider('Grok', index)"
              >
                <div i-carbon-checkmark />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
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
            <div class="drag-handle" i-carbon-draggable op-30 hover:op-70 cursor-grab active:cursor-grabbing flex-shrink-0 p-2 ml--2 />
            <span font-mono text-sm truncate flex-1 class="leading-8">{{ modelId }}</span>
            <div flex="~ gap-1 items-center">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-purple-600 hover:bg-purple-700 h-8 w-8"
                flex items-center justify-center
                title="编辑"
                @click="startEditingProvider('Grok', index, modelId)"
              >
                <div i-carbon-edit />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-red-400 hover:bg-red-500 h-8 w-8"
                flex items-center justify-center
                title="删除"
                @click="handleRemoveModel('Grok', index)"
              >
                <div i-carbon-trash-can />
              </button>
            </div>
          </template>
        </div>

        <!-- 添加新模型行 -->
        <div px-4 py-2.5 flex="~ items-center gap-2">
          <template v-if="isAdding && newModelProvider === 'Grok'">
            <input
              ref="addingInputRef"
              v-model="newModelId"
              type="text"
              placeholder="模型 ID（如 grok-4）"
              font-mono text-sm w-full
              p="x-2 y-1"
              bg="transparent"
              border="~ rounded base focus:purple-600"
              outline="none"
              class="h-8"
            >
            <div flex="~ gap-1 items-center">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-purple-600 hover:bg-purple-700 h-8 w-8"
                flex items-center justify-center
                title="保存"
                @click="saveAdding"
              >
                <div i-carbon-checkmark />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
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
            <button
              flex="~ items-center gap-1.5" text-sm op-60 hover:op-100
              cursor-pointer transition-opacity
              @click="startAdding('Grok')"
            >
              <div i-carbon-add />
              添加模型
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- ChatGPT 配置 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div flex="~ items-center gap-2" mb-5>
      <div w-1 h-6 rounded-full class="bg-green-500" />
      <h2 text-lg font-semibold>
        ChatGPT 配置
      </h2>
    </div>

    <div mb-4>
      <span label ml-0.5>
        API 密钥
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          ml-1 underline cursor-pointer op-60 hover:op-100 transition-opacity
        >此处获取</a>
      </span>
      <Input v-model="chatgptApiKey" type="password" />
    </div>

    <div mb-4>
      <span label ml-0.5>
        API 地址
        <span ml-1 text-xs op-50>(留空使用默认地址)</span>
      </span>
      <Input
        v-model="chatgptApiUrl"
        type="text"
        placeholder="https://api.openai.com"
      />
    </div>

    <div>
      <div flex="~ items-center justify-between" mb-3>
        <span label ml-0.5>模型列表</span>
        <button
          text-sm op-60 hover:op-100 underline cursor-pointer transition-opacity
          @click="handleResetModels('ChatGPT')"
        >
          重置为默认
        </button>
      </div>
      <div ref="chatgptListRef" rounded-lg border="~ base" overflow-hidden>
        <div
          v-for="(modelId, index) in chatgptModels"
          :key="modelId"
          px-4 py-2.5 flex="~ items-center gap-2"
          border="b base"
          class="last:border-b-0"
        >
          <template v-if="editingIndex === index && editingProvider === 'ChatGPT'">
            <input
              ref="editingInputRef"
              v-model="editingModelId"
              type="text"
              placeholder="模型 ID"
              font-mono text-sm w-full
              p="x-2 y-1"
              bg="transparent"
              border="~ rounded base focus:green-600"
              outline="none"
              class="h-8"
            >
            <div flex="~ gap-1 items-center">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-green-600 hover:bg-green-700 h-8 w-8"
                flex items-center justify-center
                title="保存"
                @click="saveEditingProvider('ChatGPT', index)"
              >
                <div i-carbon-checkmark />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
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
            <div class="drag-handle" i-carbon-draggable op-30 hover:op-70 cursor-grab active:cursor-grabbing flex-shrink-0 p-2 ml--2 />
            <span font-mono text-sm truncate flex-1 class="leading-8">{{ modelId }}</span>
            <div flex="~ gap-1 items-center">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-green-600 hover:bg-green-700 h-8 w-8"
                flex items-center justify-center
                title="编辑"
                @click="startEditingProvider('ChatGPT', index, modelId)"
              >
                <div i-carbon-edit />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-red-400 hover:bg-red-500 h-8 w-8"
                flex items-center justify-center
                title="删除"
                @click="handleRemoveModel('ChatGPT', index)"
              >
                <div i-carbon-trash-can />
              </button>
            </div>
          </template>
        </div>

        <!-- 添加新模型行 -->
        <div px-4 py-2.5 flex="~ items-center gap-2">
          <template v-if="isAdding && newModelProvider === 'ChatGPT'">
            <input
              ref="addingInputRef"
              v-model="newModelId"
              type="text"
              placeholder="模型 ID（如 gpt-4o）"
              font-mono text-sm w-full
              p="x-2 y-1"
              bg="transparent"
              border="~ rounded base focus:green-600"
              outline="none"
              class="h-8"
            >
            <div flex="~ gap-1 items-center">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-green-600 hover:bg-green-700 h-8 w-8"
                flex items-center justify-center
                title="保存"
                @click="saveAdding"
              >
                <div i-carbon-checkmark />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
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
            <button
              flex="~ items-center gap-1.5" text-sm op-60 hover:op-100
              cursor-pointer transition-opacity
              @click="startAdding('ChatGPT')"
            >
              <div i-carbon-add />
              添加模型
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- WebDAV 同步 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div flex="~ items-center gap-2" mb-5>
      <div w-1 h-6 rounded-full class="bg-teal-500" />
      <h2 text-lg font-semibold>
        WebDAV 同步
      </h2>
    </div>

    <div mb-4>
      <span label ml-0.5>
        WebDAV 地址
        <span ml-1 text-xs op-50>(请使用支持 CORS 的 WebDAV 服务器)</span>
      </span>
      <Input v-model="webdavUrl" type="text" placeholder="https://dav.example.com/dav/" />
    </div>

    <div mb-4>
      <span label ml-0.5>用户名</span>
      <Input v-model="webdavUsername" type="text" placeholder="（可选）" />
    </div>

    <div mb-4>
      <span label ml-0.5>密码</span>
      <Input v-model="webdavPassword" type="password" placeholder="（可选）" />
    </div>

    <div flex="~ gap-3 wrap items-center">
      <button
        flex="~ items-center gap-2" px-4 py-2 rounded-lg text-sm font-medium
        border="~ base" cursor-pointer transition-colors duration-200
        hover:bg-gray-100 dark:hover:bg-gray-900
        :disabled="webdavSyncing"
        :class="{ 'op-50 cursor-not-allowed': webdavSyncing }"
        @click="webdavUpload"
      >
        <div :class="webdavAction === 'upload' ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-cloud-upload'" />
        上传到 WebDAV
      </button>
      <button
        flex="~ items-center gap-2" px-4 py-2 rounded-lg text-sm font-medium
        border="~ base" cursor-pointer transition-colors duration-200
        hover:bg-gray-100 dark:hover:bg-gray-900
        :disabled="webdavSyncing"
        :class="{ 'op-50 cursor-not-allowed': webdavSyncing }"
        @click="webdavDownload"
      >
        <div :class="webdavAction === 'download' ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-cloud-download'" />
        从 WebDAV 下载
      </button>
    </div>

    <!-- 进度条 -->
    <div v-if="webdavSyncing && webdavProgress.step" mt-4>
      <div flex="~ items-center justify-between" mb-1.5 text-sm op-70>
        <span>{{ webdavProgress.step }}</span>
        <span v-if="webdavProgress.total > 0">{{ webdavProgress.current }} / {{ webdavProgress.total }}</span>
      </div>
      <div w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden>
        <div
          h-full rounded-full bg-teal-500 transition-all duration-300
          :style="{ width: webdavProgress.total > 0 ? `${Math.round(webdavProgress.current / webdavProgress.total * 100)}%` : '100%' }"
        />
      </div>
    </div>

    <div v-if="webdavStatus" mt-3 text-sm :class="webdavStatus.includes('失败') ? 'text-red-400' : 'text-teal-600 dark:text-teal-400'">
      {{ webdavStatus }}
    </div>
  </div>

  <!-- Prompt 配置 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div flex="~ items-center gap-2" mb-5>
      <div w-1 h-6 rounded-full class="bg-orange-500" />
      <h2 text-lg font-semibold>
        Prompt 配置
      </h2>
    </div>

    <div mb-5>
      <span label ml-0.5>
        简洁模式 Prompt
        <a
          ml-1 underline cursor-pointer op-60 hover:op-100 transition-opacity
          @click.prevent="getDefaultPrompt(0)"
        >获取默认</a>
        <a
          ml-2 underline cursor-pointer op-60 hover:op-100 transition-opacity
          @click.prevent="clearPrompt(0)"
        >清空</a>
      </span>
      <Textarea v-model="concisePrompt" placeholder="留空将使用默认配置......" />
    </div>

    <div mb-5>
      <span label ml-0.5>
        详细模式 Prompt
        <a
          ml-1 underline cursor-pointer op-60 hover:op-100 transition-opacity
          @click.prevent="getDefaultPrompt(1)"
        >获取默认</a>
        <a
          ml-2 underline cursor-pointer op-60 hover:op-100 transition-opacity
          @click.prevent="clearPrompt(1)"
        >清空</a>
      </span>
      <Textarea v-model="detailedPrompt" placeholder="留空将使用默认配置......" />
    </div>

    <div mb-5>
      <span label ml-0.5>
        小说模式 Prompt
        <a
          ml-1 underline cursor-pointer op-60 hover:op-100 transition-opacity
          @click.prevent="getDefaultPrompt(2)"
        >获取默认</a>
        <a
          ml-2 underline cursor-pointer op-60 hover:op-100 transition-opacity
          @click.prevent="clearPrompt(2)"
        >清空</a>
      </span>
      <Textarea v-model="novelPrompt" placeholder="留空将使用默认配置......" />
    </div>

    <div>
      <span label ml-0.5>
        自定义模式 Prompt
      </span>
      <Textarea v-model="customPrompts" placeholder="也许你需要第四个 prompt ，留空将不启用......" />
    </div>
  </div>

  <!-- 设置管理 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div flex="~ items-center gap-2" mb-5>
      <div w-1 h-6 rounded-full bg-gray-400 />
      <h2 text-lg font-semibold>
        设置管理
      </h2>
    </div>

    <div flex="~ gap-3 wrap">
      <button
        flex="~ items-center gap-2" px-4 py-2 rounded-lg text-sm font-medium
        border="~ base" cursor-pointer transition-colors duration-200
        hover:bg-gray-100 dark:hover:bg-gray-900
        @click="onImportSettingsClick"
      >
        <div i-carbon-upload />
        导入设置
      </button>
      <button
        flex="~ items-center gap-2" px-4 py-2 rounded-lg text-sm font-medium
        border="~ base" cursor-pointer transition-colors duration-200
        hover:bg-gray-100 dark:hover:bg-gray-900
        @click="onExportSettings"
      >
        <div i-carbon-download />
        导出设置
      </button>
    </div>

    <input
      ref="settingsFileInputRef"
      type="file"
      accept=".json"
      hidden
      @change="onImportSettingsFile"
    >
  </div>
</template>

<style scoped>
.sortable-ghost {
  opacity: 0.4;
  background: var(--c-bg);
}
</style>

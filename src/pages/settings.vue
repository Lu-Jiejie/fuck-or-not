<script setup lang="ts">
import type { AIProvider, ModelOption } from '~/types'
import { useStorage } from '@vueuse/core'
import { nextTick, ref } from 'vue'
import Button from '~/components/Button.vue'
import Input from '~/components/Input.vue'
import Select from '~/components/Select.vue'
import Textarea from '~/components/Textarea.vue'
import { addModel, chatgptApiKey, chatgptApiUrl, geminiApiUrl, grokApiKey, grokApiUrl, modelOptions, removeModel, resetModelOptions, updateModel } from '~/logic'
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

const providerOptions = [
  { label: 'Gemini', value: 'Gemini' },
  { label: 'Grok', value: 'Grok' },
  { label: 'ChatGPT', value: 'ChatGPT' },
]

function startAdding() {
  isAdding.value = true
  newModelId.value = ''
  newModelProvider.value = 'Gemini'
  nextTick(() => {
    addingInputRef.value?.focus()
  })
}

function cancelAdding() {
  isAdding.value = false
  newModelId.value = ''
  newModelProvider.value = 'Gemini'
}

function saveAdding() {
  if (!newModelId.value.trim()) {
    alert('请填写模型 ID')
    return
  }
  addModel({ id: newModelId.value.trim(), provider: newModelProvider.value })
  cancelAdding()
}

function handleRemoveModel(index: number) {
  if (confirm('确定要删除这个模型吗？')) {
    removeModel(index)
  }
}

function startEditing(index: number, model: ModelOption) {
  editingIndex.value = index
  editingModelId.value = model.id
  editingProvider.value = model.provider
  nextTick(() => {
    editingInputRef.value[0]?.focus()
  })
}

function cancelEditing() {
  editingIndex.value = null
  editingModelId.value = ''
  editingProvider.value = 'Gemini'
}

function saveEditing(index: number) {
  if (!editingModelId.value.trim()) {
    alert('请填写模型 ID')
    return
  }
  updateModel(index, { id: editingModelId.value.trim(), provider: editingProvider.value })
  cancelEditing()
}

function handleResetModels() {
  if (confirm('确定要重置为默认模型列表吗？这将丢失所有自定义修改。')) {
    resetModelOptions()
  }
}

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
    modelOptions: modelOptions.value,
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
      if (Array.isArray(data.modelOptions))
        modelOptions.value = data.modelOptions
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

function getProviderLabel(provider: AIProvider): string {
  return providerOptions.find(p => p.value === provider)?.label || provider
}
</script>

<template>
  <h1 text-3xl font-bold>
    设置
  </h1>

  <!-- Gemini 配置 -->
  <div py-6>
    <h2 text-2xl font-semibold mb-1 text-teal-600>
      Gemini 配置
    </h2>

    <div py-2>
      <span label ml-0.5>
        Gemini API 秘钥
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          ml-1 underline cursor-pointer op-70
        >此处获取</a>
      </span>
      <Input v-model="googleApiKey" type="password" />
    </div>

    <div py-3>
      <span label ml-0.5>
        Gemini API 地址
        <span ml-1 text-sm op-70>(留空使用默认地址)</span>
      </span>
      <Input
        v-model="geminiApiUrl"
        type="text"
        placeholder="https://generativelanguage.googleapis.com"
      />
    </div>
  </div>

  <!-- Grok 配置 -->
  <div py-6>
    <h2 text-2xl font-semibold mb-1 text-purple-600>
      Grok 配置
    </h2>

    <div py-2>
      <span label ml-0.5>
        Grok API 秘钥
        <a
          href="https://console.x.ai/"
          target="_blank"
          ml-1 underline cursor-pointer op-70
        >此处获取</a>
      </span>
      <Input v-model="grokApiKey" type="password" />
    </div>

    <div py-3>
      <span label ml-0.5>
        Grok API 地址
        <span ml-1 text-sm op-70>(留空使用默认地址)</span>
      </span>
      <Input
        v-model="grokApiUrl"
        type="text"
        placeholder="https://api.x.ai"
      />
    </div>
  </div>

  <!-- ChatGPT 配置 -->
  <div py-6>
    <h2 text-2xl font-semibold mb-1 text-green-600>
      ChatGPT 配置
    </h2>

    <div py-2>
      <span label ml-0.5>
        ChatGPT API 秘钥
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          ml-1 underline cursor-pointer op-70
        >此处获取</a>
      </span>
      <Input v-model="chatgptApiKey" type="password" />
    </div>

    <div py-3>
      <span label ml-0.5>
        ChatGPT API 地址
        <span ml-1 text-sm op-70>(留空使用默认地址)</span>
      </span>
      <Input
        v-model="chatgptApiUrl"
        type="text"
        placeholder="https://api.openai.com"
      />
    </div>
  </div>

  <!-- 模型配置 -->
  <div py-6>
    <h2 text-2xl font-semibold mb-1>
      模型列表
    </h2>

    <span label ml-0.5>
      自定义模型
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
            v-model="editingModelId"
            type="text"
            placeholder="模型 ID"
            font-mono text-sm flex-1 min-w-0
            p="x-2 y-1"
            bg="transparent"
            border="~ rounded base focus:teal-600"
            outline="none"
            class="h-8"
          >
          <Select v-model="editingProvider" :options="providerOptions" class="w-28" />
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
          <div flex-1 min-w-0 flex="~ items-center gap-2">
            <span font-mono text-sm truncate flex-1 class="leading-8">{{ model.id }}</span>
            <span text-xs op-70 class="w-16 text-right">{{ getProviderLabel(model.provider) }}</span>
          </div>
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
            v-model="newModelId"
            type="text"
            placeholder="模型 ID（如 gemini-2.5-flash）"
            font-mono text-sm flex-1 min-w-0
            p="x-2 y-1"
            bg="transparent"
            border="~ rounded base focus:teal-600"
            outline="none"
            class="h-8"
          >
          <Select v-model="newModelProvider" :options="providerOptions" class="w-28" />
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
  </div>

  <!-- Prompt 配置 -->
  <div py-6>
    <h2 text-2xl font-semibold mb-1>
      Prompt 配置
    </h2>

    <div py-2>
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
    </div>

    <div py-4>
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
    </div>

    <div py-4>
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
    </div>

    <div py-4>
      <span label ml-0.5>
        自定义模式 Prompt
      </span>
      <Textarea v-model="customPrompts" placeholder="也许你需要第四个 prompt ，留空将不启用......" />
    </div>
  </div>

  <!-- 设置管理 -->
  <div py-6>
    <h2 text-2xl font-semibold mb-3>
      设置管理
    </h2>

    <div flex="~ gap-4 wrap">
      <Button @click="onImportSettingsClick">
        导入设置
      </Button>
      <Button @click="onExportSettings">
        导出设置
      </Button>
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

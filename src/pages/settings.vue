<script setup lang="ts">
import type { AIProvider, ModelOption } from '~/types'
import { useStorage } from '@vueuse/core'
import { nextTick, ref } from 'vue'
import Input from '~/components/Input.vue'
import Select from '~/components/Select.vue'
import Textarea from '~/components/Textarea.vue'
import { webdavDownload, webdavPassword, webdavStatus, webdavSyncing, webdavUpload, webdavUrl, webdavUsername } from '~/composables/useWebDAV'
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
  if (confirm('确定要删除该模型吗？')) {
    removeModel(index)
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

    <div>
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

    <div>
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

    <div>
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
  </div>

  <!-- 模型列表 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div flex="~ items-center justify-between" mb-5>
      <div flex="~ items-center gap-2">
        <div w-1 h-6 rounded-full bg-gray-400 />
        <h2 text-lg font-semibold>
          模型列表
        </h2>
      </div>
      <button
        text-sm op-60 hover:op-100 underline cursor-pointer transition-opacity
        @click="handleResetModels"
      >
        重置为默认
      </button>
    </div>

    <div rounded-lg border="~ base" overflow-hidden>
      <div
        v-for="(model, index) in modelOptions"
        :key="index"
        px-4 py-2.5 flex="~ items-center gap-2"
        border="b base"
        class="last:border-b-0"
      >
        <template v-if="editingIndex === index">
          <div flex="~ col gap-2" w-full>
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
            <div flex="~ items-center gap-2">
              <Select v-model="editingProvider" :options="providerOptions" type="inline" flex-1 />
              <div flex="~ gap-1 items-center">
                <button
                  p-2 rounded cursor-pointer text-white transition-colors duration-200
                  class="bg-teal-600 hover:bg-teal-700 h-8 w-8"
                  flex items-center justify-center
                  title="保存"
                  @click="saveEditing(index)"
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
            </div>
          </div>
        </template>
        <template v-else>
          <div flex-1 min-w-0 flex="~ items-center gap-2">
            <span font-mono text-sm truncate flex-1 class="leading-8">{{ model.id }}</span>
            <span
              text-xs px-2 py-0.5 rounded-full font-medium
              :class="{
                'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300': model.provider === 'Gemini',
                'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300': model.provider === 'Grok',
                'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300': model.provider === 'ChatGPT',
              }"
            >
              {{ model.provider }}
            </span>
          </div>
          <div flex="~ gap-1 items-center">
            <button
              p-2 rounded cursor-pointer text-white transition-colors duration-200
              class="bg-teal-600 hover:bg-teal-700 h-8 w-8"
              flex items-center justify-center
              title="编辑"
              @click="startEditing(index, model)"
            >
              <div i-carbon-edit />
            </button>
            <button
              p-2 rounded cursor-pointer text-white transition-colors duration-200
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
      <div px-4 py-2.5 flex="~ items-center gap-2">
        <template v-if="isAdding">
          <div flex="~ col gap-2" w-full>
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
            <div flex="~ items-center gap-2">
              <Select v-model="newModelProvider" :options="providerOptions" type="inline" flex-1 />
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
            </div>
          </div>
        </template>
        <template v-else>
          <button
            flex="~ items-center gap-1.5" text-sm op-60 hover:op-100
            cursor-pointer transition-opacity
            @click="startAdding"
          >
            <div i-carbon-add />
            添加模型
          </button>
        </template>
      </div>
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

  <!-- WebDAV 同步 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div flex="~ items-center gap-2" mb-5>
      <div w-1 h-6 rounded-full class="bg-blue-500" />
      <h2 text-lg font-semibold>
        WebDAV 同步
      </h2>
    </div>

    <div mb-4>
      <span label ml-0.5>
        WebDAV 地址
        <span ml-1 text-xs op-50>(如 https://dav.example.com/dav/)</span>
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
        <div :class="webdavSyncing ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-cloud-upload'" />
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
        <div :class="webdavSyncing ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-cloud-download'" />
        从 WebDAV 下载
      </button>
      <span v-if="webdavStatus" text-sm :class="webdavStatus.includes('失败') ? 'text-red-500' : 'text-green-500'">
        {{ webdavStatus }}
      </span>
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

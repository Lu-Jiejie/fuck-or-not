<script setup lang="ts">
import type { AIProvider } from '~/types'
import { useStorage } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import JSZip from 'jszip'
import Sortable from 'sortablejs'
import { nextTick, onMounted, ref } from 'vue'
import Input from '~/components/Input.vue'
import Textarea from '~/components/Textarea.vue'
import { webdavAction, webdavDownload, webdavPassword, webdavProgress, webdavStatus, webdavSyncing, webdavUpload, webdavUrl, webdavUsername } from '~/composables/useWebDAV'
import { addPrompt, addProviderModel, chatgptApiKey, chatgptApiUrl, chatgptModels, customPrompts, geminiApiUrl, geminiModels, grokApiKey, grokApiUrl, grokModels, removePrompt, removeProviderModel, resetPrompts, resetProviderModels, updatePrompt, updateProviderModel } from '~/logic'

const googleApiKey = useStorage('google-api-key', '')

// 用于访问 IndexedDB 中的图片和收藏结果
const imageStore = useIDBKeyval<Record<string, string>>('favorite-images', {})
const favoriteResults = useIDBKeyval('favorite-results', [] as any[])

// Prompt 编辑状态
const editingPromptId = ref<string | null>(null)
const editingPromptName = ref('')
const editingPromptContent = ref('')
const isAddingPrompt = ref(false)
const newPromptName = ref('')
const newPromptContent = ref('')
const promptInputRef = ref<HTMLInputElement[]>([])
const addingPromptInputRef = ref<HTMLInputElement | null>(null)

function startEditingPrompt(id: string, name: string, content: string) {
  cancelAddingPrompt()
  editingPromptId.value = id
  editingPromptName.value = name
  editingPromptContent.value = content
  nextTick(() => {
    promptInputRef.value[0]?.focus()
  })
}

function cancelEditingPrompt() {
  editingPromptId.value = null
  editingPromptName.value = ''
  editingPromptContent.value = ''
}

function saveEditingPrompt() {
  if (!editingPromptName.value.trim()) {
    alert('请填写 Prompt 名称')
    return
  }
  if (editingPromptId.value) {
    updatePrompt(editingPromptId.value, {
      name: editingPromptName.value.trim(),
      content: editingPromptContent.value,
    })
  }
  cancelEditingPrompt()
}

function startAddingPrompt() {
  cancelEditingPrompt()
  isAddingPrompt.value = true
  newPromptName.value = ''
  newPromptContent.value = ''
  nextTick(() => {
    addingPromptInputRef.value?.focus()
  })
}

function cancelAddingPrompt() {
  isAddingPrompt.value = false
  newPromptName.value = ''
  newPromptContent.value = ''
}

function saveAddingPrompt() {
  if (!newPromptName.value.trim()) {
    alert('请填写 Prompt 名称')
    return
  }
  addPrompt(newPromptName.value.trim(), newPromptContent.value)
  cancelAddingPrompt()
}

function handleRemovePrompt(id: string) {
  if (customPrompts.value.length <= 1) {
    alert('至少需要保留一个 Prompt')
    return
  }
  if (confirm('确定要删除这个 Prompt 吗？')) {
    removePrompt(id)
  }
}

function handleResetPrompts() {
  if (confirm('确定要重置为默认 Prompt 列表吗？这将丢失所有自定义修改。')) {
    resetPrompts()
  }
}

// Prompt 列表拖拽排序
const promptListRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (promptListRef.value) {
    Sortable.create(promptListRef.value, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      onEnd({ oldIndex, newIndex }) {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex)
          return
        const list = [...customPrompts.value]
        const [item] = list.splice(oldIndex, 1)
        list.splice(newIndex, 0, item)
        customPrompts.value = list
      },
    })
  }
})

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

const settingsFileInputRef = ref<HTMLInputElement | null>(null)

async function onExportSettings() {
  if (!confirm('确定要导出当前设置吗？')) {
    return
  }

  try {
    // 创建 JSZip 实例
    const zip = new JSZip()

    // 准备配置数据
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
      customPrompts: customPrompts.value,
    }

    // 添加配置文件
    zip.file('settings.json', JSON.stringify(settings, null, 2))

    // 添加收藏结果数据
    if (favoriteResults.data.value && favoriteResults.data.value.length > 0) {
      zip.file('favorites.json', JSON.stringify(favoriteResults.data.value, null, 2))
    }

    // 导出所有图片
    const images = imageStore.data.value
    if (images && Object.keys(images).length > 0) {
      const imagesFolder = zip.folder('images')

      for (const [key, value] of Object.entries(images)) {
        // 跳过 mime type 条目
        if (key.endsWith(':mime'))
          continue

        const base64Data = value
        const mimeType = images[`${key}:mime`] || 'image/png'
        const extension = mimeType.split('/')[1] || 'png'

        // 将 base64 转换为 Blob
        const byteCharacters = atob(base64Data)
        const byteNumbers = Array.from({ length: byteCharacters.length })
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers as number[])

        // 添加图片文件到 zip
        imagesFolder?.file(`${key}.${extension}`, byteArray)
      }
    }

    // 生成 zip 文件
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fuck-or-not-backup-${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(url)

    alert('设置和图片已导出为 ZIP 文件')
  }
  catch (error) {
    console.error('[Export Error]', error)
    alert(`导出失败：${(error as Error).message}`)
  }
}

function onImportSettingsClick() {
  if (!confirm('导入设置将覆盖当前所有设置，确定要继续吗？')) {
    return
  }
  settingsFileInputRef.value?.click()
}

async function onImportSettingsFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  try {
    // 检查文件类型
    if (file.name.endsWith('.zip')) {
      // 处理 zip 文件
      const zip = new JSZip()
      const zipContent = await zip.loadAsync(file)

      // 读取配置文件
      const settingsFile = zipContent.file('settings.json')
      if (settingsFile) {
        const settingsText = await settingsFile.async('text')
        const data = JSON.parse(settingsText)
        await importSettings(data)
      }

      // 读取图片（必须在读取收藏结果之前）
      const imagesFolder = zipContent.folder('images')
      if (imagesFolder) {
        const imageFiles = Object.keys(zipContent.files).filter(name => name.startsWith('images/') && !name.endsWith('/'))
        const newImages: Record<string, string> = {}

        console.log('[Import] Found image files:', imageFiles)

        for (const fileName of imageFiles) {
          const file = zipContent.file(fileName)
          if (file) {
            // 提取文件名和扩展名
            const baseName = fileName.split('/').pop() || ''
            const dotIndex = baseName.lastIndexOf('.')
            const nameWithoutExt = dotIndex > 0 ? baseName.substring(0, dotIndex) : baseName
            const extension = dotIndex > 0 ? baseName.substring(dotIndex + 1) : 'png'

            // 读取图片数据
            const blob = await file.async('blob')
            const base64 = await blobToBase64(blob)

            // 存储图片和 mime type，使用原始哈希值作为键名
            console.log('[Import] Importing image:', nameWithoutExt, `(${extension})`)
            newImages[nameWithoutExt] = base64
            newImages[`${nameWithoutExt}:mime`] = `image/${extension}`
          }
        }

        console.log('[Import] Total images imported:', Object.keys(newImages).filter(k => !k.endsWith(':mime')).length)

        // 合并到现有图片存储（不覆盖已存在的）
        imageStore.data.value = { ...newImages, ...imageStore.data.value }

        console.log('[Import] ImageStore keys after merge:', Object.keys(imageStore.data.value).filter(k => !k.endsWith(':mime')))
      }

      // 读取收藏结果（必须在图片导入之后）
      const favoritesFile = zipContent.file('favorites.json')
      if (favoritesFile) {
        const favoritesText = await favoritesFile.async('text')
        const favoritesData = JSON.parse(favoritesText)
        if (Array.isArray(favoritesData)) {
          console.log('[Import] Importing favorites, total:', favoritesData.length)

          // 检查每个收藏记录的 imageHash
          for (const fav of favoritesData) {
            const hasImage = imageStore.data.value[fav.imageHash] !== undefined
            console.log(`[Import] Favorite ${fav.time}: imageHash=${fav.imageHash}, hasImage=${hasImage}`)
            if (!hasImage) {
              console.warn('[Import] Missing image for hash:', fav.imageHash)
            }
          }

          favoriteResults.data.value = favoritesData
          console.log('[Import] Favorites imported successfully')
        }
      }

      alert('设置和图片导入成功')
    }
    else {
      // 处理 JSON 文件（兼容旧格式）
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result as string)
          await importSettings(data)
          alert('设置导入成功')
        }
        catch {
          alert('导入失败：文件解析错误')
        }
      }
      reader.readAsText(file)
    }
  }
  catch (error) {
    console.error('[Import Error]', error)
    alert(`导入失败：${(error as Error).message}`)
  }

  input.value = ''

  // 等待一下让 IndexedDB 完成写入，然后刷新页面以确保数据正确加载
  setTimeout(() => {
    window.location.reload()
  }, 500)
}

// 辅助函数：将 Blob 转换为 base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // 移除 data URL 前缀
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      else {
        reject(new Error('Failed to read blob'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// 导入设置的通用函数
async function importSettings(data: any) {
  if (typeof data !== 'object' || data === null) {
    throw new Error('文件格式不正确')
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

  // 导入 Prompt 配置
  if (Array.isArray(data.customPrompts) && data.customPrompts.length > 0) {
    // 新格式：直接是 CustomPrompt 数组
    customPrompts.value = data.customPrompts
  }
  else {
    // 兼容旧格式：单个 prompt 字符串
    const migrated = []
    if (data.concisePrompt !== undefined && data.concisePrompt !== '') {
      migrated.push({ id: 'concise', name: '简洁', content: data.concisePrompt })
    }
    if (data.detailedPrompt !== undefined && data.detailedPrompt !== '') {
      migrated.push({ id: 'detailed', name: '详细', content: data.detailedPrompt })
    }
    if (data.novelPrompt !== undefined && data.novelPrompt !== '') {
      migrated.push({ id: 'novel', name: '小说', content: data.novelPrompt })
    }
    if (data.customPrompts !== undefined && data.customPrompts !== '') {
      migrated.push({ id: 'custom', name: '自定义', content: data.customPrompts })
    }
    if (migrated.length > 0) {
      customPrompts.value = migrated
    }
  }
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
      <div rounded-lg border="~ base" overflow-hidden>
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
      <div rounded-lg border="~ base" overflow-hidden>
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
      <div rounded-lg border="~ base" overflow-hidden>
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

  <!-- Prompt 配置 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div flex="~ items-center justify-between" mb-5>
      <div flex="~ items-center gap-2">
        <div w-1 h-6 rounded-full class="bg-orange-500" />
        <h2 text-lg font-semibold>
          Prompt 配置
        </h2>
      </div>
      <button
        text-sm op-60 hover:op-100 underline cursor-pointer transition-opacity
        @click="handleResetPrompts"
      >
        重置为默认
      </button>
    </div>

    <div ref="promptListRef" rounded-lg border="~ base" overflow-hidden>
      <div
        v-for="prompt in customPrompts"
        :key="prompt.id"
        px-4 py-3 flex="~ col gap-3"
        border="b base"
        class="last:border-b-0"
      >
        <template v-if="editingPromptId === prompt.id">
          <div flex="~ col gap-2" w-full>
            <input
              ref="promptInputRef"
              v-model="editingPromptName"
              type="text"
              placeholder="Prompt 名称"
              text-sm w-full
              p="x-2 y-1"
              bg="transparent"
              border="~ rounded base focus:orange-600"
              outline="none"
              class="h-8"
            >
            <Textarea v-model="editingPromptContent" placeholder="Prompt 内容" />
            <div flex="~ gap-1 items-center justify-end">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-orange-600 hover:bg-orange-700 h-8 w-8"
                flex items-center justify-center
                title="保存"
                @click="saveEditingPrompt"
              >
                <div i-carbon-checkmark />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-gray-500 hover:bg-gray-600 h-8 w-8"
                flex items-center justify-center
                title="取消"
                @click="cancelEditingPrompt"
              >
                <div i-carbon-close />
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <div flex="~ items-center justify-between">
            <div flex="~ items-center gap-2" flex-1>
              <div class="drag-handle" i-carbon-draggable op-30 hover:op-70 cursor-grab active:cursor-grabbing flex-shrink-0 />
              <span font-semibold text-base>{{ prompt.name }}</span>
            </div>
            <div flex="~ gap-1 items-center">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-orange-600 hover:bg-orange-700 h-8 w-8"
                flex items-center justify-center
                title="编辑"
                @click="startEditingPrompt(prompt.id, prompt.name, prompt.content)"
              >
                <div i-carbon-edit />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-red-400 hover:bg-red-500 h-8 w-8"
                flex items-center justify-center
                title="删除"
                @click="handleRemovePrompt(prompt.id)"
              >
                <div i-carbon-trash-can />
              </button>
            </div>
          </div>
          <div
            v-if="prompt.content"
            text-sm op-70 whitespace-pre-wrap
            class="line-clamp-3"
          >
            {{ prompt.content }}
          </div>
          <div v-else text-sm op-50 italic>
            暂无内容
          </div>
        </template>
      </div>

      <!-- 添加新 Prompt 行 -->
      <div px-4 py-3 flex="~ items-center gap-2">
        <template v-if="isAddingPrompt">
          <div flex="~ col gap-2" w-full>
            <input
              ref="addingPromptInputRef"
              v-model="newPromptName"
              type="text"
              placeholder="Prompt 名称（如：情节续写）"
              text-sm w-full
              p="x-2 y-1"
              bg="transparent"
              border="~ rounded base focus:orange-600"
              outline="none"
              class="h-8"
            >
            <Textarea v-model="newPromptContent" placeholder="Prompt 内容（可选）" />
            <div flex="~ gap-1 items-center justify-end">
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-orange-600 hover:bg-orange-700 h-8 w-8"
                flex items-center justify-center
                title="保存"
                @click="saveAddingPrompt"
              >
                <div i-carbon-checkmark />
              </button>
              <button
                p-2 rounded cursor-pointer text-white transition-colors duration-200
                class="bg-gray-500 hover:bg-gray-600 h-8 w-8"
                flex items-center justify-center
                title="取消"
                @click="cancelAddingPrompt"
              >
                <div i-carbon-close />
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <button
            flex="~ items-center gap-1.5" text-sm op-60 hover:op-100
            cursor-pointer transition-opacity
            @click="startAddingPrompt"
          >
            <div i-carbon-add />
            添加 Prompt
          </button>
        </template>
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

  <!-- 设置管理 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div flex="~ items-center gap-2" mb-2>
      <div w-1 h-6 rounded-full bg-gray-400 />
      <h2 text-lg font-semibold>
        设置管理
      </h2>
    </div>
    <p text-sm op-50 mb-5>
      包含所有配置、收藏和图片
    </p>

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
      accept=".json,.zip"
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

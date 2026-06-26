<script setup lang="ts">
import type { ProviderConfig } from '~/types'
import JSZip from 'jszip'
import Sortable from 'sortablejs'
import { nextTick, onMounted, ref, watch } from 'vue'
import Input from '~/components/Input.vue'
import Textarea from '~/components/Textarea.vue'
import { webdavAction, webdavDownload, webdavPassword, webdavProgress, webdavProgressPhase, webdavStatus, webdavSyncing, webdavUpload, webdavUrl, webdavUsername } from '~/composables/useWebDAV'
import { additionalPromptPresets, addPrompt, customPrompts, favoriteResults, fetchModelsFromAPI, imageStore, providers, removePrompt, resetPrompts, updatePrompt } from '~/logic'

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
const providerListRef = ref<HTMLElement | null>(null)

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
  if (providerListRef.value) {
    Sortable.create(providerListRef.value, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      onEnd({ oldIndex, newIndex }) {
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex)
          return
        const list = [...providers.value]
        const [item] = list.splice(oldIndex, 1)
        list.splice(newIndex, 0, item)
        providers.value = list
      },
    })
  }
})

// ─── 供应商管理 ───
const editingProviderId = ref<string | null>(null)
const editingProviderForm = ref<ProviderConfig>({ id: '', name: '', type: 'openai', apiUrl: '', apiKey: '', models: [] })
const isAddingProvider = ref(false)
const newProviderForm = ref<ProviderConfig>({ id: '', name: '', type: 'openai', apiUrl: '', apiKey: '', models: [] })
const fetchingModelList = ref(false)
const availableModelList = ref<string[]>([])

function genId() {
  return `prov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function startAddProvider() {
  cancelEditProvider()
  isAddingProvider.value = true
  newProviderForm.value = { id: genId(), name: '', type: 'openai', apiUrl: '', apiKey: '', models: [] }
}

function cancelAddProvider() {
  isAddingProvider.value = false
  newProviderForm.value = { id: '', name: '', type: 'openai', apiUrl: '', apiKey: '', models: [] }
}

function confirmAddProvider() {
  const form = newProviderForm.value
  if (!form.name.trim()) { alert('请输入供应商名称'); return }
  if (!form.apiKey.trim()) { alert('请输入 API 密钥'); return }
  providers.value.push({ ...form })
  cancelAddProvider()
}

function startEditProvider(id: string) {
  cancelAddProvider()
  const p = providers.value.find(x => x.id === id)
  if (!p)
    return
  editingProviderId.value = id
  editingProviderForm.value = { ...p }
}

function cancelEditProvider() {
  editingProviderId.value = null
}

function confirmEditProvider() {
  const form = editingProviderForm.value
  if (!form.name.trim()) { alert('请输入供应商名称'); return }
  if (!form.apiKey.trim()) { alert('请输入 API 密钥'); return }
  const idx = providers.value.findIndex(p => p.id === editingProviderId.value)
  if (idx !== -1)
    providers.value[idx] = { ...form }
  cancelEditProvider()
}

function removeProvider(id: string) {
  const p = providers.value.find(x => x.id === id)
  if (!p || !confirm(`确定要删除供应商「${p.name}」吗？`))
    return
  providers.value = providers.value.filter(x => x.id !== id)
  cancelEditProvider()
}

// 模型管理（单个供应商内部）
function addModelToProvider(providerId: string, modelId: string) {
  const p = providers.value.find(x => x.id === providerId)
  if (!p)
    return
  if (!p.models.includes(modelId)) {
    p.models = [...p.models, modelId]
  }
}

async function handleFetchModels(providerId: string) {
  const p = providers.value.find(x => x.id === providerId)
  if (!p)
    return
  fetchingModelList.value = true
  try {
    const models = await fetchModelsFromAPI(p)
    if (models.length === 0) { alert('未找到可用的模型'); return }
    const newModels = models.filter(m => !p.models.includes(m))
    availableModelList.value = newModels
    if (newModels.length === 0)
      alert('所有模型已存在')
  }
  catch (e) {
    alert(`获取模型列表失败：${(e as Error).message}`)
  }
  finally {
    fetchingModelList.value = false
  }
}

// 为新增供应商表单获取模型（尚未保存到 providers）
const fetchingModelListForNew = ref(false)
const availableModelListForNew = ref<string[]>([])

async function handleFetchModelsForNew() {
  const form = newProviderForm.value
  if (!form.apiKey.trim()) { alert('请先填写 API 密钥'); return }
  fetchingModelListForNew.value = true
  try {
    const models = await fetchModelsFromAPI(form)
    if (models.length === 0) { alert('未找到可用的模型'); return }
    const newModels = models.filter(m => !form.models.includes(m))
    availableModelListForNew.value = newModels
    if (newModels.length === 0)
      alert('所有模型已存在')
  }
  catch (e) {
    alert(`获取模型列表失败：${(e as Error).message}`)
  }
  finally {
    fetchingModelListForNew.value = false
  }
}

function addSelectedModel(providerId: string, modelId: string) {
  if (!modelId)
    return
  addModelToProvider(providerId, modelId)
  availableModelList.value = availableModelList.value.filter(m => m !== modelId)
}

const settingsFileInputRef = ref<HTMLInputElement | null>(null)

const importExportProgress = ref({ step: '', current: 0, total: 0 })
const importExportStatus = ref('')
const isImportExporting = ref(false)

async function onExportSettings() {
  if (!confirm('确定要导出当前设置吗？')) {
    return
  }

  isImportExporting.value = true
  importExportProgress.value = { step: '', current: 0, total: 0 }
  importExportStatus.value = ''

  try {
    // 用 setTimeout(0) 代替 nextTick — 宏任务才能给浏览器绘制窗口
    const yield_ = () => new Promise<void>(r => setTimeout(r, 0))

    // 准备配置
    importExportProgress.value = { step: '准备配置数据...', current: 0, total: 0 }
    await yield_()
    const zip = new JSZip()

    const settings = {
      providers: providers.value,
      customPrompts: customPrompts.value,
      additionalPromptPresets: additionalPromptPresets.value,
    }

    zip.file('settings.json', JSON.stringify(settings, null, 2))

    if (favoriteResults.data.value && favoriteResults.data.value.length > 0) {
      zip.file('favorites.json', JSON.stringify(favoriteResults.data.value, null, 2))
    }

    // 导出图片 — 每张都更新进度，每 3 张让出主线程
    const images = imageStore.data.value
    if (images && Object.keys(images).length > 0) {
      const imagesFolder = zip.folder('images')
      const imageKeys = Object.keys(images).filter(k => !k.endsWith(':mime'))
      const totalImages = imageKeys.length
      let processed = 0

      for (const key of imageKeys) {
        processed++
        importExportProgress.value = { step: '导出图片...', current: processed, total: totalImages }
        // 每 3 张 yield 一次，让浏览器绘制进度条
        if (processed % 3 === 0)
          await yield_()

        const base64Data = images[key]
        const mimeType = images[`${key}:mime`] || 'image/png'
        const extension = mimeType.split('/')[1] || 'png'

        const byteCharacters = atob(base64Data)
        const byteNumbers = Array.from({ length: byteCharacters.length })
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers as number[])

        imagesFolder?.file(`${key}.${extension}`, byteArray)
      }
    }

    // 生成 zip
    importExportProgress.value = { step: '生成 ZIP 文件...', current: 0, total: 0 }
    await yield_()
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fuck-or-not-backup-${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(url)

    importExportStatus.value = '导出成功'
    importExportProgress.value = { step: '', current: 0, total: 0 }
  }
  catch (error) {
    console.error('[Export Error]', error)
    importExportStatus.value = `导出失败：${(error as Error).message}`
    importExportProgress.value = { step: '', current: 0, total: 0 }
  }
  finally {
    isImportExporting.value = false
  }
}

function onImportSettingsClick() {
  if (!confirm('导入设置将覆盖当前所有设置，确定要继续吗？')) {
    return
  }
  settingsFileInputRef.value?.click()
}

/** 等待 useIDBKeyval 初始化完成，防止异步读取覆盖刚写入的数据 */
async function waitForTrue(ref: { value: boolean }): Promise<void> {
  if (ref.value)
    return
  return new Promise((resolve) => {
    const stop = watch(ref, (val) => {
      if (val) {
        stop()
        resolve()
      }
    }, { flush: 'sync' })
  })
}

async function onImportSettingsFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  isImportExporting.value = true
  importExportProgress.value = { step: '', current: 0, total: 0 }
  importExportStatus.value = ''

  try {
    // 检查文件类型
    if (file.name.endsWith('.zip')) {
      // 处理 zip 文件
      importExportProgress.value = { step: '正在读取文件...', current: 0, total: 0 }
      await nextTick()
      const zip = new JSZip()
      const zipContent = await zip.loadAsync(file)

      // 读取配置文件
      importExportProgress.value = { step: '导入设置...', current: 0, total: 0 }
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
        const totalImages = imageFiles.length
        let processed = 0

        console.log('[Import] Found image files:', imageFiles)

        for (const fileName of imageFiles) {
          processed++
          importExportProgress.value = { step: '导入图片...', current: processed, total: totalImages }

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

        // 等待 useIDBKeyval 初始化完成，防止竞态覆盖
        await waitForTrue(imageStore.isFinished)

        // 用 set() 确保 IndexedDB 写入完成，防止刷新丢失数据
        await imageStore.set({ ...newImages, ...imageStore.data.value })

        console.log('[Import] ImageStore keys after merge:', Object.keys(imageStore.data.value).filter(k => !k.endsWith(':mime')))
      }

      // 读取收藏结果（必须在图片导入之后）
      importExportProgress.value = { step: '导入收藏数据...', current: 0, total: 0 }
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

          // 等待 useIDBKeyval 初始化完成，防止竞态覆盖
          await waitForTrue(favoriteResults.isFinished)

          // 用 set() 确保 IndexedDB 写入完成，防止刷新丢失数据
          await favoriteResults.set(favoritesData)
          console.log('[Import] Favorites imported successfully')
        }
      }

      importExportStatus.value = '设置和图片导入成功'
    }
    else {
      // 处理 JSON 文件（兼容旧格式）
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          importExportProgress.value = { step: '导入设置...', current: 0, total: 0 }
          const data = JSON.parse(reader.result as string)
          await importSettings(data)
          importExportStatus.value = '设置导入成功'
        }
        catch {
          importExportStatus.value = '导入失败：文件解析错误'
        }
      }
      reader.readAsText(file)
    }
  }
  catch (error) {
    console.error('[Import Error]', error)
    importExportStatus.value = `导入失败：${(error as Error).message}`
  }
  finally {
    isImportExporting.value = false
    importExportProgress.value = { step: '', current: 0, total: 0 }
    input.value = ''
  }

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

  if (Array.isArray(data.providers))
    providers.value = data.providers

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

  // 导入额外提示词预设
  if (Array.isArray(data.additionalPromptPresets))
    additionalPromptPresets.value = data.additionalPromptPresets
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

  <!-- 供应商配置 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div flex="~ items-center gap-2" mb-5>
      <div w-1 h-6 rounded-full class="bg-teal-500" />
      <h2 text-lg font-semibold>
        供应商
      </h2>
    </div>

    <!-- 供应商列表 -->
    <div ref="providerListRef">
      <div v-for="prov in providers" :key="prov.id" mb-3 border="~ base rounded-lg" overflow-hidden p-4>
        <template v-if="editingProviderId === prov.id">
          <!-- 编辑模式 -->
          <div flex="~ col gap-4">
            <div>
              <span label ml-0.5>名称</span>
              <Input v-model="editingProviderForm.name" type="text" placeholder="供应商名称" />
            </div>
            <div>
              <span label ml-0.5>API 类型</span>
              <select
                v-model="editingProviderForm.type"
                font-mono text-sm w-full p="x-4 y-2" bg="transparent"
                border="~ rounded base hover-base focus-base" outline="none active:none"
                cursor-pointer class="select-with-arrow"
              >
                <option value="gemini" bg-base>
                  Gemini
                </option>
                <option value="openai" bg-base>
                  OpenAI
                </option>
              </select>
            </div>
            <div>
              <span label ml-0.5>API 地址</span>
              <Input v-model="editingProviderForm.apiUrl" type="text" placeholder="https://api.openai.com" />
            </div>
            <div>
              <span label ml-0.5>API 密钥</span>
              <Input v-model="editingProviderForm.apiKey" type="password" />
            </div>
            <div>
              <span label ml-0.5>模型列表</span>
              <div flex="~ gap-2" mb-2>
                <button
                  text-sm underline cursor-pointer transition-opacity op-60 hover:op-100
                  :disabled="fetchingModelList"
                  @click="handleFetchModels(prov.id)"
                >
                  {{ fetchingModelList ? '获取中...' : '从 API 获取' }}
                </button>
              </div>
              <div v-if="availableModelList.length > 0" mb-2 flex="~ gap-2">
                <select
                  v-model="editingProviderForm.models[editingProviderForm.models.length]" font-mono text-sm flex-1
                  p="x-4 y-2" bg="transparent" border="~ rounded base hover-base focus-base"
                  outline="none active:none" cursor-pointer class="select-with-arrow"
                >
                  <option value="" disabled bg-base>
                    选择要添加的模型
                  </option>
                  <option v-for="m in availableModelList" :key="m" :value="m" bg-base>
                    {{ m }}
                  </option>
                </select>
                <button
                  p-2 rounded-lg cursor-pointer transition-colors duration-200
                  class="bg-teal-600 hover:bg-teal-700 text-white h-10 w-10"
                  flex items-center justify-center flex-shrink-0
                  @click="addSelectedModel(prov.id, (editingProviderForm.models.at(-1) || ''))"
                >
                  <div i-carbon-add text-xl />
                </button>
              </div>
              <div rounded-lg border="~ base" overflow-hidden>
                <div
                  v-for="(modelId, idx) in editingProviderForm.models" :key="idx"
                  px-4 py-2.5 flex="~ items-center gap-2"
                  border="b base" class="last:border-b-0"
                >
                  <span font-mono text-sm truncate flex-1 class="leading-8">{{ modelId }}</span>
                  <div flex="~ gap-1 items-center">
                    <button
                      p-2 rounded cursor-pointer text-white transition-colors duration-200
                      class="bg-red-400 hover:bg-red-500 h-8 w-8"
                      flex items-center justify-center title="删除"
                      @click="editingProviderForm.models = editingProviderForm.models.filter((_, i) => i !== idx)"
                    >
                      <div i-carbon-trash-can />
                    </button>
                  </div>
                </div>
                <div px-4 py-2.5>
                  <input
                    v-model="editingProviderForm.models[editingProviderForm.models.length]"
                    type="text" placeholder="手动输入模型 ID，回车添加"
                    font-mono text-sm w-full p="x-2 y-1" bg="transparent"
                    border="~ rounded base focus:teal-600" outline="none" class="h-8"
                    @keydown.enter="editingProviderForm.models = [...editingProviderForm.models.filter(Boolean)]"
                  >
                </div>
              </div>
            </div>
            <div flex="~ gap-2 justify-end">
              <button
                px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors
                bg-teal-600 hover:bg-teal-700
                @click="confirmEditProvider"
              >
                保存
              </button>
              <button
                px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors
                bg-gray-500 hover:bg-gray-600
                @click="cancelEditProvider"
              >
                取消
              </button>
              <button
                px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors
                bg-red-400 hover:bg-red-500
                @click="removeProvider(prov.id)"
              >
                删除
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <!-- 展示模式 -->
          <div flex="~ items-center justify-between" mb-3>
            <div flex="~ items-center gap-2">
              <div class="drag-handle" i-carbon-draggable op-30 hover:op-70 cursor-grab active:cursor-grabbing flex-shrink-0 p-1 ml--1 />
              <span text-base font-semibold>{{ prov.name }}</span>
            </div>
            <button
              text-sm underline cursor-pointer transition-opacity op-60 hover:op-100
              @click="startEditProvider(prov.id)"
            >
              编辑
            </button>
          </div>
          <div text-sm space-y-2>
            <div><span op-50>API 地址：</span><span font-mono>{{ prov.apiUrl || '(默认)' }}</span></div>
            <div><span op-50>API 密钥：</span><span font-mono>{{ prov.apiKey ? `••••••${prov.apiKey.slice(-4)}` : '(未设置)' }}</span></div>
            <div>
              <span op-50>模型：</span>
              <span v-if="prov.models.length === 0" op-50>(无)</span>
              <span v-else flex="~ wrap gap-1.5" inline-flex mt-1>
                <span
                  v-for="m in prov.models" :key="m"
                  px-2 py-0.5 rounded text-xs font-mono
                  bg-gray-100 dark:bg-gray-800
                >{{ m }}</span>
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 添加供应商 -->
    <div v-if="!editingProviderId" border="~ dashed base rounded-lg" p-4>
      <template v-if="isAddingProvider">
        <div flex="~ col gap-4">
          <div>
            <span label ml-0.5>名称</span>
            <Input v-model="newProviderForm.name" type="text" placeholder="供应商名称" />
          </div>
          <div>
            <span label ml-0.5>API 类型</span>
            <select
              v-model="newProviderForm.type"
              font-mono text-sm w-full p="x-4 y-2" bg="transparent"
              border="~ rounded base hover-base focus-base" outline="none active:none"
              cursor-pointer class="select-with-arrow"
            >
              <option value="gemini" bg-base>
                Gemini
              </option>
              <option value="openai" bg-base>
                OpenAI
              </option>
            </select>
          </div>
          <div>
            <span label ml-0.5>API 地址</span>
            <Input v-model="newProviderForm.apiUrl" type="text" placeholder="https://api.openai.com" />
          </div>
          <div>
            <span label ml-0.5>API 密钥</span>
            <Input v-model="newProviderForm.apiKey" type="password" />
          </div>
          <div>
            <span label ml-0.5>模型列表</span>
            <div flex="~ gap-2" mb-2>
              <button
                text-sm underline cursor-pointer transition-opacity op-60 hover:op-100
                :disabled="fetchingModelListForNew"
                @click="handleFetchModelsForNew"
              >
                {{ fetchingModelListForNew ? '获取中...' : '从 API 获取' }}
              </button>
            </div>
            <div v-if="availableModelListForNew.length > 0" mb-2 flex="~ gap-2">
              <select
                v-model="newProviderForm.models[newProviderForm.models.length]" font-mono text-sm flex-1
                p="x-4 y-2" bg="transparent" border="~ rounded base hover-base focus-base"
                outline="none active:none" cursor-pointer class="select-with-arrow"
              >
                <option value="" disabled bg-base>
                  选择要添加的模型
                </option>
                <option v-for="m in availableModelListForNew" :key="m" :value="m" bg-base>
                  {{ m }}
                </option>
              </select>
              <button
                p-2 rounded-lg cursor-pointer transition-colors duration-200
                class="bg-teal-600 hover:bg-teal-700 text-white h-10 w-10"
                flex items-center justify-center flex-shrink-0
                @click="newProviderForm.models = [...new Set([...newProviderForm.models.filter(Boolean), ...availableModelListForNew])]; availableModelListForNew = []"
              >
                <div i-carbon-add text-xl />
              </button>
            </div>
            <div rounded-lg border="~ base" overflow-hidden>
              <div
                v-for="(modelId, idx) in newProviderForm.models" :key="idx"
                px-4 py-2.5 flex="~ items-center gap-2"
                border="b base" class="last:border-b-0"
              >
                <span font-mono text-sm truncate flex-1 class="leading-8">{{ modelId }}</span>
                <button
                  p-2 rounded cursor-pointer text-white transition-colors duration-200
                  class="bg-red-400 hover:bg-red-500 h-8 w-8"
                  flex items-center justify-center title="删除"
                  @click="newProviderForm.models = newProviderForm.models.filter((_, i) => i !== idx)"
                >
                  <div i-carbon-trash-can />
                </button>
              </div>
              <div px-4 py-2.5>
                <input
                  v-model="newProviderForm.models[newProviderForm.models.length]"
                  type="text" placeholder="手动输入模型 ID，回车添加"
                  font-mono text-sm w-full p="x-2 y-1" bg="transparent"
                  border="~ rounded base focus:teal-600" outline="none" class="h-8"
                  @keydown.enter="newProviderForm.models = [...newProviderForm.models.filter(Boolean)]"
                >
              </div>
            </div>
          </div>
          <div flex="~ gap-2 justify-end">
            <button
              px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors
              bg-teal-600 hover:bg-teal-700
              @click="confirmAddProvider"
            >
              添加
            </button>
            <button
              px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors
              bg-gray-500 hover:bg-gray-600
              @click="cancelAddProvider"
            >
              取消
            </button>
          </div>
        </div>
      </template>
      <template v-else>
        <button
          flex="~ items-center gap-2" text-sm font-medium op-70 hover:op-100
          cursor-pointer transition-opacity
          @click="startAddProvider"
        >
          <div i-carbon-add />
          添加供应商
        </button>
      </template>
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
    <div v-if="(webdavSyncing && webdavProgress.step) || webdavProgressPhase === 'done'" mt-4>
      <div flex="~ items-center justify-between" mb-1.5 text-sm op-70>
        <span>{{ webdavProgress.step || '同步完成' }}</span>
        <span v-if="webdavProgress.total > 0">{{ webdavProgress.current }} / {{ webdavProgress.total }}</span>
      </div>
      <div w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden>
        <div
          h-full rounded-full transition-all duration-500
          :class="webdavProgressPhase === 'done' ? 'bg-teal-500' : 'bg-amber-500'"
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

    <!-- 导入/导出进度条 -->
    <div v-if="isImportExporting && importExportProgress.step" mt-4>
      <div flex="~ items-center justify-between" mb-1.5 text-sm op-70>
        <span>{{ importExportProgress.step }}</span>
        <span v-if="importExportProgress.total > 0">{{ importExportProgress.current }} / {{ importExportProgress.total }}</span>
      </div>
      <div w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden>
        <div
          h-full rounded-full bg-amber-500 transition-all duration-300
          :style="{ width: importExportProgress.total > 0 ? `${Math.round(importExportProgress.current / importExportProgress.total * 100)}%` : '100%' }"
        />
      </div>
    </div>

    <div v-if="importExportStatus" mt-3 text-sm :class="importExportStatus.includes('失败') ? 'text-red-400' : 'text-teal-600 dark:text-teal-400'">
      {{ importExportStatus }}
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

.select-with-arrow {
  appearance: none;
  background-image: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"%3E%3Cpath fill="%23aaa" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/%3E%3C/svg%3E');
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 20px;
}
</style>

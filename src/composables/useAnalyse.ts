import type { FavoriteResult, PendingFavoriteResult } from '~/types'
import { useStorage } from '@vueuse/core'
import { computed, ref, watch, watchEffect } from 'vue'
import { addAdditionalPreset, additionalPromptPresets, computeStringHash, customPrompts, favoriteResults, fileToBase64, generateContent, getPromptById, isAbortError, providers, removeAdditionalPreset, saveImage } from '~/logic'

// 状态放模块作用域使其成为共享单例，让 DevPanel 与页面拿到同一份状态
const image = ref<File | string | null>(null)
const base64Image = ref<string | null>(null)

const selectedProviderId = useStorage<string | undefined>('selected-provider-id', undefined)
const selectedModelId = useStorage('selected-model', '')
const selectedPromptId = useStorage('selected-prompt-id', 'novel')
const additionalPrompt = ref('')
const result = ref('')
const errorMsg = ref('')
const analyseButtonLoading = ref(false)
const saveButtonDisabled = ref(false)

// 结果编辑
const isEditingResult = ref(false)
const editedResultText = ref('')

const lastFavoriteResult = ref<PendingFavoriteResult | null>(null)

// 流式模拟的中断标志，仅 dev 面板使用
const devStreamAbort = ref(false)

// 真实分析的取消句柄，非空表示当前有请求在飞
let analyseAbortController: AbortController | null = null

// 本轮分析是否被用户主动取消
const analyseAborted = ref(false)

const selectedProvider = computed(() =>
  selectedProviderId.value
    ? providers.value.find(p => p.id === selectedProviderId.value)
    : undefined,
)

// 当供应商 id 改变时，清空已选的模型
watch(selectedProviderId, () => {
  selectedModelId.value = ''
})

// 确保选中的 Prompt ID 有效
watchEffect(() => {
  const prompts = customPrompts.value
  const exists = prompts.some(p => p.id === selectedPromptId.value)
  if (!exists && prompts.length > 0)
    selectedPromptId.value = prompts[0].id
})

const providerSelectOptions = computed(() =>
  providers.value.map(p => ({ label: p.name, value: p.id })),
)

const modelSelectOptions = computed(() => {
  if (!selectedProvider.value)
    return []
  return selectedProvider.value.models.map(m => ({ label: m, value: m }))
})

const promptSelectOptions = computed(() =>
  customPrompts.value.map(prompt => ({ label: prompt.name, value: prompt.id })),
)

const selectedPrompt = computed(() => getPromptById(selectedPromptId.value))

const analyseButtonDisabled = computed(() => {
  if (!selectedModelId.value || !selectedPromptId.value || !selectedProvider.value)
    return true
  return !image.value
})

export function useAnalyse() {
  // 额外提示词预设（标签栏模式）
  const selectedAdditionalPresetId = ref<string | null>(null)

  function handleSelectPreset(id: string) {
    if (selectedAdditionalPresetId.value === id) {
      selectedAdditionalPresetId.value = null
      return
    }
    selectedAdditionalPresetId.value = id
    const preset = additionalPromptPresets.value.find(p => p.id === id)
    if (preset)
      additionalPrompt.value = preset.content
  }

  function handleDeletePreset(id: string) {
    if (!window.confirm('确定要删除这个预设吗？')) {
      ;(document.activeElement as HTMLElement)?.blur()
      return
    }
    if (selectedAdditionalPresetId.value === id)
      selectedAdditionalPresetId.value = null
    removeAdditionalPreset(id)
  }

  function handleSaveAsPreset() {
    const content = additionalPrompt.value.trim()
    if (!content)
      return
    const name = window.prompt('输入预设标签名：', '')
    if (!name || !name.trim())
      return
    selectedAdditionalPresetId.value = addAdditionalPreset(name.trim(), content)
  }

  function handleStartEditResult() {
    editedResultText.value = result.value
    isEditingResult.value = true
  }

  function handleConfirmEditResult() {
    result.value = editedResultText.value
    if (lastFavoriteResult.value)
      lastFavoriteResult.value.result = editedResultText.value
    isEditingResult.value = false
  }

  function handleCancelEditResult() {
    isEditingResult.value = false
  }

  // ──────────────────────────────────────────────
  // 开发测试注入点（仅 dev 面板调用，不参与生产流程）
  // ──────────────────────────────────────────────

  // 把假结果当作真实分析产物塞进状态机，后续保存/编辑/收藏流程与真实分析一致
  function injectFakeResult(text: string, options: { withImage?: boolean } = {}) {
    errorMsg.value = ''
    isEditingResult.value = false
    result.value = text
    saveButtonDisabled.value = false
    // 1×1 透明 PNG：让「保存结果」能真的写进 imageStore；内联以免 dev fixtures 进生产包
    const placeholderImage = options.withImage === false
      ? ''
      : 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
    lastFavoriteResult.value = {
      model: selectedModelId.value || 'test-model',
      mode: selectedPromptId.value,
      imageHash: '',
      mimeType: 'image/png',
      time: Date.now(),
      result: text,
      prompt: selectedPrompt.value?.content ?? '',
      additionalPrompt: additionalPrompt.value.trim(),
      _pendingBase64: placeholderImage,
      _sourceUrl: undefined,
    }
    return text
  }

  // 模拟一次流式分析但不发网络请求，走与真实分析相同的 UI 状态机以便离线验证
  async function simulateStream(
    text: string,
    options: { chunkSize?: number, interval?: number, clear?: boolean } = {},
  ) {
    const { chunkSize = 4, interval = 40, clear = true } = options

    // 与真实分析保持一致的前置状态
    analyseButtonLoading.value = true
    errorMsg.value = ''
    if (clear)
      result.value = ''
    lastFavoriteResult.value = null
    saveButtonDisabled.value = false
    devStreamAbort.value = false

    const chunks: string[] = []
    for (let i = 0; i < text.length; i += chunkSize)
      chunks.push(text.slice(i, i + chunkSize))

    let aborted = false
    try {
      for (const chunk of chunks) {
        if (devStreamAbort.value) {
          aborted = true
          break
        }
        result.value += chunk
        await new Promise(resolve => setTimeout(resolve, interval))
      }

      if (aborted) {
        console.warn('[DevPanel] 流式模拟被中断')
      }
      else {
        // 流结束后补上待存数据，让「保存结果」可用
        lastFavoriteResult.value = {
          model: selectedModelId.value || 'test-model',
          mode: selectedPromptId.value,
          imageHash: '',
          mimeType: 'image/png',
          time: Date.now(),
          result: result.value,
          prompt: selectedPrompt.value?.content ?? '',
          additionalPrompt: additionalPrompt.value.trim(),
          _pendingBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
          _sourceUrl: undefined,
        }
      }
    }
    finally {
      analyseButtonLoading.value = false
      devStreamAbort.value = false
    }
  }

  // 中断正在进行的流式模拟
  function abortStream() {
    if (analyseButtonLoading.value)
      devStreamAbort.value = true
  }

  async function urlToBase64(url: string): Promise<{ base64: string, mimeType: string }> {
    const res = await fetch(url)
    if (!res.ok)
      throw new Error(`无法获取图片: ${res.status} ${res.statusText}`)
    const blob = await res.blob()
    const mimeType = blob.type || 'image/jpeg'
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++)
      binary += String.fromCharCode(bytes[i])
    return { base64: btoa(binary), mimeType }
  }

  async function handleAnalyseButtonClick() {
    const provider = selectedProvider.value
    if (!provider) {
      errorMsg.value = '请先选择供应商。'
      return
    }

    if (!provider.apiKey) {
      errorMsg.value = `请先配置「${provider.name}」的 API 密钥。`
      return
    }

    if (!image.value) {
      errorMsg.value = '请先上传图片或输入图片链接。'
      return
    }
    if (image.value instanceof File && image.value.size > 20 * 1024 * 1024) {
      errorMsg.value = '图片大小不能超过 20MB，请选择较小的图片。'
      return
    }

    if (!selectedPrompt.value) {
      errorMsg.value = '请先选择 Prompt。'
      return
    }

    analyseButtonLoading.value = true
    analyseAborted.value = false
    errorMsg.value = ''
    result.value = ''
    // 清掉上一轮的待存数据，避免本轮失败后仍能把旧结果保存下来
    lastFavoriteResult.value = null
    saveButtonDisabled.value = false

    // 每轮都换一个新的 controller，保证取消只影响本轮
    const controller = new AbortController()
    analyseAbortController = controller

    try {
      const systemInstruction = selectedPrompt.value.content || '分析这张图片'

      const userText = additionalPrompt.value.trim()
        ? `用户补充说明：${additionalPrompt.value.trim()}`
        : ''

      let sourceUrl: string | undefined
      let mimeType: string
      if (typeof image.value === 'string') {
        sourceUrl = image.value
        const result = await urlToBase64(sourceUrl)
        base64Image.value = result.base64
        mimeType = result.mimeType
      }
      else {
        base64Image.value = await fileToBase64(image.value!)
        mimeType = image.value!.type
      }
      const contents: Parameters<typeof generateContent>[1] = [
        { inlineData: { data: base64Image.value, mimeType } },
      ]
      if (userText)
        contents.push({ text: userText })

      // 流式回调是 result 的唯一写入方，返回后不再整体覆盖，避免两条路径打架
      const response = await generateContent(
        selectedModelId.value,
        contents,
        systemInstruction,
        provider,
        (chunk) => {
          result.value += chunk
        },
        controller.signal,
      )
      const lastImage = base64Image.value

      // 以实际渲染出来的文本为准；response.text 只用来判断是否为空
      const finalText = result.value || response.text || ''
      if (finalText === '') {
        if ((response.candidates && response.candidates[0]?.finishReason === 'PROHIBITED_CONTENT')
          || (response as any).promptFeedback?.blockReason) {
          errorMsg.value = '内容被安全过滤器阻止，请重试或更换模型。'
        }
        else {
          errorMsg.value = '发生未知错误，请稍后再试或检查控制台日志。'
        }
      }
      else {
        saveButtonDisabled.value = false
        errorMsg.value = ''
        lastFavoriteResult.value = {
          model: selectedModelId.value,
          mode: selectedPromptId.value,
          imageHash: '',
          mimeType,
          time: Date.now(),
          result: finalText,
          prompt: selectedPrompt.value?.content ?? '',
          additionalPrompt: additionalPrompt.value.trim(),
          _pendingBase64: lastImage ?? undefined,
          _sourceUrl: sourceUrl,
        }
      }
    }
    catch (error) {
      if (isAbortError(error)) {
        // 用户主动取消：保留已经流式生成的部分，允许直接保存半截结果
        analyseAborted.value = true
        errorMsg.value = ''
        console.warn('[Analysis] 已取消，保留已生成内容', { chars: result.value.length })
        if (result.value) {
          saveButtonDisabled.value = false
          lastFavoriteResult.value = {
            model: selectedModelId.value,
            mode: selectedPromptId.value,
            imageHash: '',
            mimeType: typeof image.value === 'string' ? 'image/png' : (image.value?.type ?? 'image/png'),
            time: Date.now(),
            result: result.value,
            prompt: selectedPrompt.value?.content ?? '',
            additionalPrompt: additionalPrompt.value.trim(),
            _pendingBase64: base64Image.value ?? undefined,
            _sourceUrl: typeof image.value === 'string' ? image.value : undefined,
          }
        }
      }
      else {
        console.error('[Analysis Error]', { provider: provider.name, error })
        errorMsg.value = `Error: ${(error as Error).message || String(error)}`
      }
    }
    finally {
      // 只有仍是本轮 controller 时才清理，避免覆盖下一轮的状态
      if (analyseAbortController === controller)
        analyseAbortController = null
      analyseButtonLoading.value = false
    }
  }

  // 取消正在进行的分析，保留已生成的部分文本
  function cancelAnalyse() {
    analyseAbortController?.abort()
  }

  async function handleSaveButtonClick() {
    const pending = lastFavoriteResult.value
    if (!pending) {
      errorMsg.value = '没有可保存的结果，请先重新分析。'
      saveButtonDisabled.value = false
      return
    }

    // 只有在真正写入成功后才锁定按钮；失败时恢复可点击，避免用户被永久卡死。
    saveButtonDisabled.value = true
    errorMsg.value = ''

    try {
      const mimeType = pending.mimeType
      const sourceUrl = pending._sourceUrl
      const base64 = pending._pendingBase64

      const item: FavoriteResult = {
        model: pending.model,
        mode: pending.mode,
        imageHash: '',
        mimeType,
        time: pending.time,
        result: pending.result,
        prompt: pending.prompt ?? '',
        additionalPrompt: pending.additionalPrompt ?? '',
      }

      if (sourceUrl) {
        item.imageHash = await computeStringHash(sourceUrl)
        item.imageUrl = sourceUrl
      }
      else {
        if (!base64) {
          errorMsg.value = '图片数据已丢失，请重新分析后再保存。'
          saveButtonDisabled.value = false
          return
        }
        item.imageHash = await saveImage(base64, mimeType)
      }

      if (!favoriteResults.data.value)
        favoriteResults.data.value = []
      favoriteResults.data.value.unshift(item)

      // 保存成功，丢弃暂存数据
      lastFavoriteResult.value = null
    }
    catch (error) {
      console.error('[Save Error]', error)
      errorMsg.value = `保存失败：${(error as Error).message || String(error)}`
      // 关键：失败必须解锁，否则按钮会永远停在「已保存」
      saveButtonDisabled.value = false
    }
  }

  return {
    image,
    selectedProviderId,
    selectedModelId,
    selectedPromptId,
    selectedProvider,
    selectedPrompt,
    additionalPrompt,
    result,
    errorMsg,
    analyseButtonLoading,
    analyseButtonDisabled,
    analyseAborted,
    cancelAnalyse,
    saveButtonDisabled,
    providerSelectOptions,
    modelSelectOptions,
    promptSelectOptions,
    additionalPromptPresets,
    selectedAdditionalPresetId,
    handleSelectPreset,
    handleDeletePreset,
    handleSaveAsPreset,
    handleAnalyseButtonClick,
    handleSaveButtonClick,
    isEditingResult,
    editedResultText,
    handleStartEditResult,
    handleConfirmEditResult,
    handleCancelEditResult,
    // 开发测试注入点
    injectFakeResult,
    simulateStream,
    abortStream,
  }
}

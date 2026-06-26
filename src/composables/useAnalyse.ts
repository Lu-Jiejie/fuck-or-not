import type { FavoriteResult } from '~/types'
import { useStorage } from '@vueuse/core'
import { computed, ref, watch, watchEffect } from 'vue'
import { addAdditionalPreset, additionalPromptPresets, computeStringHash, customPrompts, favoriteResults, fileToBase64, generateContent, getPromptById, providers, removeAdditionalPreset, saveImage } from '~/logic'

export function useAnalyse() {
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

  const lastFavoriteResult = ref<FavoriteResult | null>(null)

  const selectedProvider = computed(() => {
    if (!selectedProviderId.value)
      return undefined
    return providers.value.find(p => p.id === selectedProviderId.value)
  })

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
    if (typeof image.value === 'string')
      return !image.value
    return !image.value
  })

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

  // 仅用于开发测试
  function handleFillTestResult() {
    errorMsg.value = ''
    isEditingResult.value = false
    saveButtonDisabled.value = false
    result.value = [
      '## 测试结果',
      '',
      '这是一段用于**开发测试**的模拟分析结果。',
      '',
      '- 列表项一',
      '- 列表项二',
      '- 列表项三',
      '',
      '> 引用：你可以点击「编辑结果」来测试编辑功能。',
      '',
      '```js',
      'console.log(\'hello fuck-or-not\')',
      '```',
    ].join('\n')
    lastFavoriteResult.value = {
      model: selectedModelId.value || 'test-model',
      mode: selectedPromptId.value,
      imageHash: '',
      mimeType: 'image/png',
      time: Date.now(),
      result: result.value,
      prompt: selectedPrompt.value?.content ?? '',
      additionalPrompt: additionalPrompt.value.trim(),
      _pendingBase64: '',
      _sourceUrl: undefined,
    } as any
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
    errorMsg.value = ''
    result.value = ''

    try {
      let finalPrompt = selectedPrompt.value.content || '分析这张图片'

      if (additionalPrompt.value.trim())
        finalPrompt = `${finalPrompt}\n\n用户补充说明：${additionalPrompt.value.trim()}`

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
        { text: finalPrompt },
      ]
      const response = await generateContent(
        selectedModelId.value,
        contents,
        finalPrompt,
        provider,
        (chunk) => {
          result.value += chunk
        },
      )
      const lastImage = base64Image.value

      console.log(response)
      if (response.text === '' || response.text === null || response.text === undefined) {
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
        result.value = response.text!
        errorMsg.value = ''
        lastFavoriteResult.value = {
          model: selectedModelId.value,
          mode: selectedPromptId.value,
          imageHash: '',
          mimeType,
          time: Date.now(),
          result: response.text!,
          prompt: selectedPrompt.value?.content ?? '',
          additionalPrompt: additionalPrompt.value.trim(),
          _pendingBase64: lastImage,
          _sourceUrl: sourceUrl,
        } as any
      }
    }
    catch (error) {
      console.error('[Analysis Error]', { provider: provider.name, error })
      errorMsg.value = `Error: ${(error as Error).message || String(error)}`
    }
    finally {
      analyseButtonLoading.value = false
    }
  }

  async function handleSaveButtonClick() {
    saveButtonDisabled.value = true
    const pending = lastFavoriteResult.value as any
    const base64 = pending._pendingBase64 as string
    const mimeType = pending.mimeType as string
    const sourceUrl = pending._sourceUrl as string | undefined

    let hash: string
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
      hash = await computeStringHash(sourceUrl)
      item.imageHash = hash
      item.imageUrl = sourceUrl
    }
    else {
      hash = await saveImage(base64, mimeType)
      item.imageHash = hash
    }

    if (!favoriteResults.data.value)
      favoriteResults.data.value = []
    favoriteResults.data.value.unshift(item)
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
    handleFillTestResult,
  }
}

import type { AIProvider, FavoriteResult, ModelOption } from '~/types'
import { useStorage } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { computed, ref, watch } from 'vue'
import { addAdditionalPreset, additionalPromptPresets, chatgptApiKey, customPrompts, fileToBase64, generateContent, getPromptById, getProviderModels, googleApiKey, grokApiKey, modelOptions, removeAdditionalPreset, saveImage } from '~/logic'

export function useAnalyse() {
  const image = ref<File | null>(null)
  const base64Image = ref<string | null>(null)

  const selectedProvider = useStorage<AIProvider>('selected-provider', 'Gemini')
  const selectedModelId = useStorage('selected-model', 'gemini-2.5-flash')
  const selectedPromptId = useStorage('selected-prompt-id', 'novel')
  const additionalPrompt = ref('')
  const result = ref('')
  const errorMsg = ref('')
  const analyseButtonLoading = ref(false)
  const saveButtonDisabled = ref(false)

  // 结果编辑
  const isEditingResult = ref(false)
  const editedResultText = ref('')

  const favoriteResults = useIDBKeyval('favorite-results', [] as FavoriteResult[])
  const lastFavoriteResult = ref<FavoriteResult | null>(null)

  // 当提供商改变时，自动选择该提供商的第一个模型
  watch(selectedProvider, (newProvider) => {
    const models = getProviderModels(newProvider)
    if (models.length > 0 && !models.includes(selectedModelId.value)) {
      selectedModelId.value = models[0]
    }
  })

  // 确保选中的 Prompt ID 有效
  watch(() => customPrompts.value, () => {
    const exists = customPrompts.value.some(p => p.id === selectedPromptId.value)
    if (!exists && customPrompts.value.length > 0) {
      selectedPromptId.value = customPrompts.value[0].id
    }
  }, { immediate: true, deep: true })

  const currentProviderModels = computed(() => {
    return getProviderModels(selectedProvider.value)
  })

  const selectedModel = computed<ModelOption | undefined>(() => {
    // 先尝试从新的分组模型中查找
    if (currentProviderModels.value.includes(selectedModelId.value)) {
      return {
        id: selectedModelId.value,
        provider: selectedProvider.value,
      }
    }
    // 兼容旧版：从 modelOptions 中查找
    return modelOptions.value.find(m => m.id === selectedModelId.value)
  })

  const selectedPrompt = computed(() => {
    return getPromptById(selectedPromptId.value)
  })

  const analyseButtonDisabled = computed(() => {
    return !selectedModelId.value || !selectedPromptId.value || !image.value
  })

  const providerSelectOptions = computed(() => [
    { label: 'Gemini', value: 'Gemini' as AIProvider },
    { label: 'Grok', value: 'Grok' as AIProvider },
    { label: 'ChatGPT', value: 'ChatGPT' as AIProvider },
  ])

  const modelSelectOptions = computed(() => {
    return currentProviderModels.value.map(modelId => ({
      label: modelId,
      value: modelId,
    }))
  })

  const promptSelectOptions = computed(() => {
    return customPrompts.value.map(prompt => ({
      label: prompt.name,
      value: prompt.id,
    }))
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
    if (preset) {
      additionalPrompt.value = preset.content
    }
  }

  function handleDeletePreset(id: string) {
    if (!window.confirm('确定要删除这个预设吗？')) {
      ;(document.activeElement as HTMLElement)?.blur()
      return
    }
    if (selectedAdditionalPresetId.value === id) {
      selectedAdditionalPresetId.value = null
    }
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
    if (lastFavoriteResult.value) {
      lastFavoriteResult.value.result = editedResultText.value
    }
    isEditingResult.value = false
  }

  function handleCancelEditResult() {
    isEditingResult.value = false
  }

  // 仅用于开发测试：填充一段模拟结果，便于验证结果展示与编辑功能
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
    } as any
  }

  async function handleAnalyseButtonClick() {
    if (!selectedModel.value) {
      errorMsg.value = '请先选择模型。'
      return
    }

    const currentProvider = selectedModel.value.provider

    if (currentProvider === 'Gemini' && !googleApiKey.value) {
      errorMsg.value = '请先设置 Gemini API 密钥。'
      return
    }
    if (currentProvider === 'Grok' && !grokApiKey.value) {
      errorMsg.value = '请先设置 Grok API 密钥。'
      return
    }
    if (currentProvider === 'ChatGPT' && !chatgptApiKey.value) {
      errorMsg.value = '请先设置 ChatGPT API 密钥。'
      return
    }

    if (!image.value) {
      errorMsg.value = '请先上传图片。'
      return
    }
    if (image.value.size > 20 * 1024 * 1024) {
      errorMsg.value = '图片大小不能超过 20MB，请选择较小的图片。'
      return
    }

    if (!selectedPrompt.value) {
      errorMsg.value = '请先选择 Prompt。'
      return
    }

    analyseButtonLoading.value = true

    try {
      let finalPrompt = selectedPrompt.value.content || '分析这张图片'

      // 如果有额外的提示词，添加到最终 Prompt 中
      if (additionalPrompt.value.trim()) {
        finalPrompt = `${finalPrompt}\n\n用户补充说明：${additionalPrompt.value.trim()}`
      }

      base64Image.value = await fileToBase64(image.value!)
      const contents: Parameters<typeof generateContent>[1] = [
        {
          inlineData: {
            data: base64Image.value,
            mimeType: image.value!.type,
          },
        },
        {
          text: finalPrompt,
        },
      ]
      result.value = ''
      const response = await generateContent(
        selectedModel.value.id,
        contents,
        finalPrompt,
        currentProvider,
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
          model: selectedModel.value.id,
          mode: selectedPromptId.value,
          imageHash: '',
          mimeType: image.value!.type,
          time: Date.now(),
          result: response.text!,
          prompt: selectedPrompt.value?.content ?? '',
          additionalPrompt: additionalPrompt.value.trim(),
          _pendingBase64: lastImage,
        } as any
      }
    }
    catch (error) {
      console.error('[Analysis Error]', {
        provider: currentProvider,
        model: selectedModel.value.id,
        error,
      })
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
    const hash = await saveImage(base64, mimeType)
    const item: FavoriteResult = {
      model: pending.model,
      mode: pending.mode,
      imageHash: hash,
      mimeType,
      time: pending.time,
      result: pending.result,
      prompt: pending.prompt ?? '',
      additionalPrompt: pending.additionalPrompt ?? '',
    }
    favoriteResults.data.value.unshift(item)
  }

  return {
    image,
    selectedProvider,
    selectedModelId,
    selectedPromptId,
    selectedModel,
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

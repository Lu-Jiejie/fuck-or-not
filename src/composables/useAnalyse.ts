import type { AIProvider, FavoriteResult, ModelOption } from '~/types'
import { useStorage } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { computed, ref, watch } from 'vue'
import { chatgptApiKey, customPrompts, fileToBase64, generateContent, getPromptById, getProviderModels, googleApiKey, grokApiKey, modelOptions, saveImage } from '~/logic'

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
      const response = await generateContent(
        selectedModel.value.id,
        contents,
        finalPrompt,
        currentProvider,
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
    handleAnalyseButtonClick,
    handleSaveButtonClick,
  }
}

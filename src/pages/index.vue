<script setup lang="ts">
import type { FavoriteResult } from '~/types'
import { useStorage } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { computed, ref } from 'vue'
import Button from '~/components/Button.vue'
import ButtonSelect from '~/components/ButtonSelect.vue'
import ImageUploader from '~/components/ImageUploader.vue'
import Select from '~/components/Select.vue'
import { fileToBase64, generateContent } from '~/logic'
import { defaultConcisePrompt, defaultDetailedPrompt, defaultNovelPrompt } from '~/logic/prompts'

defineOptions({
  name: 'IndexPage',
})

const image = ref<File | null>(null)
const base64Image = ref<string | null>(null)

const googleApiKey = useStorage('google-api-key', '')
const concisePrompt = useStorage('concise-prompt', '')
const detailedPrompt = useStorage('detailed-prompt', '')
const novelPrompt = useStorage('novel-prompt', '')
const customPrompts = useStorage('custom-prompt', '')
const selectedModel = useStorage('selected-model', 'gemini-2.0-flash')
const selectedMode = useStorage<'concise' | 'detailed' | 'novel' | 'custom'>('selected-mode', 'novel')
const result = ref('')
const errorMsg = ref('')
const analyseButtonLoading = ref(false)
const analyseButtonDisabled = computed(() => {
  return !selectedModel.value || !selectedMode.value || !image.value
})

const saveButtonDisabled = ref(false)

const favoriteResults = useIDBKeyval('favorite-results', [] as FavoriteResult[])
const lastFavoriteResult = ref<FavoriteResult | null>(null)

const modelOptions = [
  { label: 'Gemini 2.0 Flash（默认版本 – 快速且宽容）', value: 'gemini-2.0-flash' },
  { label: 'Gemini 2.5 Flash（速度与准确性提升）', value: 'gemini-2.5-flash' },
  { label: 'Gemini 1.5 Flash（轻量且响应迅速，较旧版本）', value: 'gemini-1.5-flash' },
  { label: 'Gemini 2.0 Flash-Lite (速度飞快, 适合快速测试)', value: 'gemini-2.0-flash-lite' },
  { label: 'Gemini 2.5 Flash-Lite Preview (极速预览版, 细节有所减少)', value: 'gemini-2.5-flash-lite-preview-06-17' },
  { label: 'Gemini 1.5 Pro（稳定且宽容的经典型号 - 需付费）', value: 'gemini-1.5-pro' },
  { label: 'Gemini 2.5 Pro（最强大 – 需付费）', value: 'gemini-2.5-pro' },
  { label: 'Gemma 3（极速，适合快速结果）', value: 'gemma-3' },
]
const modeOptions = computed(() => {
  const options = [
    { label: '简洁', subLabel: '简短1-2句，够味', value: 'concise' },
    { label: '详细', subLabel: '细嗦3+句，够劲', value: 'detailed' },
    { label: '小说', subLabel: '400字以上，够硬核', value: 'novel' },
  ]
  if (customPrompts.value !== '') {
    options.push({ label: '自定义', subLabel: 'XP，够自由', value: 'custom' })
  }
  return options
})

async function handleAnalyseButtonClick() {
  if (!googleApiKey.value) {
    errorMsg.value = '请先设置 Google API 密钥。'
    return
  }

  analyseButtonLoading.value = true

  try {
    base64Image.value = await fileToBase64(image.value!)
    const contents: Parameters<typeof generateContent>[2] = [
      {
        inlineData: {
          data: base64Image.value,
          mimeType: image.value!.type,
        },
      },
      {
        text: '分析这张图片',
      },
    ]
    let finalPrompt = ''
    switch (selectedMode.value) {
      case 'concise':
        finalPrompt = concisePrompt.value || defaultConcisePrompt
        break
      case 'detailed':
        finalPrompt = detailedPrompt.value || defaultDetailedPrompt
        break
      case 'novel':
        finalPrompt = novelPrompt.value || defaultNovelPrompt
        break
      default:
        finalPrompt = customPrompts.value
    }

    const response = await generateContent(
      googleApiKey.value,
      selectedModel.value,
      contents,
      finalPrompt,
    )

    console.log(response)
    if (response.text === '' || response.text === null || response.text === undefined) {
      if (response.candidates![0].finishReason === 'PROHIBITED_CONTENT') {
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
        model: selectedModel.value,
        mode: selectedMode.value,
        image: base64Image.value,
        time: Date.now(),
        result: response.text!,
      }
    }
  }
  catch (error) {
    console.error(error)
    errorMsg.value = '发生错误，请稍后再试或检查控制台日志。'
  }
  finally {
    analyseButtonLoading.value = false
  }
}

function handleSaveButtonClick() {
  saveButtonDisabled.value = true
  favoriteResults.data.value.unshift(lastFavoriteResult.value!)
}
</script>

<template>
  <h1 text-3xl font-bold>
    上不上 AI 分析
  </h1>

  <div py-4 />
  <span label ml-0.5>
    模型
  </span>
  <Select v-model="selectedModel" :options="modelOptions" />

  <div py-4 />
  <span label ml-0.5>
    模式
  </span>
  <ButtonSelect v-model="selectedMode" :options="modeOptions" />

  <div py-4 />
  <span label ml-0.5>
    上传图片
  </span>
  <ImageUploader v-model="image" />

  <div py-2 />
  <Button
    :loading="analyseButtonLoading" :disabled="analyseButtonDisabled"
    :disable-on-loading="true"
    loading-text="分析中..." @click="handleAnalyseButtonClick"
  >
    分析
  </Button>

  <div py-4 />
  <span v-show="result !== '' || errorMsg !== ''" label ml-0.5>
    分析结果
  </span>

  <div
    v-show="errorMsg !== ''"
    p="x-4 y-3"
    border="~ base hover-base rounded"
    whitespace-pre-wrap text-left font-bold
    bg-red-400
  >
    {{ errorMsg }}
  </div>
  <div v-show="result !== '' && errorMsg !== ''" py-1 />
  <div
    v-show="result !== ''"
    p="x-4 y-3" select-text
    border="~ base hover-base rounded"
    bg="light dark:dark"
    whitespace-pre-wrap text-left
  >
    {{ result }}
  </div>
  <div v-show="result !== ''">
    <div py-2 />
    <Button
      :disabled="saveButtonDisabled" disabled-text="已保存"
      @click="handleSaveButtonClick"
    >
      保存结果
    </Button>
  </div>
  <div v-show="result !== '' || errorMsg !== ''" py-4 />
</template>

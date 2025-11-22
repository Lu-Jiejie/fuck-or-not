<script setup lang="ts">
import type { FavoriteResult } from '~/types'
import {
  createPartFromUri,
  createUserContent,
} from '@google/genai'
import { useStorage } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { computed, ref } from 'vue'
import Button from '~/components/Button.vue'
import ButtonSelect from '~/components/ButtonSelect.vue'
import ImageUploader from '~/components/ImageUploader.vue'
import Select from '~/components/Select.vue'
import { fileToBase64, generateContent, googleApiKey, uploadFileToAPI } from '~/logic'
import { defaultConcisePrompt, defaultDetailedPrompt, defaultNovelPrompt } from '~/logic/prompts'

defineOptions({
  name: 'IndexPage',
})

const image = ref<File | null>(null)
const base64Image = ref<string | null>(null)

// 新增：分析方式选项

const concisePrompt = useStorage('concise-prompt', '')
const detailedPrompt = useStorage('detailed-prompt', '')
const novelPrompt = useStorage('novel-prompt', '')
const customPrompts = useStorage('custom-prompt', '')
const selectedModel = useStorage('selected-model', 'gemini-2.0-flash')
const selectedMode = useStorage<'concise' | 'detailed' | 'novel' | 'custom'>('selected-mode', 'novel')
const uploadType = useStorage<'base64' | 'api'>('upload-type', 'base64')
const result = ref('')
const errorMsg = ref('')
const analyseButtonLoading = ref(false)
const analyseButtonDisabled = computed(() => {
  return !selectedModel.value || !selectedMode.value || !image.value
})

const saveButtonDisabled = ref(false)

const favoriteResults = useIDBKeyval('favorite-results', [] as FavoriteResult[])
const lastFavoriteResult = ref<FavoriteResult | null>(null)

const analyseMethodOptions = [
  { label: '直接传递图片', value: 'base64' },
  { label: '使用 FileAPI 上传图片（适合大于20MB的图片）', value: 'api' },
]

const modelOptions = [
  { label: 'Gemini 2.0 Flash（最推荐）', value: 'gemini-2.0-flash' },
  { label: 'Gemini 2.5 Flash（准确性提升，但容易被 BAN）', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.0 Flash-Lite', value: 'gemini-2.0-flash-lite' },
  { label: 'Gemini 2.5 Flash-Lite Preview', value: 'gemini-2.5-flash-lite-preview-09-2025' },
  { label: 'Gemini 2.5 Pro（需付费）', value: 'gemini-2.5-pro' },
  { label: 'Gemini 3 Pro（需付费）', value: 'gemini-3-pro-preview' },
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
  if (!image.value) {
    errorMsg.value = '请先上传图片。'
    return
  }
  if (image.value.size > 20 * 1024 * 1024 && uploadType.value === 'base64') {
    errorMsg.value = '图片大于 20MB，请选择“使用 FileAPI 上传图片”。'
    return
  }

  analyseButtonLoading.value = true

  try {
    let response
    let lastImage
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

    if (uploadType.value === 'api') {
      // 上传图片
      const uploadedFile = await uploadFileToAPI(image.value)
      const contents = createUserContent([
        createPartFromUri(uploadedFile.uri!, uploadedFile.mimeType!),
        finalPrompt || '分析这张图片',
      ])
      response = await generateContent(
        selectedModel.value,
        contents,
        finalPrompt,
      )
      lastImage = uploadedFile.uri!
    }
    else {
      base64Image.value = await fileToBase64(image.value!)
      const contents: Parameters<typeof generateContent>[1] = [
        {
          inlineData: {
            data: base64Image.value,
            mimeType: image.value!.type,
          },
        },
        {
          text: finalPrompt || '分析这张图片',
        },
      ]
      response = await generateContent(
        selectedModel.value,
        contents,
        finalPrompt,
      )
      lastImage = base64Image.value
    }

    console.log(response)
    if (response.text === '' || response.text === null || response.text === undefined) {
      if ((response as any).error?.status === 'RESOURCE_EXHAUSTED') {
        errorMsg.value = '超出您API Key的配额，请稍后再试。'
      }
      else if ((response as any).error?.status === 'FAILED_PRECONDITION') {
        errorMsg.value = 'Gemini在您的国家/地区不可用。'
      }
      else if ((response.candidates && response.candidates[0]?.finishReason === 'PROHIBITED_CONTENT')
        || response.promptFeedback?.blockReason === 'PROHIBITED_CONTENT'
      ) {
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
        image: lastImage,
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
    Fuck or Not
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

  <div py-1 />
  <Select v-model="uploadType" :options="analyseMethodOptions" />

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

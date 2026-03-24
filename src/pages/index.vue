<script setup lang="ts">
import Button from '~/components/Button.vue'
import ButtonSelect from '~/components/ButtonSelect.vue'
import ImageUploader from '~/components/ImageUploader.vue'
import MarkdownRenderer from '~/components/MarkdownRenderer.vue'
import Select from '~/components/Select.vue'
import { useAnalyse } from '~/composables/useAnalyse'

defineOptions({
  name: 'IndexPage',
})

const {
  image,
  selectedModelId,
  selectedMode,
  selectedModel,
  uploadType,
  result,
  errorMsg,
  analyseButtonLoading,
  analyseButtonDisabled,
  saveButtonDisabled,
  modelSelectOptions,
  modeOptions,
  analyseMethodOptions,
  handleAnalyseButtonClick,
  handleSaveButtonClick,
} = useAnalyse()
</script>

<template>
  <div mb-6 text-left px-1>
    <h1 text-3xl font-bold>
      Fuck or Not
    </h1>
    <p text-sm op-50 mt-1>
      上还是不上？
    </p>
  </div>

  <!-- 配置区 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div mb-5>
      <span label ml-0.5>模型</span>
      <Select v-model="selectedModelId" :options="modelSelectOptions" />
    </div>
    <div>
      <span label ml-0.5>模式</span>
      <ButtonSelect v-model="selectedMode" :options="modeOptions" />
    </div>
  </div>

  <!-- 上传区 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div :class="selectedModel?.provider === 'Gemini' ? 'mb-4' : ''">
      <span label ml-0.5>上传图片</span>
      <ImageUploader v-model="image" />
    </div>
    <Select v-if="selectedModel?.provider === 'Gemini'" v-model="uploadType" :options="analyseMethodOptions" />
  </div>

  <!-- 分析按钮 -->
  <Button
    :loading="analyseButtonLoading" :disabled="analyseButtonDisabled"
    :disable-on-loading="true"
    loading-text="分析中..." @click="handleAnalyseButtonClick"
  >
    分析
  </Button>

  <!-- 结果区 -->
  <template v-if="result !== '' || errorMsg !== ''">
    <div mt-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
      <div flex="~ items-center gap-2" mb-4>
        <div
          w-1 h-6 rounded-full
          :class="errorMsg !== '' ? 'bg-red-500' : 'bg-teal-500'"
        />
        <span text-lg font-semibold>分析结果</span>
      </div>

      <div
        v-if="errorMsg !== ''"
        p="x-4 y-3" rounded-lg
        whitespace-pre-wrap font-bold
        class="bg-red-400 text-white"
      >
        {{ errorMsg }}
      </div>

      <div
        v-if="result !== ''"
        select-text
      >
        <MarkdownRenderer :content="result" />
      </div>
    </div>

    <div v-if="result !== ''" mt-3>
      <Button
        :disabled="saveButtonDisabled" disabled-text="已保存"
        @click="handleSaveButtonClick"
      >
        保存结果
      </Button>
    </div>
  </template>
</template>

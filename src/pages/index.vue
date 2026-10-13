<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import Button from '~/components/Button.vue'
import ImageUploader from '~/components/ImageUploader.vue'
import MarkdownRenderer from '~/components/MarkdownRenderer.vue'
import Select from '~/components/Select.vue'
import { useAnalyse } from '~/composables/useAnalyse'
import { useChangelog } from '~/composables/useChangelog'
import { useHistory } from '~/composables/useHistory'
import { version } from '../../package.json'

defineOptions({
  name: 'IndexPage',
})

const {
  image,
  base64Image,
  imageMimeType,
  selectedProviderId,
  selectedModelId,
  selectedPromptId,
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
  restoreFromHistory,
} = useAnalyse()

const { entries: historyEntries, isReady: historyReady, quotaWarning } = useHistory()
const { hasUnseen, openChangelog } = useChangelog()

// 刷新后是否展示了一次「已恢复」提示
const restoredNotice = ref(false)

// 误刷新恢复：仅在本次会话还没产出结果时，自动接上一次的分析
onMounted(async () => {
  // 等 IndexedDB 读完，否则 entries 还是空的
  if (!historyReady.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(historyReady, (v) => {
        if (v) { stop(); resolve() }
      })
    })
  }
  if (result.value || analyseButtonLoading.value)
    return
  const latest = historyEntries.value[0]
  if (!latest)
    return
  restoreFromHistory(latest)
  restoredNotice.value = true
})

// 正在生成 或 已有结果但未保存 时，离开路由需确认
const hasUnsavedWork = computed(() =>
  analyseButtonLoading.value || (result.value !== '' && !saveButtonDisabled.value),
)

onBeforeRouteLeave(() => {
  if (!hasUnsavedWork.value)
    return true
  const message = analyseButtonLoading.value
    ? '正在生成结果，离开页面将中断本次分析，确定要离开吗？'
    : '当前结果尚未保存，离开页面后将丢失，确定要离开吗？'
  const ok = window.confirm(message)
  // 确认离开时真的中断请求，而不是把它丢在后台继续跑
  if (ok && analyseButtonLoading.value)
    cancelAnalyse()
  return ok
})

// 组件卸载（含直接关闭标签页）时同样中断，避免请求悬空
onBeforeUnmount(() => {
  if (analyseButtonLoading.value)
    cancelAnalyse()
})
</script>

<template>
  <div mb-6 text-left px-1>
    <h1 text-3xl font-bold flex="~ items-center" gap-2>
      Fuck or Not
      <!-- 版本号兼作更新历史入口；有新版本时带一个未读小点 -->
      <button
        relative cursor-pointer font-mono font-normal text-xs px-2 py-0.5 rounded-full
        class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-400/20 hover:bg-emerald-500/20 transition-colors duration-200"
        :title="hasUnseen ? '有新版本，点击查看更新历史' : '查看更新历史'"
        @click="openChangelog"
      >
        v{{ version }}
        <span
          v-if="hasUnseen"
          class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-teal-500"
        />
      </button>
    </h1>
    <p text-sm op-50 mt-1>
      上还是不上？
    </p>
  </div>

  <!-- 刷新恢复提示 -->
  <div
    v-if="restoredNotice"
    mb-4 rounded-lg border="~ base" px-4 py-2 text-xs op-70 text-left
    flex="~ items-center justify-between gap-3"
  >
    <span>
      已恢复上次未保存的分析结果，可在
      <router-link to="/history" class="underline hover:text-teal-600">
        会话历史
      </router-link>
      中查看全部记录。
    </span>
    <button text-xs op-50 hover:op-100 cursor-pointer @click="restoredNotice = false">
      知道了
    </button>
  </div>

  <!-- 历史存储告警 -->
  <div
    v-if="quotaWarning"
    mb-4 rounded-lg px-4 py-2 text-xs text-left
    class="bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-300"
  >
    {{ quotaWarning }}
  </div>

  <!-- 配置区 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <div mb-5>
      <span label ml-0.5>供应商</span>
      <Select v-model="selectedProviderId" :options="providerSelectOptions" />
    </div>
    <div mb-5>
      <span label ml-0.5>模型</span>
      <Select v-model="selectedModelId" :options="modelSelectOptions" />
    </div>
    <div>
      <span label ml-0.5>Prompt</span>
      <Select v-model="selectedPromptId" :options="promptSelectOptions" />
    </div>
  </div>

  <!-- 上传区 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <span label ml-0.5>上传图片</span>
    <!-- 载入的文件图把 bytes 通过 props 传进去，modelValue 只表示 File 或外链 -->
    <ImageUploader
      v-model="image"
      :inline-base64="base64Image"
      :inline-mime-type="imageMimeType"
    />
  </div>

  <!-- 额外提示词 -->
  <div mb-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
    <span label block mb-3>额外提示词（可选）</span>

    <!-- 标签栏 -->
    <div v-if="additionalPromptPresets.length > 0" flex="~ wrap" gap-2 mb-3>
      <span
        v-for="preset in additionalPromptPresets"
        :key="preset.id"
        flex="~ items-center"
      >
        <button
          flex="~ items-center" px-3 py-1.5 rounded-l-lg
          text-xs border="~ base r-transparent" transition-colors duration-200
          :class="selectedAdditionalPresetId === preset.id
            ? 'bg-teal-500/10 border-teal-500 text-teal-700 dark:text-teal-300'
            : 'bg-transparent hover:border-teal-400'"
          :title="preset.content"
          @click="handleSelectPreset(preset.id)"
        >
          <span max-w-32 truncate>{{ preset.name }}</span>
        </button>
        <button
          flex="~ items-center justify-center" px-1.5 py-1.5 rounded-r-lg
          text-xs border="~ l-transparent base"
          bg-transparent
          op-40 hover="op-100"
          transition-colors duration-200
          :title="`删除「${preset.name}」`"
          @click="handleDeletePreset(preset.id)"
        >×</button>
      </span>
    </div>

    <!-- textarea -->
    <textarea
      v-model="additionalPrompt"
      placeholder="描述图片细节或补充说明，帮助 AI 更好地理解和分析......"
      rows="3"
      w-full px-3 py-2 rounded-lg
      border="~ base focus:teal-600"
      bg="transparent"
      outline="none"
      resize-y
      transition-colors duration-200
      mb-2
    />

    <!-- 保存按钮 -->
    <div flex justify-end mt-1>
      <button
        v-if="additionalPrompt.trim()"
        text-xs text-white font-bold rounded-md px-4 py-2
        bg-teal-600 hover:bg-teal-700
        cursor-pointer transition-colors duration-200
        @click="handleSaveAsPreset"
      >
        保存为预设
      </button>
    </div>
  </div>

  <!-- 分析按钮 -->
  <Button
    :loading="analyseButtonLoading" :disabled="analyseButtonDisabled"
    :disable-on-loading="true"
    loading-text="分析中..." @click="handleAnalyseButtonClick"
  >
    分析
  </Button>

  <!-- 取消：生成过程中才出现，避免占用平时布局 -->
  <div v-if="analyseButtonLoading" flex justify-end mt-2>
    <button
      text-xs rounded-md px-3 py-1.5 border="~ base"
      op-60 hover="op-100 border-red-400 text-red-500"
      transition-colors duration-200 cursor-pointer
      @click="cancelAnalyse"
    >
      停止生成
    </button>
  </div>

  <!-- 已取消提示：结果仍可保存 -->
  <div
    v-else-if="analyseAborted && result !== ''"
    mt-2 text-xs op-50 text-left
  >
    已停止生成，下面是已完成的部分，可以直接保存。
  </div>

  <!-- 结果区 -->
  <template v-if="result !== '' || errorMsg !== ''">
    <div mt-4 rounded-xl border="~ base" bg="white dark:black" p-6 text-left>
      <div flex="~ items-center justify-between gap-2" mb-4>
        <div flex="~ items-center gap-2">
          <div
            w-1 h-6 rounded-full
            :class="errorMsg !== '' ? 'bg-red-500' : 'bg-teal-500'"
          />
          <span text-lg font-semibold>分析结果</span>
        </div>

        <!-- 编辑/确认/取消按钮 -->
        <div v-if="result !== ''" flex="~ gap-2">
          <template v-if="isEditingResult">
            <button
              text-xs text-white font-bold rounded-md px-4 py-2
              bg-teal-600 hover:bg-teal-700
              cursor-pointer transition-colors duration-200
              @click="handleConfirmEditResult"
            >
              确认编辑
            </button>
            <button
              text-xs text-white font-bold rounded-md px-4 py-2
              bg-red-400 hover:bg-red-500
              cursor-pointer transition-colors duration-200
              @click="handleCancelEditResult"
            >
              取消
            </button>
          </template>
          <button
            v-else
            text-xs text-white font-bold rounded-md px-4 py-2
            bg-teal-600 hover:bg-teal-700
            cursor-pointer transition-colors duration-200
            @click="handleStartEditResult"
          >
            编辑结果
          </button>
        </div>
      </div>

      <div
        v-if="errorMsg !== ''"
        p="x-4 y-3" rounded-lg
        whitespace-pre-wrap font-bold
        class="bg-red-400 text-white"
      >
        {{ errorMsg }}
      </div>

      <div v-if="result !== ''">
        <textarea
          v-if="isEditingResult"
          v-model="editedResultText"
          rows="12"
          w-full px-3 py-2 rounded-lg
          border="~ base focus:teal-600"
          bg="transparent"
          outline="none"
          resize-y
          transition-colors duration-200
        />
        <div
          v-else
          select-text
        >
          <MarkdownRenderer :content="result" />
        </div>
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

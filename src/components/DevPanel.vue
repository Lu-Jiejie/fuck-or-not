<script setup lang="ts">
// 开发测试面板（仅 dev 模式挂载，见 App.vue）。
// 平时只是一个右下角悬浮球，点开是可拖动的浮窗，收起后恢复「纯产品态」。
import { onClickOutside, useDraggable, useStorage } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useAnalyse } from '~/composables/useAnalyse'
import { useHistory } from '~/composables/useHistory'
import {
  makeHistoryFixtures,
  STREAM_FIXTURE,
  TEST_NOVEL,
  TEST_NOVEL_BOLD_TITLE,
  TEST_SHORT,
  TEST_XSS_PAYLOAD,
} from '~/logic/devFixtures'

const {
  result,
  errorMsg,
  analyseButtonLoading,
  injectFakeResult,
  simulateStream,
  abortStream,
} = useAnalyse()

const { pushHistory, clearHistory, entries: historyEntries } = useHistory()

// 造历史记录：按钮会往真实历史里写数据，随后可在 /history 查看效果
const historyBusy = ref(false)

async function addHistoryFixtures(count: number, withImage = true) {
  if (historyBusy.value)
    return
  historyBusy.value = true
  try {
    for (const item of makeHistoryFixtures(count, { withImage }))
      await pushHistory(item)
  }
  catch (e) {
    console.error('[DevPanel] 写入历史失败', e)
  }
  finally {
    historyBusy.value = false
  }
}

async function clearAllHistory() {
  if (!window.confirm('（dev）确定清空全部历史记录？'))
    return
  await clearHistory()
}

const isOpen = useStorage('dev-panel-open', false)

// ── 浮窗拖动 ──
const panelRef = ref<HTMLElement | null>(null)
const { x, y } = useDraggable(panelRef, {
  initialValue: { x: -1, y: -1 },
  preventDefault: true,
})

// 点击面板外部即收起；面板打开时悬浮球并不存在，不会被误判成「外部」
onClickOutside(panelRef, () => {
  isOpen.value = false
})

const panelStyle = computed(() => {
  // x/y 为 -1 表示尚未拖动过，交给 CSS 的默认右下角定位
  if (x.value < 0 || y.value < 0)
    return {}
  return { left: `${x.value}px`, top: `${y.value}px`, right: 'auto', bottom: 'auto' }
})

// ── 流式参数 ──
const streamChunkSize = useStorage('dev-stream-chunk-size', 4)
const streamInterval = useStorage('dev-stream-interval', 40)

const streamState = ref<'idle' | 'running' | 'aborted' | 'done'>('idle')
let abortedThisRun = false // 本轮是否被主动中断，由 runStream 读取
const lastStreamText = ref(STREAM_FIXTURE) // 最近一次流式文本，用于估算块数与耗时

// 长文在默认参数下要跑几十秒，先给出规模预估
const streamPlan = computed(() => {
  const size = Number(streamChunkSize.value) || 4
  const interval = Number(streamInterval.value) || 40
  const blocks = Math.ceil(lastStreamText.value.length / size)
  return {
    blocks,
    interval,
    seconds: Math.round((blocks * interval) / 1000),
  }
})

async function runStream(text: string) {
  abortedThisRun = false
  lastStreamText.value = text
  streamState.value = 'running'
  await simulateStream(text, {
    chunkSize: Number(streamChunkSize.value) || 4,
    interval: Number(streamInterval.value) || 40,
  })
  streamState.value = abortedThisRun ? 'aborted' : 'done'
}

function handleAbort() {
  abortedThisRun = true
  abortStream()
}

function useFixture(text: string) {
  streamState.value = 'idle'
  injectFakeResult(text)
}

function clearResult() {
  result.value = ''
  errorMsg.value = ''
}

const statusColor = computed(() => {
  if (errorMsg.value)
    return 'bg-red-500'
  if (analyseButtonLoading.value)
    return 'bg-amber-500'
  if (result.value)
    return 'bg-teal-500'
  return 'bg-gray-400'
})

const resultStats = computed(() => {
  const text = result.value ?? ''
  return {
    chars: text.length,
    lines: text ? text.split('\n').length : 0,
  }
})
</script>

<template>
  <!-- 悬浮球：收起状态，不干扰真实 UI -->
  <button
    v-if="!isOpen"
    fixed right-3 bottom-16 z-500
    w-9 h-9 rounded-full cursor-pointer
    flex items-center justify-center
    border="~ base" bg="white dark:black"
    op-40 hover:op-100 transition-opacity duration-200
    title="打开开发测试面板"
    @click="isOpen = true"
  >
    <span :class="statusColor" absolute top-1 right-1 w-1.5 h-1.5 rounded-full />
    <div i-carbon-tool-kit text-sm />
  </button>

  <!-- 面板 -->
  <div
    v-else
    ref="panelRef"
    fixed right-3 bottom-3 z-500 w-80
    rounded-xl border="~ base" bg="white dark:black"
    text="left gray-700 dark:gray-200"
    shadow-lg overflow-hidden
    :style="panelStyle"
  >
    <!-- 标题栏（拖动把手） -->
    <div
      flex="~ items-center justify-between gap-2" px-3 py-2
      border="b base" cursor-grab active:cursor-grabbing select-none
      bg="gray-50 dark:gray-900"
    >
      <div flex="~ items-center gap-2" min-w-0>
        <div :class="statusColor" w-1 h-4 rounded-full />
        <span text-sm font-semibold truncate>Dev 测试面板</span>
      </div>
      <button icon-btn shrink-0 title="收起" @click="isOpen = false">
        <div i-carbon-close />
      </button>
    </div>

    <div class="max-h-[70vh]" overflow-y-auto p-3 flex="~ col" gap-4 text-xs>
      <!-- 状态 -->
      <div flex="~ items-center justify-between" op-60>
        <span>结果 {{ resultStats.chars }} 字 / {{ resultStats.lines }} 行</span>
        <span v-if="analyseButtonLoading" text-amber-600>
          生成中…
        </span>
        <span v-else-if="streamState === 'aborted'" text-gray-500>
          已中断
        </span>
        <span v-else-if="streamState === 'done'" text-teal-600>
          流式完成
        </span>
        <span v-else-if="errorMsg" text-red-500>
          有错误
        </span>
      </div>

      <!-- 流式输出 -->
      <div>
        <div label mb-2>
          测试流式输出
        </div>
        <div flex="~ gap-2 wrap">
          <button
            class="btn text-xs" :disabled="analyseButtonLoading"
            @click="runStream(STREAM_FIXTURE)"
          >
            流式（长文）
          </button>
          <button
            class="btn text-xs" :disabled="analyseButtonLoading"
            @click="runStream(TEST_NOVEL)"
          >
            流式（小说）
          </button>
          <button
            v-if="analyseButtonLoading"
            class="btn text-xs !bg-red-500 hover:!bg-red-600"
            @click="handleAbort"
          >
            中断
          </button>
        </div>

        <div flex="~ items-center gap-3" mt-3 op-70>
          <label flex="~ items-center gap-1">
            <span>块大小</span>
            <input
              v-model="streamChunkSize" type="number" min="1" max="200"
              class="w-14 px-1.5 py-0.5 rounded border border-base bg-transparent outline-none focus:border-teal-600"
            >
          </label>
          <label flex="~ items-center gap-1">
            <span>间隔ms</span>
            <input
              v-model="streamInterval" type="number" min="0" max="2000" step="10"
              class="w-14 px-1.5 py-0.5 rounded border border-base bg-transparent outline-none focus:border-teal-600"
            >
          </label>
        </div>
        <p mt-2 op-50 leading-relaxed>
          {{ streamPlan.blocks }} 块 × {{ streamPlan.interval }}ms ≈ {{ streamPlan.seconds }} 秒。
          把块大小设为 1、间隔设为 0 可测极端情况。
        </p>
      </div>

      <!-- 静态填充 -->
      <div>
        <div label mb-2>
          直接填充结果
        </div>
        <div flex="~ gap-2 wrap">
          <button class="btn text-xs" @click="useFixture(TEST_NOVEL)">
            ## 标题小说
          </button>
          <button class="btn text-xs" @click="useFixture(TEST_NOVEL_BOLD_TITLE)">
            ** 加粗标题
          </button>
          <button class="btn text-xs" @click="useFixture(TEST_SHORT)">
            短结果
          </button>
          <button class="btn text-xs" @click="useFixture('')">
            空结果
          </button>
        </div>
      </div>

      <!-- 历史记录 -->
      <div>
        <div label mb-2>
          历史记录（当前 {{ historyEntries.length }} 条）
        </div>
        <div flex="~ gap-2 wrap">
          <button
            class="btn text-xs" :disabled="historyBusy"
            @click="addHistoryFixtures(1)"
          >
            加 1 条
          </button>
          <button
            class="btn text-xs" :disabled="historyBusy"
            @click="addHistoryFixtures(3)"
          >
            加 3 条
          </button>
          <button
            class="btn text-xs" :disabled="historyBusy"
            @click="addHistoryFixtures(5)"
          >
            加满 5 条
          </button>
          <button
            class="btn text-xs !bg-gray-500" :disabled="historyBusy"
            @click="addHistoryFixtures(2, false)"
          >
            加 2 条（无图）
          </button>
          <button
            class="btn text-xs !bg-red-500 hover:!bg-red-600" :disabled="historyBusy"
            @click="clearAllHistory"
          >
            清空历史
          </button>
        </div>
        <p mt-2 op-50 leading-relaxed>
          写入后到
          <router-link to="/history" class="underline hover:text-teal-600">
            /history
          </router-link>
          查看。条数上限 5，超出会挤掉最旧的。
        </p>
      </div>

      <!-- 安全 / 边界 -->
      <div>
        <div label mb-2>
          安全与边界
        </div>
        <div flex="~ gap-2 wrap">
          <button class="btn text-xs" @click="useFixture(TEST_XSS_PAYLOAD)">
            XSS 载荷
          </button>
          <button
            class="btn text-xs"
            @click="errorMsg = '这是一条模拟错误信息（dev）'; result = ''"
          >
            模拟报错
          </button>
          <button class="btn text-xs !bg-gray-500" @click="clearResult">
            清空
          </button>
        </div>
      </div>

      <!-- 说明 -->
      <p border="t base" pt-3 op-50 leading-relaxed>
        测试数据都经过真实状态机，保存/编辑/收藏流程与真实分析一致。
        面板本身不影响产品界面判断。
      </p>
    </div>
  </div>
</template>

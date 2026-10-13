<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import HistoryItem from '~/components/HistoryItem.vue'
import { useAnalyse } from '~/composables/useAnalyse'
import { useHistory } from '~/composables/useHistory'

defineOptions({
  name: 'HistoryPage',
})

const router = useRouter()
const { restoreFromHistory } = useAnalyse()
const { entries, isReady, quotaWarning, clearHistory } = useHistory()

// 最多 5 条，不需要分页；只保留排序切换
const sortOrder = ref<'newest' | 'oldest'>('newest')

const sortedEntries = computed(() => {
  const list = [...entries.value]
  list.sort((a, b) => (sortOrder.value === 'oldest' ? a.time - b.time : b.time - a.time))
  return list
})

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
}

function onRestore(entry: Parameters<typeof restoreFromHistory>[0]) {
  restoreFromHistory(entry)
  router.push('/')
}

async function onClearAll() {
  if (!confirm('确定要清空全部历史记录吗？已收藏的内容不受影响。'))
    return
  await clearHistory()
}
</script>

<template>
  <div mb-6 text-left px-1>
    <h1 text-3xl font-bold>
      会话历史
    </h1>
    <p text-sm op-50 mt-1>
      最近 24 小时的分析记录，最多保留 5 条
    </p>
  </div>

  <!-- 存储告警 -->
  <div
    v-if="quotaWarning"
    mb-4 rounded-lg px-4 py-2 text-xs text-left
    class="bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-300"
  >
    {{ quotaWarning }}
  </div>

  <Transition name="fade">
    <div
      :key="isReady ? (entries.length > 0 ? 'list' : 'empty') : 'loading'"
    >
      <template v-if="!isReady" />

      <!-- 有数据 -->
      <template v-else-if="entries.length > 0">
        <div mb-3 flex="~ items-center justify-between gap-2">
          <span text-sm op-60>共 {{ entries.length }} 条</span>
          <button
            type="button"
            flex="~ items-center gap-1.5" px-3 py-1.5 text-sm
            border="~ base rounded-lg"
            cursor-pointer hover:border-teal-600 transition-colors duration-200
            @click="toggleSortOrder"
          >
            <div :class="sortOrder === 'newest' ? 'i-carbon-arrow-down' : 'i-carbon-arrow-up'" />
            {{ sortOrder === 'newest' ? '最新优先' : '最旧优先' }}
          </button>
        </div>

        <TransitionGroup name="list" tag="div">
          <HistoryItem
            v-for="item in sortedEntries"
            :key="item.id"
            :item="item"
            @restore="onRestore(item)"
          />
        </TransitionGroup>

        <div
          mt-2 rounded-xl border="~ base" bg="white dark:black" px-4 py-3
          flex="~ items-center justify-end gap-3 wrap"
        >
          <button
            flex="~ items-center gap-2" px-4 py-2 rounded-lg text-sm font-medium
            border="~ base" cursor-pointer transition-colors duration-200
            class="hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-950 dark:hover:border-red-800"
            @click="onClearAll"
          >
            <div i-carbon-trash-can />
            清空历史
          </button>
        </div>
      </template>

      <!-- 空 -->
      <template v-else>
        <div
          rounded-xl border="~ base" bg="white dark:black"
          flex flex-col items-center justify-center
          min-h-60 mb-4
        >
          <div class="i-carbon-time text-4xl mb-3 op-30" />
          <div text-base font-medium op-40>
            暂无历史记录
          </div>
        </div>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0, 0.1, 1);
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
</style>

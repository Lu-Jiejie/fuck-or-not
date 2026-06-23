<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Pagination from '~/components/Pagination.vue'

const props = defineProps<{
  total: number
}>()

const page = defineModel<number>('page', { required: true })
const pageSize = defineModel<number>('pageSize', { required: true })
const sortOrder = defineModel<'newest' | 'oldest'>('sortOrder', { required: true })

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / pageSize.value)))

const pageSizeInput = ref(String(pageSize.value))
watch(pageSize, v => (pageSizeInput.value = String(v)))

function applyPageSize() {
  const n = Number.parseInt(pageSizeInput.value, 10)
  if (!Number.isNaN(n) && n >= 1 && n <= 100)
    pageSize.value = n
  else
    pageSizeInput.value = String(pageSize.value)
}

const jumpInput = ref('')
function handleJump() {
  const p = Number.parseInt(jumpInput.value, 10)
  if (!Number.isNaN(p) && p >= 1 && p <= pageCount.value)
    page.value = p
  jumpInput.value = ''
}

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
}
</script>

<template>
  <div
    rounded-xl border="~ base" bg="white dark:black" px-4 py-3
    flex="~ col gap-3"
  >
    <!-- 分页器 -->
    <div flex justify-center>
      <Pagination v-model="page" :page-size="pageSize" :total="total" />
    </div>

    <!-- 控件行 -->
    <div flex="~ wrap items-center justify-center gap-x-4 gap-y-2" text-sm>
      <label flex="~ items-center gap-1">
        <span op-60>每页</span>
        <input
          v-model="pageSizeInput"
          type="text"
          inputmode="numeric"
          class="w-10 px-1 py-0.5 text-center rounded outline-none transition-colors duration-200 border border-base bg-transparent focus:border-teal-600"
          @keyup.enter="applyPageSize"
          @blur="applyPageSize"
        >
        <span op-60>条</span>
      </label>

      <div v-if="pageCount > 1" flex="~ items-center gap-1">
        <span op-60>跳至</span>
        <input
          v-model="jumpInput"
          type="text"
          inputmode="numeric"
          :placeholder="String(page)"
          class="w-10 px-1 py-0.5 text-center rounded outline-none transition-colors duration-200 border border-base bg-transparent focus:border-teal-600"
          @keyup.enter="handleJump"
        >
        <span op-60>/ {{ pageCount }}</span>
      </div>

      <button
        type="button"
        flex="~ items-center gap-1.5" px-3 py-1.5
        border="~ base rounded-lg"
        cursor-pointer hover:border-teal-600 transition-colors duration-200
        @click="toggleSortOrder"
      >
        <div :class="sortOrder === 'newest' ? 'i-carbon-arrow-down' : 'i-carbon-arrow-up'" />
        {{ sortOrder === 'newest' ? '最新优先' : '最旧优先' }}
      </button>
    </div>
  </div>
</template>

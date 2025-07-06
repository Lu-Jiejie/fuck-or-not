<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  total: number
  pageSize: number
  pagerCount?: number
}>(), {
  pagerCount: 5,
})
const modelValue = defineModel<number>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const currentPage = computed({
  get: () => modelValue.value ?? 1,
  set: v => modelValue.value = v,
})
const pagerCount = computed(() => Math.max(5, props.pagerCount))

function prev() {
  if ((currentPage.value ?? 1) > 1) {
    currentPage.value = (currentPage.value ?? 1) - 1
  }
}
function next() {
  if ((currentPage.value ?? 1) < pageCount.value) {
    currentPage.value = (currentPage.value ?? 1) + 1
  }
}
function goTo(page: number) {
  if (page >= 1 && page <= pageCount.value) {
    currentPage.value = page
  }
}

const pages = computed(() => {
  const total = pageCount.value
  const cur = currentPage.value ?? 1
  const pager = pagerCount.value

  // show all pages if total is less than or equal to pager
  if (total <= pager) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  // always show first page
  const arr: (number | string)[] = [1]

  let left = Math.max(2, cur - Math.floor((pager - 2) / 2))
  const right = Math.min(total - 1, left + pager - 3)
  left = Math.max(2, right - (pager - 3))

  if (left > 2) {
    arr.push('...')
  }

  for (let i = left; i <= right; i++) {
    arr.push(i)
  }

  if (right < total - 1) {
    arr.push('...')
  }
  // always show last page
  arr.push(total)
  return arr
})
</script>

<template>
  <nav flex items-center justify-center gap-2>
    <button
      :disabled="currentPage === 1"
      transition duration-200
      :class="[
        currentPage === 1
          ? 'opacity-50'
          : 'opacity-80 hover:text-teal-600 cursor-pointer',
      ]"
      aria-label="上一页"
      @click="prev"
    >
      <div i-carbon-chevron-left />
    </button>
    <template v-for="p in pages" :key="p">
      <button
        v-if="typeof p === 'number'"
        px-2 py-1 rounded text-sm
        :class="[
          p === currentPage
            ? 'text-teal-600 font-bold'
            : 'hover:text-teal-600 cursor-pointer',
        ]"
        :disabled="p === currentPage"
        @click="goTo(p)"
      >
        {{ p }}
      </button>
      <span v-else i-carbon-overflow-menu-horizontal px-2 opacity-50 select-none />
    </template>
    <button
      :disabled="currentPage === pageCount"
      transition duration-200
      :class="[
        currentPage === pageCount
          ? 'opacity-50'
          : 'opacity-80 hover:text-teal-600 cursor-pointer',
      ]"
      aria-label="下一页"
      @click="next"
    >
      <div i-carbon-chevron-right />
    </button>
  </nav>
</template>

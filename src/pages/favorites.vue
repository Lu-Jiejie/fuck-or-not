<script setup lang="ts">
import type { FavoriteResult } from '~/types'
import { useStorage } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import FavoritesItem from '~/components/FavoritesItem.vue'
import FavoritesToolbar from '~/components/FavoritesToolbar.vue'
import { deleteImageIfUnused, imageStore } from '~/logic'

const router = useRouter()
// const isMobile = useMediaQuery('(max-width: 768px)')
const isMobile = true

const favoriteResults = useIDBKeyval<FavoriteResult[] | undefined>('favorite-results', undefined)
const sortOrder = useStorage<'newest' | 'oldest'>('favorites-sort-order', 'newest')

const sortedResults = computed(() => {
  if (!favoriteResults.data.value)
    return []
  const sorted = [...favoriteResults.data.value]
  if (sortOrder.value === 'oldest') {
    sorted.sort((a, b) => a.time - b.time)
  }
  else {
    sorted.sort((a, b) => b.time - a.time)
  }
  return sorted
})

const pageSize = useStorage('favorites-page-size', 5)
const page = ref(1)

const pageCount = computed(() => Math.max(1, Math.ceil((favoriteResults.data.value?.length ?? 0) / pageSize.value)))

// 每页条数变化时，确保当前页不越界
watch(pageSize, () => {
  if (page.value > pageCount.value)
    page.value = pageCount.value
})

const pagedResults = computed(() => {
  if (!sortedResults.value.length)
    return []
  const start = (page.value - 1) * pageSize.value
  return sortedResults.value.slice(start, start + pageSize.value)
})

function onDelete(time: number) {
  if (!confirm('确定要删除这个收藏吗？')) {
    return
  }
  const idx = favoriteResults.data.value?.findIndex(item => item.time === time) ?? -1
  if (idx !== -1) {
    const hash = favoriteResults.data.value![idx].imageHash
    favoriteResults.data.value?.splice(idx, 1)
    const usedHashes = new Set(favoriteResults.data.value?.map(i => i.imageHash) ?? [])
    deleteImageIfUnused(hash, usedHashes)
  }
  nextTick(() => {
    const total = favoriteResults.data.value?.length ?? 0
    const maxPage = Math.max(1, Math.ceil(total / pageSize))
    if (page.value > maxPage) {
      page.value = maxPage
    }
  })
}

function onUpdate(time: number, result: string) {
  const idx = favoriteResults.data.value?.findIndex(item => item.time === time) ?? -1
  if (idx !== -1) {
    favoriteResults.data.value![idx].result = result
  }
}

function onDeleteAll() {
  if (!confirm('确定要删除所有收藏吗？')) {
    return
  }
  favoriteResults.data.value = []
  imageStore.data.value = {}
  page.value = 1
}

function navigateToSettings() {
  router.push('/settings')
  // 等待路由跳转完成后滚动到页面底部
  nextTick(() => {
    setTimeout(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      })
    }, 100)
  })
}
</script>

<template>
  <div mb-6 text-left px-1>
    <h1 text-3xl font-bold>
      收藏夹
    </h1>
    <p text-sm op-50 mt-1>
      浏览和管理你保存的分析结果
    </p>
  </div>

  <Transition name="fade">
    <div
      :key="favoriteResults.data.value === undefined
        ? 'loading'
        : favoriteResults.data.value.length > 0
          ? 'list'
          : 'empty'"
    >
      <!-- loading: fix the sudden change of favorite results -->
      <template v-if="favoriteResults.data.value === undefined">
        <!-- <div text-center py-10 text-gray-400 flex flex-col items-center>
          <div class="i-carbon-circle-dash animate-spin text-2xl mb-2" />
          加载中...
        </div> -->
      </template>

      <!-- has data -->
      <template v-else-if="favoriteResults.data.value.length > 0">
        <!-- 顶部工具栏 -->
        <div mb-4>
          <FavoritesToolbar
            v-model:page="page"
            v-model:page-size="pageSize"
            v-model:sort-order="sortOrder"
            :total="favoriteResults.data.value.length"
          />
        </div>

        <TransitionGroup name="list" tag="div">
          <FavoritesItem
            v-for="item in pagedResults"
            :key="item.time"
            :item="item"
            :is-mobile="isMobile"
            @delete="onDelete(item.time)"
            @update="(result: string) => onUpdate(item.time, result)"
          />
        </TransitionGroup>

        <!-- 底部工具栏 -->
        <div mt-4 mb-2>
          <FavoritesToolbar
            v-model:page="page"
            v-model:page-size="pageSize"
            v-model:sort-order="sortOrder"
            :total="favoriteResults.data.value.length"
          />
        </div>

        <!-- 底部操作 -->
        <div
          mt-2 rounded-xl border="~ base" bg="white dark:black" px-4 py-3
          flex="~ items-center gap-3 wrap"
        >
          <button
            flex="~ items-center gap-2" px-4 py-2 rounded-lg text-sm font-medium
            border="~ base" cursor-pointer transition-colors duration-200
            hover:bg-gray-100 dark:hover:bg-gray-900
            @click="navigateToSettings"
          >
            <div i-carbon-upload />
            导入收藏
          </button>
          <button
            flex="~ items-center gap-2" px-4 py-2 rounded-lg text-sm font-medium
            border="~ base" cursor-pointer transition-colors duration-200
            hover:bg-gray-100 dark:hover:bg-gray-900
            @click="navigateToSettings"
          >
            <div i-carbon-download />
            导出收藏
          </button>
          <button
            flex="~ items-center gap-2" px-4 py-2 rounded-lg text-sm font-medium
            border="~ base" cursor-pointer transition-colors duration-200
            class="hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-950 dark:hover:border-red-800"
            @click="onDeleteAll"
          >
            <div i-carbon-trash-can />
            删除所有
          </button>
        </div>
      </template>

      <!-- empty -->
      <template v-else>
        <div
          rounded-xl border="~ base" bg="white dark:black"
          flex flex-col items-center justify-center
          min-h-60 mb-4
        >
          <div class="i-carbon-bookmark text-4xl mb-3 op-30" />
          <div text-base font-medium op-40 mb-4>
            暂无收藏
          </div>
          <button
            flex="~ items-center gap-2" px-4 py-2 rounded-lg text-sm font-medium
            border="~ base" cursor-pointer transition-colors duration-200
            hover:bg-gray-100 dark:hover:bg-gray-900
            @click="navigateToSettings"
          >
            <div i-carbon-upload />
            导入收藏
          </button>
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

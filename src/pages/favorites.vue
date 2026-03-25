<script setup lang="ts">
import type { FavoriteResult, LegacyFavoriteResult } from '~/types'
import { useMediaQuery, useStorage } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { computed, nextTick, ref } from 'vue'
import FavoritesItem from '~/components/FavoritesItem.vue'
import Pagination from '~/components/Pagination.vue'
import { computeImageHash, deleteImageIfUnused, imageStore } from '~/logic'

const isMobile = useMediaQuery('(max-width: 768px)')

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

const pageSize = 5
const page = ref(1)
const paginationRef = ref<InstanceType<typeof Pagination> | null>(null)
const jumpInput = ref('')

const pageCount = computed(() => Math.max(1, Math.ceil((favoriteResults.data.value?.length ?? 0) / pageSize)))

const pagedResults = computed(() => {
  if (!sortedResults.value.length)
    return []
  const start = (page.value - 1) * pageSize
  return sortedResults.value.slice(start, start + pageSize)
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

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
}

function handleJump() {
  const p = Number.parseInt(jumpInput.value, 10)
  if (!Number.isNaN(p) && p >= 1 && p <= pageCount.value) {
    page.value = p
  }
  jumpInput.value = ''
}

function onDeleteAll() {
  if (!confirm('确定要删除所有收藏吗？')) {
    return
  }
  favoriteResults.data.value = []
  imageStore.data.value = {}
  page.value = 1
}

function onExportAll() {
  if (!favoriteResults.data.value || favoriteResults.data.value.length === 0) {
    return
  }
  if (!confirm('确定要导出所有收藏吗？')) {
    return
  }
  const exportData = {
    favorites: favoriteResults.data.value,
    images: imageStore.data.value,
  }
  const data = JSON.stringify(exportData, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `favorites-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const fileInputRef = ref<HTMLInputElement | null>(null)

function onImportClick() {
  if (!confirm('确定要导入收藏吗？已存在的收藏不会被覆盖。')) {
    return
  }
  fileInputRef.value?.click()
}

function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result as string)
      // 新格式：{ favorites, images }；旧格式：直接是数组
      const raw: (FavoriteResult | LegacyFavoriteResult)[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.favorites) ? parsed.favorites : null
      if (!raw) {
        alert('导入失败：文件格式不正确')
        return
      }
      // 合并图片数据
      if (parsed.images && typeof parsed.images === 'object') {
        imageStore.data.value = { ...imageStore.data.value, ...parsed.images }
      }
      const existingTimes = new Set(favoriteResults.data.value?.map(item => item.time) ?? [])
      const incoming = raw.filter(item => !existingTimes.has(item.time))
      if (incoming.length === 0) {
        alert('没有新的收藏可导入')
        return
      }
      // 迁移旧格式
      const migrated: FavoriteResult[] = []
      const newImages: Record<string, string> = { ...imageStore.data.value }
      for (const item of incoming) {
        if ('image' in item) {
          const hash = await computeImageHash(item.image)
          newImages[hash] = item.image
          newImages[`${hash}:mime`] = 'image/png'
          migrated.push({ model: item.model, mode: item.mode, imageHash: hash, mimeType: 'image/png', time: item.time, result: item.result })
        }
        else {
          migrated.push(item)
        }
      }
      imageStore.data.value = newImages
      favoriteResults.data.value = [...(favoriteResults.data.value ?? []), ...migrated]
        .sort((a, b) => b.time - a.time)
      alert(`成功导入 ${migrated.length} 条收藏`)
    }
    catch {
      alert('导入失败：文件解析错误')
    }
  }
  reader.readAsText(file)
  input.value = ''
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
        <!-- 工具栏 -->
        <div
          mb-4 rounded-xl border="~ base" bg="white dark:black" px-4 py-3
          flex="~ items-center justify-between gap-2 wrap"
        >
          <div flex="~ items-center gap-3">
            <Pagination
              ref="paginationRef"
              v-model="page"
              :page-size="pageSize"
              :total="favoriteResults.data.value.length"
            />
            <div v-if="pageCount > 5" flex items-center gap-1 text-sm>
              <input
                v-model="jumpInput"
                type="text"
                inputmode="numeric"
                :placeholder="String(page)"
                class="w-10 px-1 py-0.5 text-center rounded outline-none transition-colors duration-200 border border-base bg-transparent focus:border-teal-600"
                @keyup.enter="handleJump"
              >
              <span opacity-60>/ {{ pageCount }}</span>
            </div>
          </div>
          <button
            type="button"
            flex items-center gap-1.5 px-3 py-1.5
            border="~ base rounded-lg"
            text-sm cursor-pointer
            hover:border-teal-600 transition-colors duration-200
            @click="toggleSortOrder"
          >
            <div :class="sortOrder === 'newest' ? 'i-carbon-arrow-down' : 'i-carbon-arrow-up'" />
            {{ sortOrder === 'newest' ? '最新优先' : '最旧优先' }}
          </button>
        </div>

        <TransitionGroup name="list" tag="div">
          <FavoritesItem
            v-for="item in pagedResults"
            :key="item.time"
            :item="item"
            :is-mobile="isMobile"
            @delete="onDelete(item.time)"
          />
        </TransitionGroup>

        <!-- 底部操作 -->
        <div
          mt-2 rounded-xl border="~ base" bg="white dark:black" px-4 py-3
          flex="~ items-center gap-3 wrap"
        >
          <button
            flex="~ items-center gap-2" px-4 py-2 rounded-lg text-sm font-medium
            border="~ base" cursor-pointer transition-colors duration-200
            hover:bg-gray-100 dark:hover:bg-gray-900
            @click="onImportClick"
          >
            <div i-carbon-upload />
            导入收藏
          </button>
          <button
            flex="~ items-center gap-2" px-4 py-2 rounded-lg text-sm font-medium
            border="~ base" cursor-pointer transition-colors duration-200
            hover:bg-gray-100 dark:hover:bg-gray-900
            @click="onExportAll"
          >
            <div i-carbon-download />
            导出所有
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

        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          hidden
          @change="onImportFile"
        >
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
            @click="onImportClick"
          >
            <div i-carbon-upload />
            导入收藏
          </button>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          hidden
          @change="onImportFile"
        >
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

<script setup lang="ts">
import type { FavoriteResult } from '~/types'
import { useMediaQuery } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { computed, ref } from 'vue'
import Button from '~/components/Button.vue'
import FavoritesItem from '~/components/FavoritesItem.vue'
import Pagination from '~/components/Pagination.vue'

const isMobile = useMediaQuery('(max-width: 768px)')

const favoriteResults = useIDBKeyval<FavoriteResult[] | undefined>('favorite-results', undefined)

const pageSize = 5
const page = ref(1)
const pagedResults = computed(() => {
  if (!favoriteResults.data.value)
    return []
  const start = (page.value - 1) * pageSize
  return favoriteResults.data.value.slice(start, start + pageSize)
})

function onDelete(idx: number) {
  if (!confirm('确定要删除这个收藏吗？')) {
    return
  }
  favoriteResults.data.value?.splice(idx, 1)
}
</script>

<template>
  <h1 text-3xl font-bold>
    收藏夹
  </h1>
  <div py-4 />

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
        <Pagination
          v-model="page"
          :page-size="pageSize"
          :total="favoriteResults.data.value.length"
        />
        <div py-1 />

        <TransitionGroup name="list" tag="div">
          <FavoritesItem
            v-for="(item, idx) in pagedResults"
            :key="item.time"
            :item="item"
            :is-mobile="isMobile"
            @delete="onDelete((page - 1) * pageSize + idx)"
          />
        </TransitionGroup>

        <div py-4 />
        <Button color="red">
          删除所有收藏
        </Button>
      </template>

      <!-- empty -->
      <template v-else>
        <div
          p-4 mb-4
          border="~ base rounded-md"
          bg="light/80 dark:dark/80"
          flex flex-col items-center justify-center
          min-h-60
        >
          <div class="i-carbon-bookmark text-4xl mb-4 text-gray-500" />
          <div text-lg font-bold text-gray-500>
            暂无收藏
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

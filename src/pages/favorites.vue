<script setup lang="ts">
import type { FavoriteResult } from '~/types'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { computed, ref } from 'vue'
import Button from '~/components/Button.vue'
import FavoritesItem from '~/components/FavoritesItem.vue'
import Pagination from '~/components/Pagination.vue'

const favoriteResults = useIDBKeyval('favorite-results', [] as FavoriteResult[])

const pageSize = 1
const page = ref(1)
const pagedResults = computed(() => {
  const start = (page.value - 1) * pageSize
  return favoriteResults.data.value.slice(start, start + pageSize)
})

function onDelete(idx: number) {
  if (!confirm('确定要删除这个收藏吗？')) {
    return
  }
  favoriteResults.data.value.splice(idx, 1)

  // mock item
  // const item = [favoriteResults.data.value[0], favoriteResults.data.value[1]]
  // favoriteResults.data.value.push(...item)
  // favoriteResults.data.value.push(...item)
  // favoriteResults.data.value.push(...item)
  // favoriteResults.data.value.push(...item)
  // favoriteResults.data.value.push(...item)
  // favoriteResults.data.value.push(...item)
  // favoriteResults.data.value.push(...item)
  // favoriteResults.data.value.push(...item)
  // favoriteResults.data.value.push(...item)
}
</script>

<template>
  <div>
    <h1 text-3xl font-bold>
      收藏夹
    </h1>
    <div py-4 />

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
        @delete="onDelete((page - 1) * pageSize + idx)"
      />
    </TransitionGroup>

    <div py-4 />
    <Button
      color="red"
    >
      删除所有收藏
    </Button>
  </div>
</template>

<style scoped>
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

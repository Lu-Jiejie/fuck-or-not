<script setup lang="ts">
import type { FavoriteResult } from '~/types'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import FavoritesItem from '~/components/FavoritesItem.vue'

const favoriteResults = useIDBKeyval('favorite-results', [] as FavoriteResult[])
</script>

<template>
  <div>
    <h1 text-3xl font-bold>
      收藏夹
    </h1>
    <div py-4 />

    <FavoritesItem v-for="(item, idx) in favoriteResults.data.value" :key="idx" :item="item" />
  </div>
</template>

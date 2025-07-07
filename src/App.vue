<script setup lang="ts">
import type { Fn } from '@vueuse/core'
import { useEventListener } from '@vueuse/core'
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import Header from './components/Header.vue'
import ScrollJump from './components/ScrollJump.vue'

const imageModel = ref<HTMLImageElement>()

const cleanupWheel = ref<Fn>()
const cleanupTouchMove = ref<Fn>()

useEventListener('click', async (e) => {
  const path = Array.from(e.composedPath())
  const first = path[0] as HTMLImageElement

  if (first.tagName !== 'IMG' || !first.classList.contains('preview')) {
    return
  }

  // prevent preview image when it is moving
  // should not work if the image is the preview image in the uploader
  if (!first.classList.contains('image-uploader')) {
    const rect = first.getBoundingClientRect()
    await new Promise(resolve => setTimeout(resolve, 50))
    const newRect = first.getBoundingClientRect()
    if (rect.left !== newRect.left || rect.top !== newRect.top) {
      return
    }
  }

  imageModel.value = first
})

watch(imageModel, (val) => {
  if (val) {
    cleanupWheel.value = useEventListener('wheel', e => e.preventDefault(), { passive: false })
    cleanupTouchMove.value = useEventListener('touchmove', e => e.preventDefault(), { passive: false })
  }
  else {
    cleanupWheel.value?.()
    cleanupTouchMove.value?.()
  }
})

onBeforeUnmount(() => {
  cleanupWheel.value?.()
  cleanupTouchMove.value?.()
})
</script>

<template>
  <Header />
  <main
    font-sans p="t-3 l-3 r-3 b-10" m-auto max-w-180
    text="center gray-700 dark:gray-200" select-none
  >
    <RouterView />
    <!-- <TheFooter /> -->
    <ScrollJump />
  </main>

  <!-- Image Preview -->
  <Transition name="fade">
    <div
      v-if="imageModel" fixed
      top-0 left-0 right-0 bottom-0 z-999
      @touchmove.prevent
    >
      <div absolute top-0 left-0 right-0 bottom-0 bg-black:60 z--1 />
      <img
        :src="imageModel.src" :alt="imageModel.alt"
        max-w-screen max-h-screen w-full h-full object-contain
        origin-top-left
        @click="imageModel = undefined"
      >
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import TheFooter from './components/Footer.vue'

const imageModel = ref<HTMLImageElement>()

useEventListener('click', async (e) => {
  const path = Array.from(e.composedPath())
  const first = path[0] as HTMLImageElement

  console.log(path)
  if (first.tagName !== 'IMG' || !first.classList.contains('preview')) {
    return
  }

  // prevent preview image when it is moving
  // should not work if the image is the preview image in the uploader
  if (!first.classList.contains('image-uploader')) {
    const rect = first.getBoundingClientRect()
    await new Promise(resolve => setTimeout(resolve, 50))
    const newRect = first.getBoundingClientRect()
    console.log('rect', rect, newRect)
    if (rect.left !== newRect.left || rect.top !== newRect.top) {
      return
    }
  }

  imageModel.value = first
})

// prevent scroll when image preview
function preventScroll(e: Event) {
  e.preventDefault()
}

watch(imageModel, (val) => {
  if (val) {
    window.addEventListener('wheel', preventScroll, { passive: false })
    window.addEventListener('touchmove', preventScroll, { passive: false })
  }
  else {
    window.removeEventListener('wheel', preventScroll)
    window.removeEventListener('touchmove', preventScroll)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('wheel', preventScroll)
  window.removeEventListener('touchmove', preventScroll)
})
</script>

<template>
  <main
    font-sans p="x-4 y-10" m-auto max-w-180
    text="center gray-700 dark:gray-200" select-none
  >
    <RouterView />
    <TheFooter />
  </main>

  <!-- Image Preview -->
  <Transition name="fade">
    <div
      v-if="imageModel" fixed
      top-0 left-0 right-0 bottom-0 z-999 @click="imageModel = undefined"
    >
      <div absolute top-0 left-0 right-0 bottom-0 bg-black:60 z--1 />
      <img
        :src="imageModel.src" :alt="imageModel.alt"
        max-w-screen max-h-screen w-full h-full object-contain
      >
    </div>
  </Transition>
</template>

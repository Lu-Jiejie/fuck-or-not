<script setup lang="ts">
import { useWindowScroll } from '@vueuse/core'
import { computed } from 'vue'

const { y: scroll } = useWindowScroll()

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const showScrollTop = computed(() => {
  return scroll.value > 300
})
</script>

<template>
  <button
    title="Scroll to top"
    fixed right-3 bottom-3 p-3 hover:op100 rounded-full
    hover-bg-hex-8883 transition duration-300 z-100 print:hidden
    cursor-pointer
    :class="showScrollTop ? 'op30' : 'op0! pointer-events-none!'"
    @click="scrollToTop"
  >
    <div i-carbon-arrow-up />
  </button>
</template>

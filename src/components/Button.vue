<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  loading?: boolean
  disabled?: boolean
  loadingText?: string
  disabledText?: string
  disableOnLoading?: boolean
}>()

const isDisabled = computed(() =>
  props.disabled || (props.disableOnLoading !== false && props.loading),
)
</script>

<template>
  <button
    :disabled="isDisabled"
    text-gray-100 font-bold rounded h-12 w-full
    transition-colors duration-200
    disabled:text-gray-400
    class="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-700 disabled:text-gray-400"
    :class="[
      props.loading
        ? 'cursor-wait'
        : isDisabled
          ? 'cursor-not-allowed'
          : 'cursor-pointer',
    ]"
  >
    <template v-if="props.loading && props.loadingText">
      {{ props.loadingText }}
    </template>
    <template v-else-if="isDisabled && props.disabledText">
      {{ props.disabledText }}
    </template>
    <template v-else>
      <slot />
    </template>
  </button>
</template>

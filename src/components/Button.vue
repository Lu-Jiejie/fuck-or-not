<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  loading?: boolean
  disabled?: boolean
  loadingText?: string
  disabledText?: string
  disableOnLoading?: boolean
  color?: string
}>(), {
  color: 'teal',
})

const isDisabled = computed(() =>
  props.disabled || (props.disableOnLoading !== false && props.loading),
)
</script>

<template>
  <button
    :disabled="isDisabled"
    text-white font-bold rounded h-12 w-full
    transition-colors duration-200
    disabled:text-gray-400
    :class="[
      props.loading
        ? 'cursor-wait'
        : isDisabled
          ? 'cursor-not-allowed'
          : 'cursor-pointer',
      `bg-${props.color}-600 hover:bg-${props.color}-700 disabled:bg-${props.color}-700 disabled:text-gray-400`,
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

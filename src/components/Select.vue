<script setup lang="ts">
import { watchEffect } from 'vue'

const props = defineProps<{
  options?: { label: string, value: string | number }[]
}>()

const modelValue = defineModel<string | number>()

watchEffect(() => {
  if (props.options && props.options.length > 0 && !modelValue.value) {
    modelValue.value = props.options[0].value
  }
})
</script>

<template>
  <select
    v-model="modelValue"
    v-bind="$attrs"
    p="x-4 y-2"
    w-full
    text="left"
    border="~ rounded base hover-base focus-base"
    outline="none active:none"
    cursor-pointer
  >
    <option
      v-for="option in props.options"
      :key="option.label"
      :value="option.value"
      bg-base
      border="red"
    >
      {{ option.label }}
    </option>
  </select>
</template>

<style scoped>
select {
  appearance: none;
  background-image: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"%3E%3Cpath fill="%23aaa" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/%3E%3C/svg%3E');
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 20px;
}
</style>

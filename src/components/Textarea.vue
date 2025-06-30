<script setup lang="ts">
const props = defineProps<{
  placeholder?: string
}>()
const modelValue = defineModel<string>()
</script>

<template>
  <div>
    <textarea
      v-model="modelValue"
      v-bind="$attrs"
      p="x-4 y-3"

      h-60 w-full resize-none border="~ rounded base hover-base focus-base"
      outline="none active:none"
      :placeholder="props.placeholder"
    />
  </div>
</template>

<style scoped>

</style>

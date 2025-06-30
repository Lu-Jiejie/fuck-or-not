<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  type?: 'text' | 'password'
}>(), {
  type: 'text',
})
const modelValue = defineModel<string>()

const isPasswordVisible = ref(false)

const inputType = computed(() => {
  if (props.type === 'password') {
    return isPasswordVisible.value ? 'text' : 'password'
  }
  return props.type
})

function togglePasswordVisibility() {
  isPasswordVisible.value = !isPasswordVisible.value
}
</script>

<template>
  <div relative>
    <input
      id="input"
      v-model="modelValue"
      :type="inputType"
      v-bind="$attrs"
      p="x-4 y-2" w-full bg="transparent"
      border="~ rounded base hover-base focus-base"
      outline="none active:none"
    >

    <button
      v-if="props.type === 'password'"
      type="button"
      p="x-3 y-3" text-gray-300 translate-y--0.5
      transform transition-colors duration-200
      right-0 absolute
      dark:text-gray-800 hover="text-teal-600 dark:text-teal-700"
      @click="togglePasswordVisibility"
    >
      <div
        :class="[
          isPasswordVisible
            ? 'i-carbon-view-off'
            : 'i-carbon-view',
        ]"
        text-lg cursor-pointer
      />
    </button>
  </div>
</template>

<style scoped>
input {
  -webkit-text-security: none;
}

/* hide default eye icon */
input::-ms-reveal,
input::-ms-clear {
  display: none;
}

input[type='password']::-webkit-textfield-decoration-container {
  display: none;
}

input[type='password']::-webkit-credentials-auto-fill-button {
  display: none;
}

[relative]:has(button:hover) input {
  @apply border-teal-600 dark:border-teal-700;
}
</style>

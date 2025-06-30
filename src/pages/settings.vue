<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import Input from '~/components/Input.vue'
import Textarea from '~/components/Textarea.vue'

const googleApiKey = useStorage('google-api-key', '')
const concisePrompt = useStorage('concise-prompt', '')
const detailedPrompt = useStorage('detailed-prompt', '')
const novelPrompt = useStorage('novel-prompt', '')
const customPrompts = useStorage('custom-prompt', '')
</script>

<template>
  <h1 text-3xl font-bold>
    设置
  </h1>
  <div py-4 />
  <span label ml-0.5>
    Google API 秘钥
    <a
      href="https://aistudio.google.com/app/apikey"
      target="_blank"
      text-gray-500 ml-1 underline cursor-pointer dark:text-gray-400
    >此处获取</a>
  </span>
  <Input v-model="googleApiKey" type="password" />

  <div py-4 />
  <span label ml-0.5>
    简洁模式 Prompt
  </span>
  <Textarea v-model="concisePrompt" placeholder="留空将使用默认配置......" />

  <div py-4 />
  <span label ml-0.5>
    详细模式 Prompt
  </span>
  <Textarea v-model="detailedPrompt" placeholder="留空将使用默认配置......" />

  <div py-4 />
  <span label ml-0.5>
    小说模式 Prompt
  </span>
  <Textarea v-model="novelPrompt" placeholder="留空将使用默认配置......" />

  <div py-4 />
  <span label ml-0.5>
    自定义模式 Prompt
  </span>
  <Textarea v-model="customPrompts" placeholder="也许你需要第四个 prompt ，留空将不启用......" />
</template>

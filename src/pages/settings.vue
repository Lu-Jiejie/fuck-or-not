<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import Input from '~/components/Input.vue'
import Textarea from '~/components/Textarea.vue'
import { defaultConcisePrompt, defaultDetailedPrompt, defaultNovelPrompt } from '~/logic/prompts'

const googleApiKey = useStorage('google-api-key', '')
const concisePrompt = useStorage('concise-prompt', '')
const detailedPrompt = useStorage('detailed-prompt', '')
const novelPrompt = useStorage('novel-prompt', '')
const customPrompts = useStorage('custom-prompt', '')

const defaultPrompts = [
  defaultConcisePrompt,
  defaultDetailedPrompt,
  defaultNovelPrompt,
]
const prompts = [
  concisePrompt,
  detailedPrompt,
  novelPrompt,
]

function getDefaultPrompt(mode: 0 | 1 | 2) {
  const defaultPrompt = defaultPrompts[mode]
  const prompt = prompts[mode]

  if (prompt.value.trim() !== '') {
    if (!confirm('当前模式的 Prompt 已被自定义，获取默认 Prompt 将覆盖现有内容，是否继续？')) {
      return
    }
  }
  prompt.value = defaultPrompt
}

function clearPrompt(mode: 0 | 1 | 2) {
  const prompt = prompts[mode]
  if (prompt.value.trim() !== '') {
    if (!confirm('当前模式的 Prompt 已被自定义，清空将丢失现有内容，是否继续？')) {
      return
    }
  }
  prompt.value = ''
}
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
      ml-1 underline cursor-pointer op-70
    >此处获取</a>
  </span>
  <Input v-model="googleApiKey" type="password" />

  <div py-4 />
  <span label ml-0.5>
    简洁模式 Prompt
    <a
      target="_blank"
      ml-1 underline cursor-pointer op-70
      @click.prevent="getDefaultPrompt(0)"
    >获取默认 Prompt</a>
    <a
      target="_blank"
      ml-2 underline cursor-pointer opacity-70
      @click.prevent="clearPrompt(0)"
    >清空</a>
  </span>
  <Textarea v-model="concisePrompt" placeholder="留空将使用默认配置......" />

  <div py-4 />
  <span label ml-0.5>
    详细模式 Prompt
    <a
      target="_blank"
      ml-1 underline cursor-pointer op-70
      @click.prevent="getDefaultPrompt(1)"
    >获取默认 Prompt</a>
    <a
      target="_blank"
      ml-2 underline cursor-pointer op-70
      @click.prevent="clearPrompt(1)"
    >清空</a>
  </span>
  <Textarea v-model="detailedPrompt" placeholder="留空将使用默认配置......" />

  <div py-4 />
  <span label ml-0.5>
    小说模式 Prompt
    <a
      target="_blank"
      ml-1 underline cursor-pointer op-70
      @click.prevent="getDefaultPrompt(2)"
    >获取默认 Prompt</a>
    <a
      target="_blank"
      ml-2 underline cursor-pointer op-70
      @click.prevent="clearPrompt(2)"
    >清空</a>
  </span>
  <Textarea v-model="novelPrompt" placeholder="留空将使用默认配置......" />

  <div py-4 />
  <span label ml-0.5>
    自定义模式 Prompt
  </span>
  <Textarea v-model="customPrompts" placeholder="也许你需要第四个 prompt ，留空将不启用......" />
</template>

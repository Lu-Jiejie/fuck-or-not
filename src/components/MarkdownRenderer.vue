<script setup lang="ts">
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import { computed } from 'vue'

const props = defineProps<{
  content: string
}>()

const md = new MarkdownIt({
  // 模型输出与外部图片链接都不可信：禁止原始 HTML 直通，
  // 只渲染 markdown 语法，再由 DOMPurify 兜底清洗。
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
})

// 安全加固：分析结果会被存进收藏，属于存储型 XSS 的入口，
// 因此对渲染结果做一次白名单清洗，并只放行安全协议的链接。
const sanitizeConfig = {
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data:image\/(?:png|jpe?g|gif|webp|bmp);base64):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
}

const rendered = computed(() => {
  const html = md.render(props.content ?? '')
  return DOMPurify.sanitize(html, sanitizeConfig)
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- 内容已通过 DOMPurify 白名单清洗 -->
  <div class="markdown-body" v-html="rendered" />
</template>

<style scoped>
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  font-weight: bold;
  margin: 0.5em 0;
}
.markdown-body :deep(h1) {
  font-size: 1.5em;
}
.markdown-body :deep(h2) {
  font-size: 1.25em;
}
.markdown-body :deep(h3) {
  font-size: 1.1em;
}
.markdown-body :deep(p) {
  margin: 0.5em 0;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.markdown-body :deep(li) {
  margin: 0.25em 0;
}
.markdown-body :deep(code) {
  background: rgba(128, 128, 128, 0.2);
  padding: 0.1em 0.3em;
  border-radius: 0.25em;
  font-family: monospace;
}
.markdown-body :deep(pre) {
  background: rgba(128, 128, 128, 0.2);
  padding: 0.75em;
  border-radius: 0.5em;
  overflow-x: auto;
  margin: 0.5em 0;
}
.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid rgba(128, 128, 128, 0.5);
  padding-left: 1em;
  margin: 0.5em 0;
  opacity: 0.8;
}
.markdown-body :deep(strong) {
  font-weight: bold;
}
.markdown-body :deep(em) {
  font-style: italic;
}
.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5em 0;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid rgba(128, 128, 128, 0.3);
  padding: 0.5em 0.75em;
  text-align: left;
}
.markdown-body :deep(th) {
  background: rgba(128, 128, 128, 0.15);
  font-weight: bold;
}
.markdown-body :deep(tr:nth-child(even)) {
  background: rgba(128, 128, 128, 0.05);
}
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid rgba(128, 128, 128, 0.3);
  margin: 1em 0;
}
.markdown-body :deep(a) {
  color: #14b8a6;
  text-decoration: underline;
}
.markdown-body :deep(a:hover) {
  opacity: 0.8;
}
.markdown-body :deep(s),
.markdown-body :deep(del) {
  text-decoration: line-through;
  opacity: 0.7;
}
.markdown-body :deep(mark) {
  background: rgba(255, 255, 0, 0.3);
  padding: 0.1em 0.2em;
  border-radius: 0.2em;
}
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 0.5em;
}
.markdown-body :deep(input[type='checkbox']) {
  margin-right: 0.5em;
}
</style>

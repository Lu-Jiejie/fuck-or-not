<script setup lang="ts">
import { toggleDark } from '~/logic'
</script>

<template>
  <header w-full flex items-center justify-end p-8>
    <nav text-xl inline-flex items-center gap-4>
      <!-- 导航：按使用频率从高到低 -->
      <router-link to="/" icon-btn title="首页">
        <div i-carbon-home />
      </router-link>

      <router-link to="/favorites" icon-btn title="收藏夹">
        <div i-carbon-bookmark />
      </router-link>

      <router-link to="/history" icon-btn title="会话历史">
        <div i-carbon-time />
      </router-link>

      <router-link to="/settings" icon-btn title="设置">
        <div i-carbon-settings />
      </router-link>

      <!-- 分隔：左侧是站内导航，右侧是外部链接与全局开关 -->
      <span w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1 />

      <a
        i-carbon-logo-github icon-btn
        rel="noreferrer"
        href="https://github.com/Lu-Jiejie/fuck-or-not"
        target="_blank"
        title="GitHub"
      />

      <button icon-btn title="切换主题" @click="toggleDark()">
        <div i-carbon-sun dark:i-carbon-moon />
      </button>
    </nav>
  </header>
</template>

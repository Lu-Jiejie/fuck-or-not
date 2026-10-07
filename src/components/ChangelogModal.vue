<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { useChangelog } from '~/composables/useChangelog'

const {
  changelogEntries,
  isChangelogOpen,
  isNewEntry,
  closeChangelog,
} = useChangelog()

useEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isChangelogOpen.value)
    closeChangelog()
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isChangelogOpen"
      fixed top-0 left-0 right-0 bottom-0 z-1000
      flex="~ items-center justify-center" p="x-4 y-6"
    >
      <div absolute top-0 left-0 right-0 bottom-0 bg-black:60 @click="closeChangelog" />

      <div
        relative w-full max-w-140 min-h-0 flex="~ col"
        class="max-h-full sm:max-h-[80vh]"
        rounded-xl border="~ base" bg="white dark:black"
        text="left gray-700 dark:gray-200"
        overflow-hidden
      >
        <!-- 标题 -->
        <div flex="~ items-center justify-between gap-2" p-5 border="b base">
          <div flex="~ items-center gap-2" min-w-0>
            <div w-1 h-6 rounded-full bg-teal-500 />
            <span text-lg font-semibold truncate>更新历史</span>
            <a
              i-carbon-launch icon-btn shrink-0
              rel="noreferrer" target="_blank"
              href="https://github.com/Lu-Jiejie/fuck-or-not/releases"
              title="在 GitHub 查看 Releases"
            />
          </div>

          <button icon-btn shrink-0 title="关闭" @click="closeChangelog">
            <div i-carbon-close text-xl />
          </button>
        </div>

        <!-- 版本列表 -->
        <div min-h-0 flex-1 overflow-y-auto p-5 flex="~ col" gap-6>
          <div v-for="entry in changelogEntries" :key="entry.version">
            <div flex="~ items-center wrap" gap-2>
              <span font-mono text-sm font-semibold>
                v{{ entry.version }}
              </span>

              <span
                v-if="isNewEntry(entry)"
                text-xs px-1.5 py-0.5 rounded shrink-0
                border="~ base" op-60
              >
                新
              </span>

              <span ml-auto text-xs font-mono op-40>
                {{ entry.date }}
              </span>
            </div>

            <ul mt-2 flex="~ col" gap-1.5>
              <li
                v-for="item in entry.items"
                :key="item"
                flex gap-2 text-sm op-80
              >
                <span mt-1.5 w-1 h-1 rounded-full shrink-0 class="bg-gray-400 dark:bg-gray-600" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

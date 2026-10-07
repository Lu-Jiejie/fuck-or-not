import type { ChangelogEntry } from '~/types'
import { useStorage } from '@vueuse/core'
import { computed, ref } from 'vue'
import { changelogEntries, currentVersion } from '~/logic/changelog'

/** 弹窗开关：Header 的入口按钮与 App 里的弹窗共用，因此放在模块作用域 */
const isChangelogOpen = ref(false)

/** 最近一次已读的版本号，空字符串表示还没记录过（第一次使用） */
const lastSeenVersion = useStorage<string>('last-seen-version', '')

/** 已读版本在列表中的位置，-1 表示记录中的版本不在列表里 */
const lastSeenIndex = computed(() =>
  changelogEntries.findIndex(entry => entry.version === lastSeenVersion.value),
)

/** 是否存在未读的版本更新 */
const hasUnseen = computed(() =>
  lastSeenVersion.value !== '' && lastSeenVersion.value !== currentVersion,
)

/** 这一条是否比上次读到的版本更新 */
function isNewEntry(entry: ChangelogEntry): boolean {
  if (lastSeenIndex.value < 0)
    return false
  return changelogEntries.indexOf(entry) < lastSeenIndex.value
}

function openChangelog() {
  isChangelogOpen.value = true
}

function closeChangelog() {
  isChangelogOpen.value = false
  // 关闭即视为已读，避免每次刷新都弹出
  lastSeenVersion.value = currentVersion
}

/**
 * 应用启动时调用，决定要不要主动展示更新历史：
 * - 第一次使用（没有记录）：不打扰，只静默记住当前版本，想让它也弹一次就删掉这里的分支
 * - 之前用过，且版本和当前不同：自动弹一次
 */
function initChangelog() {
  if (lastSeenVersion.value === '') {
    lastSeenVersion.value = currentVersion
    return
  }
  if (lastSeenVersion.value !== currentVersion)
    openChangelog()
}

export function useChangelog() {
  return {
    changelogEntries,
    currentVersion,
    isChangelogOpen,
    hasUnseen,
    openChangelog,
    closeChangelog,
    initChangelog,
    isNewEntry,
  }
}

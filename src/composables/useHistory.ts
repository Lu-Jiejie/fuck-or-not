import type { HistoryEntry } from '~/types'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { computed, ref } from 'vue'
import { addFavorite, deleteImageIfUnused, favoriteResults } from '~/logic'

// 会话历史：分析完成后写入，用于误刷新恢复与回看。
// 用 IndexedDB 而非 sessionStorage，因为原图 base64 可达 27MB，后者配额撑不住。
const STORE_KEY = 'analysis-history'
const MAX_ENTRIES = 5
const TTL_MS = 24 * 60 * 60 * 1000

const historyStore = useIDBKeyval<HistoryEntry[]>(STORE_KEY, [], { shallow: true })

// 列表展开状态放模块作用域：入口在 Header，面板在首页，两处需共用
const isHistoryOpen = ref(false)

/** 过期判定：写入时和读取时都要过一遍，避免长期不开页面后翻出旧数据 */
function isExpired(entry: HistoryEntry, now = Date.now()) {
  return now - entry.time > TTL_MS
}

/** 按时间倒序 + 去重 + 截断到上限；超期的直接丢弃 */
function normalize(entries: HistoryEntry[], now = Date.now()) {
  const seen = new Set<string>()
  return entries
    .filter(e => e && typeof e.time === 'number' && !isExpired(e, now))
    .sort((a, b) => b.time - a.time)
    .filter((e) => {
      if (seen.has(e.id))
        return false
      seen.add(e.id)
      return true
    })
    .slice(0, MAX_ENTRIES)
}

/** 配额写满时优先丢图片而不是丢整条结果 */
export const historyQuotaWarning = ref('')

function isQuotaError(e: unknown) {
  const name = (e as any)?.name
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
}

/** 写入一条历史；同时清理超期项并截断到上限 */
export async function pushHistory(entry: Omit<HistoryEntry, 'id'>) {
  const item: HistoryEntry = { ...entry, id: `h_${entry.time}_${Math.random().toString(36).slice(2, 8)}` }

  const commit = async (list: HistoryEntry[]) => {
    const next = normalize(list)
    historyStore.data.value = next
    await historyStore.set(next)
  }

  try {
    await commit([item, ...(historyStore.data.value ?? [])])
    historyQuotaWarning.value = ''
    return item
  }
  catch (e) {
    if (!isQuotaError(e))
      throw e
  }

  // 图片占绝大部分体积：丢掉图片再试，至少保住文字结果
  try {
    const withoutImages = (historyStore.data.value ?? []).map(x => ({ ...x, imageBase64: undefined }))
    const lean: HistoryEntry = { ...item, imageBase64: undefined }
    await commit([lean, ...withoutImages])
    historyQuotaWarning.value = '存储空间不足，本次历史只保留了文字结果（未保存原图）'
    return lean
  }
  catch {
    // 连纯文本都写不进去：清空历史后重试一次，仍失败就放弃
    try {
      await commit([{ ...item, imageBase64: undefined }])
      historyQuotaWarning.value = '存储空间不足，已清空较早的历史记录'
      return item
    }
    catch (e2) {
      historyQuotaWarning.value = '存储空间不足，本次未能记录历史'
      throw e2
    }
  }
}

/** 标记某条历史已保存进收藏 */
export async function markHistorySaved(id: string) {
  const list = historyStore.data.value ?? []
  const idx = list.findIndex(e => e.id === id)
  if (idx === -1)
    return
  const next = [...list]
  next[idx] = { ...next[idx], saved: true }
  historyStore.data.value = next
  await historyStore.set(next)
}

export async function removeHistory(id: string) {
  const next = (historyStore.data.value ?? []).filter(e => e.id !== id)
  historyStore.data.value = next
  await historyStore.set(next)
}

export async function clearHistory() {
  historyStore.data.value = []
  await historyStore.set([])
}

/** 清理超期项；应用启动时调用一次 */
export async function pruneHistory() {
  const list = historyStore.data.value ?? []
  const next = normalize(list)
  if (next.length !== list.length) {
    historyStore.data.value = next
    await historyStore.set(next)
  }
}

// 历史项与收藏项靠 time 关联，取消收藏时据此找到对应收藏
function findFavoriteByTime(time: number) {
  return (favoriteResults.data.value ?? []).findIndex(f => f.time === time)
}

/** 把一条历史收藏进收藏夹 */
export async function favoriteHistory(entry: HistoryEntry) {
  await addFavorite({
    model: entry.model,
    mode: entry.mode,
    time: entry.time,
    result: entry.result,
    mimeType: entry.mimeType,
    prompt: entry.prompt,
    additionalPrompt: entry.additionalPrompt,
    base64: entry.imageBase64,
    sourceUrl: entry.imageUrl,
  })
  await markHistorySaved(entry.id)
}

/** 取消收藏：从收藏夹移除，并顺带清理不再被引用的图片 */
export async function unfavoriteHistory(entry: HistoryEntry) {
  const list = favoriteResults.data.value ?? []
  const idx = findFavoriteByTime(entry.time)
  if (idx === -1)
    return

  const hash = list[idx].imageHash
  const next = [...list]
  next.splice(idx, 1)
  favoriteResults.data.value = next

  const used = new Set(next.map(f => f.imageHash))
  deleteImageIfUnused(hash, used)

  // 历史项本身保留，只是回到「未保存」状态
  const hList = historyStore.data.value ?? []
  const hIdx = hList.findIndex(e => e.id === entry.id)
  if (hIdx !== -1) {
    const hNext = [...hList]
    hNext[hIdx] = { ...hNext[hIdx], saved: false }
    historyStore.data.value = hNext
    await historyStore.set(hNext)
  }
}

export function useHistory() {
  // 读取时也过滤一遍：页面可能开着很久，中途有条目会过期
  const entries = computed(() => normalize(historyStore.data.value ?? []))

  // 是否已收藏以收藏夹为准，避免历史里的 saved 标记与真实状态不同步
  const entriesWithSavedState = computed(() => {
    const favTimes = new Set((favoriteResults.data.value ?? []).map(f => f.time))
    return entries.value.map(e => ({ ...e, saved: favTimes.has(e.time) }))
  })

  const latest = computed(() => entriesWithSavedState.value[0])

  return {
    entries: entriesWithSavedState,
    latest,
    isReady: historyStore.isFinished,
    quotaWarning: historyQuotaWarning,
    isHistoryOpen,
    pushHistory,
    markHistorySaved,
    removeHistory,
    clearHistory,
    pruneHistory,
    favoriteHistory,
    unfavoriteHistory,
    MAX_ENTRIES,
    TTL_MS,
  }
}

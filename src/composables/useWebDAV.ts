import type { FavoriteResult } from '~/types'
import { useStorage } from '@vueuse/core'
// useIDBKeyval must match the same key used in favorites.vue / useAnalyse
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { ref } from 'vue'

import { additionalPromptPresets, chatgptApiKey, chatgptApiUrl, chatgptModels, customPrompts, deletedTimestampsStore, geminiApiUrl, geminiModels, grokApiKey, grokApiUrl, grokModels, imageStore, modelOptions } from '~/logic'

export const webdavUrl = useStorage('webdav-url', '')
export const webdavUsername = useStorage('webdav-username', '')
export const webdavPassword = useStorage('webdav-password', '')
export const webdavLastSyncETag = useStorage('webdav-last-sync-etag', '')
export const webdavLastSyncIds = useStorage<number[]>('webdav-last-sync-ids', [])

const googleApiKey = useStorage('google-api-key', '')
const concisePrompt = useStorage('concise-prompt', '')
const detailedPrompt = useStorage('detailed-prompt', '')
const novelPrompt = useStorage('novel-prompt', '')
const oldCustomPrompt = useStorage('custom-prompt', '')
const favoriteResults = useIDBKeyval<FavoriteResult[] | undefined>('favorite-results', undefined)

export const webdavSyncing = ref(false)
export const webdavAction = ref<'upload' | 'download' | ''>('')
export const webdavStatus = ref('')
export const webdavProgress = ref({ step: '', current: 0, total: 0 })

const DIR = '/fuck-or-not'
const DIR_IMAGES = `${DIR}/images`

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, '')
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  if (webdavUsername.value || webdavPassword.value)
    h.Authorization = `Basic ${btoa(`${webdavUsername.value}:${webdavPassword.value}`)}`
  return h
}

function setProgress(step: string, current = 0, total = 0) {
  webdavProgress.value = { step, current, total }
}

async function webdavRequest(path: string, method: string, body?: string | Blob, contentType?: string): Promise<Response> {
  const base = normalizeBaseUrl(webdavUrl.value)
  const headers: Record<string, string> = { ...authHeaders() }
  if (contentType)
    headers['Content-Type'] = contentType
  // 强制禁用缓存，防止手机端浏览器缓存 GET 请求导致无法拉取新数据
  return fetch(`${base}${path}`, { method, headers, body, cache: 'no-store' })
}

async function webdavPut(path: string, content: string, contentType = 'application/json') {
  const res = await webdavRequest(path, 'PUT', content, contentType)
  if (!res.ok)
    throw new Error(`PUT ${path} failed: ${res.status} ${res.statusText}`)
  return res
}

async function webdavGet(path: string): Promise<string> {
  const res = await webdavRequest(path, 'GET')
  if (res.status === 404)
    return ''
  if (!res.ok)
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`)
  return res.text()
}

async function webdavMkcol(path: string) {
  const res = await webdavRequest(path, 'MKCOL')
  if (!res.ok && res.status !== 405)
    throw new Error(`MKCOL ${path} failed: ${res.status} ${res.statusText}`)
}

async function ensureDirs() {
  setProgress('创建目录...')
  await webdavMkcol(DIR)
  await webdavMkcol(DIR_IMAGES)
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
  }
  return map[mimeType] ?? 'png'
}

function buildSettings() {
  return {
    googleApiKey: googleApiKey.value,
    geminiApiUrl: geminiApiUrl.value,
    grokApiKey: grokApiKey.value,
    grokApiUrl: grokApiUrl.value,
    chatgptApiKey: chatgptApiKey.value,
    chatgptApiUrl: chatgptApiUrl.value,
    geminiModels: geminiModels.value,
    grokModels: grokModels.value,
    chatgptModels: chatgptModels.value,
    customPrompts: customPrompts.value,
    additionalPromptPresets: additionalPromptPresets.value,
    // 兼容旧版：保留旧字段以便旧版本能读取
    concisePrompt: concisePrompt.value,
    detailedPrompt: detailedPrompt.value,
    novelPrompt: novelPrompt.value,
    oldCustomPrompt: oldCustomPrompt.value,
  }
}

function applySettings(data: any) {
  if (data.googleApiKey !== undefined)
    googleApiKey.value = data.googleApiKey
  if (data.geminiApiUrl !== undefined)
    geminiApiUrl.value = data.geminiApiUrl
  if (data.grokApiKey !== undefined)
    grokApiKey.value = data.grokApiKey
  if (data.grokApiUrl !== undefined)
    grokApiUrl.value = data.grokApiUrl
  if (data.chatgptApiKey !== undefined)
    chatgptApiKey.value = data.chatgptApiKey
  if (data.chatgptApiUrl !== undefined)
    chatgptApiUrl.value = data.chatgptApiUrl

  // 模型列表：优先使用新版分组格式
  if (Array.isArray(data.geminiModels) && data.geminiModels.length > 0)
    geminiModels.value = data.geminiModels
  if (Array.isArray(data.grokModels) && data.grokModels.length > 0)
    grokModels.value = data.grokModels
  if (Array.isArray(data.chatgptModels) && data.chatgptModels.length > 0)
    chatgptModels.value = data.chatgptModels

  // 兼容旧版：如果云端只有统一的 modelOptions，则按 provider 拆分
  if (Array.isArray(data.modelOptions) && data.modelOptions.length > 0) {
    if (geminiModels.value.length === 0 && grokModels.value.length === 0 && chatgptModels.value.length === 0) {
      const gemini: string[] = []
      const grok: string[] = []
      const chatgpt: string[] = []
      for (const model of data.modelOptions) {
        if (model.provider === 'Gemini')
          gemini.push(model.id)
        else if (model.provider === 'Grok')
          grok.push(model.id)
        else if (model.provider === 'ChatGPT')
          chatgpt.push(model.id)
      }
      if (gemini.length > 0)
        geminiModels.value = gemini
      if (grok.length > 0)
        grokModels.value = grok
      if (chatgpt.length > 0)
        chatgptModels.value = chatgpt
    }
    modelOptions.value = data.modelOptions
  }

  // Prompts：优先使用新版数组格式
  if (Array.isArray(data.customPrompts) && data.customPrompts.length > 0) {
    customPrompts.value = data.customPrompts
  }
  else {
    // 兼容旧版：从单个字段迁移
    const migrated: { id: string, name: string, content: string }[] = []
    if (data.concisePrompt !== undefined && data.concisePrompt !== '')
      migrated.push({ id: 'concise', name: '简洁', content: data.concisePrompt })
    if (data.detailedPrompt !== undefined && data.detailedPrompt !== '')
      migrated.push({ id: 'detailed', name: '详细', content: data.detailedPrompt })
    if (data.novelPrompt !== undefined && data.novelPrompt !== '')
      migrated.push({ id: 'novel', name: '小说', content: data.novelPrompt })
    // 旧版单字段 customPrompt（key: custom-prompt, 非 customPrompts 数组）
    const oldCustom = data.oldCustomPrompt ?? data.customPrompt
    if (oldCustom !== undefined && oldCustom !== '')
      migrated.push({ id: 'custom', name: '自定义', content: oldCustom })
    if (migrated.length > 0)
      customPrompts.value = migrated
  }
  // 仍同步旧字段到旧版 storage（兼容设置页面可能残留读取旧字段的逻辑）
  if (data.concisePrompt !== undefined)
    concisePrompt.value = data.concisePrompt
  if (data.detailedPrompt !== undefined)
    detailedPrompt.value = data.detailedPrompt
  if (data.novelPrompt !== undefined)
    novelPrompt.value = data.novelPrompt
  if (data.oldCustomPrompt !== undefined)
    oldCustomPrompt.value = data.oldCustomPrompt

  if (Array.isArray(data.additionalPromptPresets))
    additionalPromptPresets.value = data.additionalPromptPresets
}

/**
 * B: 并发冲突自动合并 — 当上传时检测到远端已被其他设备修改，
 * 自动拉取远端数据 + 远端墓碑，与本地的收藏项和墓碑合并后更新本地状态，
 * 然后继续上传流程。
 */
async function autoMergeFromRemote() {
  const favRes = await webdavRequest(`${DIR}/favorites.json`, 'GET')
  if (!favRes.ok)
    throw new Error('合并失败：无法获取远端数据')
  const remoteFavs = JSON.parse(await favRes.text()) as FavoriteResult[]

  const tombText = await webdavGet(`${DIR}/tombstones.json`)
  const remoteTombstones = new Set<number>(tombText ? JSON.parse(tombText) : [])

  const localItems = favoriteResults.data.value ?? []
  const localTombstones = new Set(deletedTimestampsStore.data.value)

  // 以本地数据为基础，添加远端新增的项（排除被本地墓碑标记的）
  const mergedMap = new Map<number, FavoriteResult>()
  for (const item of localItems)
    mergedMap.set(item.time, item)

  for (const item of remoteFavs) {
    if (!localTombstones.has(item.time))
      mergedMap.set(item.time, item)
  }

  // 删除远端已墓碑标记的项
  for (const ts of remoteTombstones)
    mergedMap.delete(ts)

  // 合并墓碑列表
  const mergedTombstones = [...new Set([...localTombstones, ...remoteTombstones])]

  favoriteResults.data.value = Array.from(mergedMap.values()).sort((a, b) => b.time - a.time)
  deletedTimestampsStore.data.value = mergedTombstones
}

export async function webdavUpload() {
  if (!webdavUrl.value) {
    webdavStatus.value = '请先填写 WebDAV 地址'
    return
  }
  webdavSyncing.value = true
  webdavAction.value = 'upload'
  webdavStatus.value = ''
  try {
    await ensureDirs()

    // B: 检查并发冲突 (脏写保护)
    setProgress('检查远端冲突...')
    const headRes = await webdavRequest(`${DIR}/favorites.json`, 'HEAD')
    if (headRes.ok) {
      const remoteETag = headRes.headers.get('ETag') || headRes.headers.get('Last-Modified') || ''
      if (remoteETag && webdavLastSyncETag.value && remoteETag !== webdavLastSyncETag.value) {
        setProgress('检测到远端变更，自动合并...')
        await autoMergeFromRemote()
      }
    }

    //
    // 本地垃圾回收：清理本地缓存中不再被收藏引用的图片
    setProgress('清理本地缓存图片...')
    const allLocalItems = favoriteResults.data.value ?? []
    const referencedLocal = new Set(allLocalItems.map(i => i.imageHash))
    const tempStore = { ...imageStore.data.value }
    let localDeletedKeys = 0
    for (const key of Object.keys(tempStore)) {
      const hash = key.split(':')[0]
      if (!referencedLocal.has(hash)) {
        delete tempStore[key]
        localDeletedKeys++
      }
    }
    if (localDeletedKeys > 0) {
      imageStore.data.value = tempStore
    }
    const localDeletedImages = Math.ceil(localDeletedKeys / 2)

    // 上传设置
    setProgress('上传设置...')
    await webdavPut(`${DIR}/settings.json`, JSON.stringify(buildSettings(), null, 2))

    // 获取远端已有图片索引
    setProgress('获取远端图片索引...')
    const remoteIndexText = await webdavGet(`${DIR}/image-index.json`)
    const remoteHashes = new Set<string>(remoteIndexText ? JSON.parse(remoteIndexText) : [])

    // 找出本地有但远端没有的图片
    const store = imageStore.data.value
    const localHashes = Object.keys(store).filter(k => !k.includes(':'))

    // 上传缺失图片
    let uploaded = 0
    let skipped = 0

    for (const hash of localHashes) {
      const mimeType = store[`${hash}:mime`] ?? 'image/png'
      const ext = mimeToExt(mimeType)
      const path = `${DIR_IMAGES}/${hash}.${ext}`

      // 优化逻辑：如果索引里没有，先 HEAD 探测一下文件是否已存在
      if (!remoteHashes.has(hash)) {
        const headRes = await webdavRequest(path, 'HEAD')
        if (headRes.ok) {
          // 云端确实存在，直接加入索引并跳过上传
          remoteHashes.add(hash)
          skipped++
          continue
        }

        // 真正执行上传
        setProgress(`上传图片...`, ++uploaded, localHashes.length - skipped)
        const base64 = store[hash]
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: mimeType })

        const res = await webdavRequest(path, 'PUT', blob, mimeType)
        if (!res.ok)
          throw new Error(`上传图片 ${hash} 失败: ${res.status} ${res.statusText}`)

        remoteHashes.add(hash)
      }
    }

    // A: 上传墓碑标记 — 明确告知远端哪些项被主动删除了
    setProgress('上传墓碑标记...')
    const localTombstones = deletedTimestampsStore.data.value
    await webdavPut(`${DIR}/tombstones.json`, JSON.stringify(localTombstones, null, 2))

    // C: 严格等所有资源（图片）全部上传成功后，最后再写配置，保证原子性
    setProgress('上传收藏列表...')
    const allItems = favoriteResults.data.value ?? []
    const putRes = await webdavPut(`${DIR}/favorites.json`, JSON.stringify(allItems, null, 2))

    // 记录同步状态（ETag和ID基准线）
    webdavLastSyncETag.value = putRes.headers.get('ETag') || putRes.headers.get('Last-Modified') || ''
    webdavLastSyncIds.value = allItems.map(i => i.time)

    // 垃圾回收：清理远端已不再被任何收藏项引用的图片
    setProgress('清理远端闲置图片...')
    const referencedHashes = new Set(allItems.map(i => i.imageHash))
    const orphanHashes = [...remoteHashes].filter(h => !referencedHashes.has(h))

    let deletedCount = 0
    for (const hash of orphanHashes) {
      // 尝试获取文件扩展名。如果本地还有记录则使用本地 mime，否则回退到逐个尝试常见扩展名
      const possibleExts = store[`${hash}:mime`]
        ? [mimeToExt(store[`${hash}:mime`])]
        : ['png', 'jpg', 'webp', 'gif', 'bmp']

      for (const ext of possibleExts) {
        const delRes = await webdavRequest(`${DIR_IMAGES}/${hash}.${ext}`, 'DELETE')
        if (delRes.ok) {
          deletedCount++
          break // 成功删除后跳出循环
        }
      }
      // 从远端索引记录中移除
      remoteHashes.delete(hash)
    }

    // 更新远端图片索引
    setProgress('更新图片索引...')
    await webdavPut(`${DIR}/image-index.json`, JSON.stringify([...remoteHashes]))

    let msg = `上传成功（新增 ${uploaded} 张，跳过 ${skipped} 张，远端清理 ${deletedCount} 张）`
    if (localDeletedImages > 0)
      msg = msg.replace('）', `，本地清理 ${localDeletedImages} 张）`)
    webdavStatus.value = msg
    setProgress('')
  }
  catch (e: any) {
    webdavStatus.value = `上传失败：${e.message}`
    setProgress('')
  }
  finally {
    webdavSyncing.value = false
    webdavAction.value = ''
  }
}

export async function webdavDownload() {
  if (!webdavUrl.value) {
    webdavStatus.value = '请先填写 WebDAV 地址'
    return
  }
  webdavSyncing.value = true
  webdavAction.value = 'download'
  webdavStatus.value = ''
  try {
    // 下载设置
    setProgress('下载设置...')
    const settingsText = await webdavGet(`${DIR}/settings.json`)
    if (settingsText)
      applySettings(JSON.parse(settingsText))

    // 下载收藏列表
    setProgress('下载收藏列表...')
    const favRes = await webdavRequest(`${DIR}/favorites.json`, 'GET')
    if (!favRes.ok && favRes.status !== 404) {
      throw new Error(`GET favorites.json failed: ${favRes.status} ${favRes.statusText}`)
    }
    const favText = favRes.ok ? await favRes.text() : ''

    if (!favText) {
      webdavStatus.value = '下载成功（无收藏数据）'
      setProgress('')
      return
    }

    // 保存最新的 ETag
    webdavLastSyncETag.value = favRes.headers.get('ETag') || favRes.headers.get('Last-Modified') || ''

    const remoteFavs = JSON.parse(favText) as FavoriteResult[]
    if (!Array.isArray(remoteFavs)) {
      webdavStatus.value = '下载失败：数据格式不正确'
      setProgress('')
      return
    }

    const localItems = favoriteResults.data.value ?? []
    const localMap = new Map(localItems.map(item => [item.time, item]))
    const localTombstones = new Set(deletedTimestampsStore.data.value)

    // A: 下载远端墓碑标记（远端主动删除了哪些项）
    const remoteTombstoneText = await webdavGet(`${DIR}/tombstones.json`)
    const remoteTombstones = new Set<number>(remoteTombstoneText ? JSON.parse(remoteTombstoneText) : [])

    let hasChanges = false
    const itemsToProcess: FavoriteResult[] = []

    // 应用远端墓碑：远端已删除的项，本地也要同步删除
    for (const ts of remoteTombstones) {
      if (localMap.has(ts)) {
        localMap.delete(ts)
        hasChanges = true
      }
    }

    for (const remoteItem of remoteFavs) {
      // ★ 幽灵复活防护：本地已墓碑标记的项，拒绝从远端恢复
      if (localTombstones.has(remoteItem.time))
        continue
      // 远端已墓碑标记的项，跳过
      if (remoteTombstones.has(remoteItem.time))
        continue

      const localItem = localMap.get(remoteItem.time)
      if (!localItem || JSON.stringify(localItem) !== JSON.stringify(remoteItem)) {
        localMap.set(remoteItem.time, remoteItem)
        itemsToProcess.push(remoteItem)
        hasChanges = true
      }
    }

    // 获取远端图片索引
    const remoteIndexText = await webdavGet(`${DIR}/image-index.json`)
    const remoteHashList: string[] = remoteIndexText ? JSON.parse(remoteIndexText) : []
    const remoteHashSet = new Set(remoteHashList)

    // C: 下载缺失图片
    const localStore = imageStore.data.value
    const hashesToDownload = [...new Set(itemsToProcess.map(i => i.imageHash))]
      .filter(h => !localStore[h] && remoteHashSet.has(h))

    let downloaded = 0
    const newImages: Record<string, string> = { ...localStore }
    for (const hash of hashesToDownload) {
      const refItem = remoteFavs.find(i => i.imageHash === hash)
      const mimeType = refItem?.mimeType ?? 'image/png'
      const ext = mimeToExt(mimeType)

      setProgress(`下载图片...`, ++downloaded, hashesToDownload.length)
      const imgRes = await webdavRequest(`${DIR_IMAGES}/${hash}.${ext}`, 'GET')
      if (!imgRes.ok)
        continue

      const blob = await imgRes.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      newImages[hash] = btoa(binary)
      newImages[`${hash}:mime`] = mimeType
    }
    imageStore.data.value = newImages

    if (hasChanges) {
      favoriteResults.data.value = Array.from(localMap.values())
        .sort((a, b) => b.time - a.time)
    }

    // 合并本地 + 远端墓碑
    const mergedTombstones = [...new Set([...localTombstones, ...remoteTombstones])]
    deletedTimestampsStore.data.value = mergedTombstones

    webdavStatus.value = `下载成功（更新 ${itemsToProcess.length} 条，图片 ${downloaded} 张）`
    setProgress('')

    // 更新最后同步基准
    webdavLastSyncIds.value = (favoriteResults.data.value ?? []).map(i => i.time)
  }
  catch (e: any) {
    webdavStatus.value = `下载失败：${e.message}`
    setProgress('')
  }
  finally {
    webdavSyncing.value = false
    webdavAction.value = ''
  }
}

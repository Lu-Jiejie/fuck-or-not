import type { FavoriteResult } from '~/types'
import { useStorage } from '@vueuse/core'
// useIDBKeyval must match the same key used in favorites.vue / useAnalyse
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { ref } from 'vue'

import { chatgptApiKey, chatgptApiUrl, geminiApiUrl, grokApiKey, grokApiUrl, imageStore, modelOptions } from '~/logic'

export const webdavUrl = useStorage('webdav-url', '')
export const webdavUsername = useStorage('webdav-username', '')
export const webdavPassword = useStorage('webdav-password', '')

const googleApiKey = useStorage('google-api-key', '')
const concisePrompt = useStorage('concise-prompt', '')
const detailedPrompt = useStorage('detailed-prompt', '')
const novelPrompt = useStorage('novel-prompt', '')
const customPrompts = useStorage('custom-prompt', '')
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
  return fetch(`${base}${path}`, { method, headers, body })
}

async function webdavPut(path: string, content: string, contentType = 'application/json') {
  const res = await webdavRequest(path, 'PUT', content, contentType)
  if (!res.ok)
    throw new Error(`PUT ${path} failed: ${res.status} ${res.statusText}`)
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
    modelOptions: modelOptions.value,
    concisePrompt: concisePrompt.value,
    detailedPrompt: detailedPrompt.value,
    novelPrompt: novelPrompt.value,
    customPrompts: customPrompts.value,
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
  if (Array.isArray(data.modelOptions))
    modelOptions.value = data.modelOptions
  if (data.concisePrompt !== undefined)
    concisePrompt.value = data.concisePrompt
  if (data.detailedPrompt !== undefined)
    detailedPrompt.value = data.detailedPrompt
  if (data.novelPrompt !== undefined)
    novelPrompt.value = data.novelPrompt
  if (data.customPrompts !== undefined)
    customPrompts.value = data.customPrompts
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
    const toUpload = localHashes.filter(h => !remoteHashes.has(h))

    // 上传缺失图片
    let uploaded = 0
    for (const hash of toUpload) {
      const base64 = store[hash]
      const mimeType = store[`${hash}:mime`] ?? 'image/png'
      const ext = mimeToExt(mimeType)
      setProgress(`上传图片...`, ++uploaded, toUpload.length)
      // 将 base64 转为 Blob 上传，使浏览器能直接查看
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: mimeType })
      const res = await webdavRequest(`${DIR_IMAGES}/${hash}.${ext}`, 'PUT', blob, mimeType)
      if (!res.ok)
        throw new Error(`上传图片 ${hash} 失败: ${res.status} ${res.statusText}`)
      remoteHashes.add(hash)
    }

    // 更新远端图片索引
    setProgress('更新图片索引...')
    await webdavPut(`${DIR}/image-index.json`, JSON.stringify([...remoteHashes]))

    // 上传收藏列表（含 imageHash + mimeType，不含 base64）
    setProgress('上传收藏列表...')
    const allItems = favoriteResults.data.value ?? []
    await webdavPut(`${DIR}/favorites.json`, JSON.stringify(allItems, null, 2))

    webdavStatus.value = `上传成功（新增图片 ${toUpload.length} 张）`
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
    const favText = await webdavGet(`${DIR}/favorites.json`)
    if (!favText) {
      webdavStatus.value = '下载成功（无收藏数据）'
      setProgress('')
      return
    }

    const remoteFavs = JSON.parse(favText) as FavoriteResult[]
    if (!Array.isArray(remoteFavs)) {
      webdavStatus.value = '下载失败：数据格式不正确'
      setProgress('')
      return
    }

    const existingTimes = new Set(favoriteResults.data.value?.map(item => item.time) ?? [])
    const newItems = remoteFavs.filter(item => !existingTimes.has(item.time))

    // 获取远端图片索引，用于确定文件扩展名
    const remoteIndexText = await webdavGet(`${DIR}/image-index.json`)
    const remoteHashList: string[] = remoteIndexText ? JSON.parse(remoteIndexText) : []
    const remoteHashSet = new Set(remoteHashList)

    // 只下载本地 imageStore 中没有的图片
    const localStore = imageStore.data.value
    const hashesToDownload = [...new Set(newItems.map(i => i.imageHash))]
      .filter(h => !localStore[h] && remoteHashSet.has(h))

    let downloaded = 0
    const newImages: Record<string, string> = { ...localStore }
    for (const hash of hashesToDownload) {
      // 找到该 hash 对应的 mimeType（从远端 favs 中取）
      const refItem = remoteFavs.find(i => i.imageHash === hash)
      const mimeType = refItem?.mimeType ?? 'image/png'
      const ext = mimeToExt(mimeType)
      setProgress(`下载图片...`, ++downloaded, hashesToDownload.length)
      const res = await webdavRequest(`${DIR_IMAGES}/${hash}.${ext}`, 'GET')
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        newImages[hash] = btoa(binary)
        newImages[`${hash}:mime`] = mimeType
      }
    }
    imageStore.data.value = newImages

    if (newItems.length > 0) {
      favoriteResults.data.value = [...(favoriteResults.data.value ?? []), ...newItems]
        .sort((a, b) => b.time - a.time)
    }

    webdavStatus.value = `下载成功（新增 ${newItems.length} 条，图片 ${downloaded} 张）`
    setProgress('')
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

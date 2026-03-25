import type { FavoriteResult } from '~/types'
import { useStorage } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { ref } from 'vue'
import { chatgptApiKey, chatgptApiUrl, geminiApiUrl, grokApiKey, grokApiUrl, modelOptions } from '~/logic'

export const webdavUrl = useStorage('webdav-url', '')
export const webdavUsername = useStorage('webdav-username', '')
export const webdavPassword = useStorage('webdav-password', '')

const googleApiKey = useStorage('google-api-key', '')
const concisePrompt = useStorage('concise-prompt', '')
const detailedPrompt = useStorage('detailed-prompt', '')
const novelPrompt = useStorage('novel-prompt', '')
const customPrompts = useStorage('custom-prompt', '')

// 上次上传/下载的时间戳，用于增量同步
const lastUploadTime = useStorage('webdav-last-upload-time', 0)
const lastDownloadTime = useStorage('webdav-last-download-time', 0)

const favoriteResults = useIDBKeyval<FavoriteResult[] | undefined>('favorite-results', undefined)

export const webdavSyncing = ref(false)
export const webdavStatus = ref('')

const DIR = '/fuck-or-not'
const DIR_IMAGES = `${DIR}/images`

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, '')
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  if (webdavUsername.value || webdavPassword.value)
    headers.Authorization = `Basic ${btoa(`${webdavUsername.value}:${webdavPassword.value}`)}`
  return headers
}

async function webdavRequest(path: string, method: string, body?: string, contentType?: string): Promise<Response> {
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
  // 405 = already exists，忽略
  if (!res.ok && res.status !== 405)
    throw new Error(`MKCOL ${path} failed: ${res.status} ${res.statusText}`)
}

async function ensureDirs() {
  await webdavMkcol(DIR)
  await webdavMkcol(DIR_IMAGES)
}

type FavoriteWithoutImage = Omit<FavoriteResult, 'image'>

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
  webdavStatus.value = ''
  try {
    await ensureDirs()

    // 上传设置
    await webdavPut(`${DIR}/settings.json`, JSON.stringify(buildSettings(), null, 2))

    const allItems = favoriteResults.data.value ?? []
    // 只上传上次同步后新增的条目
    const newItems = lastUploadTime.value === 0
      ? allItems
      : allItems.filter(item => item.time > lastUploadTime.value)

    // 上传新增图片
    let uploadedImages = 0
    for (const item of newItems) {
      if (item.image) {
        await webdavPut(`${DIR_IMAGES}/${item.time}.b64`, item.image, 'text/plain')
        uploadedImages++
      }
    }

    // 上传不含 image 的收藏列表（全量，供下载端对比）
    const favWithoutImage: FavoriteWithoutImage[] = allItems.map(({ image: _image, ...rest }) => rest)
    await webdavPut(`${DIR}/favorites.json`, JSON.stringify(favWithoutImage, null, 2))

    lastUploadTime.value = Date.now()
    webdavStatus.value = `上传成功（新增 ${newItems.length} 条，图片 ${uploadedImages} 张）`
  }
  catch (e: any) {
    webdavStatus.value = `上传失败：${e.message}`
  }
  finally {
    webdavSyncing.value = false
  }
}

export async function webdavDownload() {
  if (!webdavUrl.value) {
    webdavStatus.value = '请先填写 WebDAV 地址'
    return
  }
  webdavSyncing.value = true
  webdavStatus.value = ''
  try {
    // 下载设置
    const settingsText = await webdavGet(`${DIR}/settings.json`)
    if (settingsText)
      applySettings(JSON.parse(settingsText))

    // 下载收藏列表（不含图片）
    const favText = await webdavGet(`${DIR}/favorites.json`)
    if (!favText) {
      webdavStatus.value = '下载成功（无收藏数据）'
      return
    }

    const remoteFavs = JSON.parse(favText) as FavoriteWithoutImage[]
    if (!Array.isArray(remoteFavs)) {
      webdavStatus.value = '下载失败：数据格式不正确'
      return
    }

    const existingTimes = new Set(favoriteResults.data.value?.map(item => item.time) ?? [])
    // 只下载本地没有的条目
    const newRemoteItems = remoteFavs.filter(item => !existingTimes.has(item.time))

    // 按需下载图片
    let downloadedImages = 0
    const newItemsWithImage: FavoriteResult[] = []
    for (const item of newRemoteItems) {
      const imageText = await webdavGet(`${DIR_IMAGES}/${item.time}.b64`)
      newItemsWithImage.push({ ...item, image: imageText })
      if (imageText)
        downloadedImages++
    }

    if (newItemsWithImage.length > 0) {
      favoriteResults.data.value = [...(favoriteResults.data.value ?? []), ...newItemsWithImage]
        .sort((a, b) => b.time - a.time)
    }

    lastDownloadTime.value = Date.now()
    webdavStatus.value = `下载成功（新增 ${newItemsWithImage.length} 条，图片 ${downloadedImages} 张）`
  }
  catch (e: any) {
    webdavStatus.value = `下载失败：${e.message}`
  }
  finally {
    webdavSyncing.value = false
  }
}

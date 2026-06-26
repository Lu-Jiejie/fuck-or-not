import type { CustomPrompt, FavoriteResult, ProviderConfig } from '~/types'
import { useDark, useStorage, useToggle } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { defaultConcisePrompt, defaultDetailedPrompt, defaultNovelPrompt } from './prompts'

export const isDark = useDark()
export const toggleDark = useToggle(isDark)

// ──────────────────────────────────────────────
// Providers（供应商）
// ──────────────────────────────────────────────
export const providers = useStorage<ProviderConfig[]>('providers', [])

// 从旧版配置迁移到新版 providers
function migrateOldProviders() {
  if (providers.value.length > 0)
    return

  const migrated: ProviderConfig[] = []

  // Gemini
  const geminiKey = localStorage.getItem('google-api-key')
  const geminiUrl = localStorage.getItem('gemini-api-url')
  const geminiModelsRaw = localStorage.getItem('gemini-models')
  if (geminiKey || geminiUrl) {
    let models: string[] = []
    try { models = JSON.parse(geminiModelsRaw || '[]') }
    catch { /* ignore */ }
    if (models.length === 0)
      models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash']
    migrated.push({
      id: 'migrated-gemini',
      name: 'Gemini',
      type: 'gemini',
      apiUrl: geminiUrl || 'https://generativelanguage.googleapis.com',
      apiKey: geminiKey || '',
      models,
    })
  }

  // Grok
  const grokKey = localStorage.getItem('grok-api-key')
  const grokUrl = localStorage.getItem('grok-api-url')
  const grokModelsRaw = localStorage.getItem('grok-models')
  if (grokKey || grokUrl) {
    let models: string[] = []
    try { models = JSON.parse(grokModelsRaw || '[]') }
    catch { /* ignore */ }
    if (models.length === 0)
      models = ['grok-4-1-fast-reasoning', 'grok-4-fast-reasoning', 'grok-4', 'grok-2-image-1212']
    migrated.push({
      id: 'migrated-grok',
      name: 'Grok',
      type: 'openai',
      apiUrl: grokUrl || 'https://api.x.ai',
      apiKey: grokKey || '',
      models,
    })
  }

  // ChatGPT
  const chatgptKey = localStorage.getItem('chatgpt-api-key')
  const chatgptUrl = localStorage.getItem('chatgpt-api-url')
  const chatgptModelsRaw = localStorage.getItem('chatgpt-models')
  if (chatgptKey || chatgptUrl) {
    let models: string[] = []
    try { models = JSON.parse(chatgptModelsRaw || '[]') }
    catch { /* ignore */ }
    if (models.length === 0)
      models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4']
    migrated.push({
      id: 'migrated-chatgpt',
      name: 'ChatGPT',
      type: 'openai',
      apiUrl: chatgptUrl || 'https://api.openai.com',
      apiKey: chatgptKey || '',
      models,
    })
  }

  if (migrated.length > 0) {
    providers.value = migrated
    console.log('[Migration] Migrated old provider configs', migrated.map(p => p.name))
  }
  // 不清除旧 localStorage key，用户可手动清理
}

migrateOldProviders()

export function fetchModelsFromAPI(provider: ProviderConfig): Promise<string[]> {
  const { type, apiUrl, apiKey } = provider
  if (!apiKey)
    return Promise.reject(new Error('请先配置 API 密钥'))

  if (type === 'gemini') {
    return fetchGeminiModels(apiUrl, apiKey)
  }
  else {
    return fetchOpenAIModels(apiUrl, apiKey)
  }
}

async function fetchGeminiModels(baseUrl: string, apiKey: string): Promise<string[]> {
  // 先尝试标准 Gemini API
  try {
    const url = `${baseUrl}/v1beta/models?key=${apiKey}`
    const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
    if (response.ok) {
      const data = await response.json()
      let models = data.models || []
      if (models.length > 0 && models[0].supportedGenerationMethods)
        models = models.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      return models.map((m: any) => m.name?.replace('models/', '') || m.name)
    }
  }
  catch { /* fall through */ }

  // 降级：OpenAI 兼容格式
  const url = `${baseUrl}/v1/models`
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
  })
  if (!response.ok)
    throw new Error(`获取模型失败 (${response.status})`)
  const data = await response.json()
  return data.data?.map((m: any) => m.id) || []
}

async function fetchOpenAIModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = `${baseUrl}/v1/models`
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
  })
  if (!response.ok)
    throw new Error(`获取模型失败 (${response.status})`)
  const data = await response.json()
  return data.data?.map((m: any) => m.id) || []
}

function normalizeApiUrl(url: string, defaultUrl: string): string {
  if (!url)
    return defaultUrl
  url = url.replace(/\/$/, '')
  if (!url.endsWith('/v1/chat/completions'))
    url += '/v1/chat/completions'
  return url
}

// ──────────────────────────────────────────────
// generateContent
// ──────────────────────────────────────────────
export async function generateContent(
  model: string,
  contents: any,
  systemInstruction: string,
  provider: ProviderConfig,
  onChunk?: (text: string) => void,
) {
  if (provider.type === 'gemini') {
    return generateGeminiContent(model, contents, systemInstruction, provider, onChunk)
  }
  else {
    return generateOpenAIContent(model, contents, systemInstruction, provider, onChunk)
  }
}

async function generateGeminiContent(
  model: string,
  contents: any,
  systemInstruction: string,
  provider: ProviderConfig,
  _onChunk?: (text: string) => void,
) {
  const { apiKey, apiUrl: rawUrl } = provider
  if (!apiKey)
    throw new Error('API key not set')

  const baseUrl = rawUrl || 'https://generativelanguage.googleapis.com'
  const isStandardGemini = baseUrl.includes('generativelanguage.googleapis.com') || baseUrl.includes('gemini')

  if (isStandardGemini) {
    // 标准 Gemini API 格式
    const apiUrl = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`
    const requestBody: any = {
      contents: Array.isArray(contents)
        ? contents.map((content: any) => {
            if (typeof content === 'string')
              return { role: 'user', parts: [{ text: content }] }
            if ('text' in content && content.text)
              return { role: 'user', parts: [{ text: content.text }] }
            if ('inlineData' in content && content.inlineData)
              return { role: 'user', parts: [{ inlineData: { mimeType: content.inlineData.mimeType, data: content.inlineData.data } }] }
            return content
          })
        : [contents],
      generationConfig: { temperature: 0.7 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
      ],
    }
    if (systemInstruction)
      requestBody.systemInstruction = { parts: [{ text: systemInstruction }] }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
    if (!response.ok)
      throw new Error(`Gemini API error (${response.status}): ${await response.text()}`)

    const data = await response.json()
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      candidates: [{ finishReason: data.candidates?.[0]?.finishReason || 'STOP' }],
    }
  }
  else {
    // 非标准 Gemini URL → OpenAI 兼容格式
    const apiUrl = normalizeApiUrl(baseUrl, `${baseUrl}/v1/chat/completions`)
    const messages = buildOpenAIMessages(contents, systemInstruction)

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.7 }),
    })
    if (!response.ok)
      throw new Error(`Gemini (OpenAI format) API error (${response.status}): ${await response.text()}`)

    const data = await response.json()
    return {
      text: data.choices?.[0]?.message?.content || '',
      candidates: [{ finishReason: data.choices?.[0]?.finish_reason === 'content_filter' ? 'PROHIBITED_CONTENT' : 'STOP' }],
    }
  }
}

async function generateOpenAIContent(
  model: string,
  contents: any,
  systemInstruction: string,
  provider: ProviderConfig,
  onChunk?: (text: string) => void,
) {
  const { apiKey, apiUrl: rawUrl } = provider
  if (!apiKey)
    throw new Error('API key not set')

  const apiUrl = normalizeApiUrl(rawUrl, 'https://api.openai.com/v1/chat/completions')
  const messages = buildOpenAIMessages(contents, systemInstruction)

  if (onChunk) {
    // SSE 流式响应
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.7, stream: true }),
    })
    if (!response.ok)
      throw new Error(`API error (${response.status}): ${await response.text()}`)

    const reader = response.body?.getReader()
    if (!reader)
      throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let fullText = ''
    let finishReason = 'STOP'
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: '))
          continue
        const dataStr = line.slice(6)
        if (dataStr === '[DONE]')
          continue
        try {
          const data = JSON.parse(dataStr)
          const delta = data.choices?.[0]?.delta
          if (delta?.content) {
            fullText += delta.content
            onChunk(delta.content)
          }
          if (data.choices?.[0]?.finish_reason)
            finishReason = data.choices[0].finish_reason
        }
        catch { /* skip parse error */ }
      }
    }
    // 处理剩余 buffer
    if (buffer.trim() && buffer.startsWith('data: ')) {
      const dataStr = buffer.slice(6)
      if (dataStr !== '[DONE]') {
        try {
          const data = JSON.parse(dataStr)
          const delta = data.choices?.[0]?.delta
          if (delta?.content) {
            fullText += delta.content
            onChunk(delta.content)
          }
          if (data.choices?.[0]?.finish_reason)
            finishReason = data.choices[0].finish_reason
        }
        catch { /* skip */ }
      }
    }
    return {
      text: fullText,
      candidates: [{ finishReason: finishReason === 'content_filter' ? 'PROHIBITED_CONTENT' : 'STOP' }],
    }
  }
  else {
    // 非流式
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.7 }),
    })
    if (!response.ok)
      throw new Error(`API error (${response.status}): ${await response.text()}`)
    const data = await response.json()
    return {
      text: data.choices?.[0]?.message?.content || '',
      candidates: [{ finishReason: data.choices?.[0]?.finish_reason === 'content_filter' ? 'PROHIBITED_CONTENT' : 'STOP' }],
    }
  }
}

function buildOpenAIMessages(contents: any, systemInstruction: string): any[] {
  const messages: any[] = []
  if (systemInstruction)
    messages.push({ role: 'system', content: systemInstruction })

  for (const content of Array.isArray(contents) ? contents : [contents]) {
    if (typeof content === 'string') {
      messages.push({ role: 'user', content })
    }
    else if ('text' in content && content.text) {
      messages.push({ role: 'user', content: content.text })
    }
    else if ('inlineData' in content && content.inlineData) {
      messages.push({
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: `data:${content.inlineData.mimeType};base64,${content.inlineData.data}` } }],
      })
    }
  }
  // 合并连续 user 消息
  const merged: any[] = []
  for (const msg of messages) {
    if (msg.role === 'system') { merged.push(msg); continue }
    const last = merged[merged.length - 1]
    if (last && last.role === 'user') {
      if (Array.isArray(last.content) && Array.isArray(msg.content))
        last.content.push(...msg.content)
      else if (Array.isArray(last.content) && typeof msg.content === 'string')
        last.content.push({ type: 'text', text: msg.content })
      else if (typeof last.content === 'string' && Array.isArray(msg.content))
        last.content = [{ type: 'text', text: last.content }, ...msg.content]
      else
        merged.push(msg)
    }
    else {
      merged.push(msg)
    }
  }
  return merged
}

// ──────────────────────────────────────────────
// Prompt 系统
// ──────────────────────────────────────────────
export const defaultPrompts: CustomPrompt[] = [
  { id: 'concise', name: '简洁', content: defaultConcisePrompt },
  { id: 'detailed', name: '详细', content: defaultDetailedPrompt },
  { id: 'novel', name: '小说', content: defaultNovelPrompt },
]

export const customPrompts = useStorage<CustomPrompt[]>('custom-prompts', [])

function migratePrompts() {
  if (customPrompts.value.length > 0)
    return
  const migrated: CustomPrompt[] = []
  try {
    for (const [id, name, key] of [['concise', '简洁', 'concise-prompt'], ['detailed', '详细', 'detailed-prompt'], ['novel', '小说', 'novel-prompt']] as const) {
      const raw = localStorage.getItem(key)
      if (!raw)
        continue
      try {
        const content = JSON.parse(raw)
        if (content && content !== '')
          migrated.push({ id, name, content })
      }
      catch {
        if (raw && raw !== '' && raw !== 'null' && raw !== 'undefined')
          migrated.push({ id, name, content: raw })
      }
    }
    const oldCustom = localStorage.getItem('custom-prompt')
    if (oldCustom) {
      try {
        const content = JSON.parse(oldCustom)
        if (content && content !== '')
          migrated.push({ id: 'custom', name: '自定义', content })
      }
      catch {
        if (oldCustom && oldCustom !== '' && oldCustom !== 'null' && oldCustom !== 'undefined')
          migrated.push({ id: 'custom', name: '自定义', content: oldCustom })
      }
    }
    customPrompts.value = migrated.length > 0 ? migrated : [...defaultPrompts]
  }
  catch {
    customPrompts.value = [...defaultPrompts]
  }
}

function initializePrompts() {
  if (customPrompts.value.length === 0)
    migratePrompts()
}

initializePrompts()

export function addPrompt(name: string, content = '') {
  customPrompts.value.push({ id: `prompt_${Date.now()}`, name: name.trim(), content })
}

export function removePrompt(id: string) {
  if (customPrompts.value.length <= 1)
    return false
  const idx = customPrompts.value.findIndex(p => p.id === id)
  if (idx !== -1) { customPrompts.value.splice(idx, 1); return true }
  return false
}

export function updatePrompt(id: string, updates: Partial<CustomPrompt>) {
  const idx = customPrompts.value.findIndex(p => p.id === id)
  if (idx !== -1)
    customPrompts.value[idx] = { ...customPrompts.value[idx], ...updates }
}

export function resetPrompts() {
  customPrompts.value = [...defaultPrompts]
}

export function getPromptById(id: string): CustomPrompt | undefined {
  return customPrompts.value.find(p => p.id === id)
}

// 额外提示词预设
export const additionalPromptPresets = useStorage<CustomPrompt[]>('additional-prompt-presets', [])

export function truncateText(text: string, maxLen = 30): string {
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text
}

export function addAdditionalPreset(name: string, content: string): string {
  const id = `ap_${Date.now()}`
  additionalPromptPresets.value.push({ id, name: name.trim(), content: content.trim() })
  return id
}

export function removeAdditionalPreset(id: string) {
  const idx = additionalPromptPresets.value.findIndex(p => p.id === id)
  if (idx !== -1)
    additionalPromptPresets.value.splice(idx, 1)
}

// ──────────────────────────────────────────────
// 图片 & 文件工具
// ──────────────────────────────────────────────
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string')
        resolve(reader.result.split(',')[1])
      reject(new Error('File reading failed'))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function computeImageHash(base64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

export async function computeStringHash(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

// ──────────────────────────────────────────────
// Favorites（收藏）
// ──────────────────────────────────────────────
export const imageStore = useIDBKeyval<Record<string, string>>('favorite-images', {}, { shallow: true })

export const favoriteResults = useIDBKeyval<FavoriteResult[] | undefined>('favorite-results', undefined)

export async function saveImage(base64: string, mimeType: string): Promise<string> {
  const hash = await computeImageHash(base64)
  if (!imageStore.data.value[hash])
    imageStore.data.value = { ...imageStore.data.value, [hash]: base64 }
  if (!imageStore.data.value[`${hash}:mime`])
    imageStore.data.value = { ...imageStore.data.value, [`${hash}:mime`]: mimeType }
  return hash
}

export function getImageByHash(hash: string): { base64: string, mimeType: string } {
  return {
    base64: imageStore.data.value[hash] ?? '',
    mimeType: imageStore.data.value[`${hash}:mime`] ?? 'image/png',
  }
}

export function deleteImageIfUnused(hash: string, usedHashes: Set<string>) {
  if (!usedHashes.has(hash)) {
    const next = { ...imageStore.data.value }
    delete next[hash]
    delete next[`${hash}:mime`]
    imageStore.data.value = next
  }
}

export const deletedTimestampsStore = useIDBKeyval<number[]>('favorite-deleted-timestamps', [])

export function markAsDeleted(time: number) {
  const current = deletedTimestampsStore.data.value
  if (!current.includes(time))
    deletedTimestampsStore.data.value = [...current, time]
}

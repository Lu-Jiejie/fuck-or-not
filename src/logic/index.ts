import type { AIProvider, CustomPrompt, FavoriteResult, ModelOption } from '~/types'
import { useDark, useStorage, useToggle } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { defaultConcisePrompt, defaultDetailedPrompt, defaultNovelPrompt } from './prompts'

export const isDark = useDark()
export const toggleDark = useToggle(isDark)

export const googleApiKey = useStorage('google-api-key', '')
export const geminiApiUrl = useStorage('gemini-api-url', '')
export const grokApiKey = useStorage('grok-api-key', '')
export const grokApiUrl = useStorage('grok-api-url', '')
export const chatgptApiKey = useStorage('chatgpt-api-key', '')
export const chatgptApiUrl = useStorage('chatgpt-api-url', '')

// 默认 Prompt 列表
export const defaultPrompts: CustomPrompt[] = [
  {
    id: 'concise',
    name: '简洁',
    content: defaultConcisePrompt,
  },
  {
    id: 'detailed',
    name: '详细',
    content: defaultDetailedPrompt,
  },
  {
    id: 'novel',
    name: '小说',
    content: defaultNovelPrompt,
  },
]

// 用户自定义 Prompt 列表
export const customPrompts = useStorage<CustomPrompt[]>('custom-prompts', [])

// 从旧版单个 Prompt 存储迁移到新的列表格式
function migratePrompts() {
  // 如果新版已有数据，跳过迁移
  if (customPrompts.value.length > 0) {
    return
  }

  const migrated: CustomPrompt[] = []

  // 尝试读取旧版 Prompt（直接从 localStorage 读取，不使用 useStorage）
  try {
    const oldConcise = localStorage.getItem('concise-prompt')
    const oldDetailed = localStorage.getItem('detailed-prompt')
    const oldNovel = localStorage.getItem('novel-prompt')
    const oldCustom = localStorage.getItem('custom-prompt')

    // 迁移简洁模式
    if (oldConcise) {
      try {
        const content = JSON.parse(oldConcise)
        if (content && content !== '') {
          migrated.push({ id: 'concise', name: '简洁', content })
        }
      }
      catch {
        // 如果不是 JSON，可能是直接存储的字符串
        if (oldConcise && oldConcise !== '' && oldConcise !== 'null' && oldConcise !== 'undefined') {
          migrated.push({ id: 'concise', name: '简洁', content: oldConcise })
        }
      }
    }

    // 迁移详细模式
    if (oldDetailed) {
      try {
        const content = JSON.parse(oldDetailed)
        if (content && content !== '') {
          migrated.push({ id: 'detailed', name: '详细', content })
        }
      }
      catch {
        if (oldDetailed && oldDetailed !== '' && oldDetailed !== 'null' && oldDetailed !== 'undefined') {
          migrated.push({ id: 'detailed', name: '详细', content: oldDetailed })
        }
      }
    }

    // 迁移小说模式
    if (oldNovel) {
      try {
        const content = JSON.parse(oldNovel)
        if (content && content !== '') {
          migrated.push({ id: 'novel', name: '小说', content })
        }
      }
      catch {
        if (oldNovel && oldNovel !== '' && oldNovel !== 'null' && oldNovel !== 'undefined') {
          migrated.push({ id: 'novel', name: '小说', content: oldNovel })
        }
      }
    }

    // 迁移自定义模式
    if (oldCustom) {
      try {
        const content = JSON.parse(oldCustom)
        if (content && content !== '') {
          migrated.push({ id: 'custom', name: '自定义', content })
        }
      }
      catch {
        if (oldCustom && oldCustom !== '' && oldCustom !== 'null' && oldCustom !== 'undefined') {
          migrated.push({ id: 'custom', name: '自定义', content: oldCustom })
        }
      }
    }

    // 如果迁移到了数据，使用迁移的数据；否则使用默认数据
    if (migrated.length > 0) {
      customPrompts.value = migrated
      console.log('[Migration] Migrated prompts from old format')
    }
    else {
      customPrompts.value = [...defaultPrompts]
    }
  }
  catch (error) {
    console.error('[Migration] Error migrating prompts:', error)
    customPrompts.value = [...defaultPrompts]
  }
}

// 初始化 Prompts
function initializePrompts() {
  if (customPrompts.value.length === 0) {
    migratePrompts()
  }
}

initializePrompts()

// Prompt 管理函数
export function addPrompt(name: string, content: string = '') {
  const id = `prompt_${Date.now()}`
  customPrompts.value.push({ id, name: name.trim(), content })
}

export function removePrompt(id: string) {
  // 至少保留一个 Prompt
  if (customPrompts.value.length <= 1) {
    return false
  }
  const index = customPrompts.value.findIndex(p => p.id === id)
  if (index !== -1) {
    customPrompts.value.splice(index, 1)
    return true
  }
  return false
}

export function updatePrompt(id: string, updates: Partial<CustomPrompt>) {
  const index = customPrompts.value.findIndex(p => p.id === id)
  if (index !== -1) {
    customPrompts.value[index] = { ...customPrompts.value[index], ...updates }
  }
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
  additionalPromptPresets.value.push({
    id,
    name: name.trim(),
    content: content.trim(),
  })
  return id
}

export function removeAdditionalPreset(id: string) {
  const idx = additionalPromptPresets.value.findIndex(p => p.id === id)
  if (idx !== -1) {
    additionalPromptPresets.value.splice(idx, 1)
  }
}

function normalizeApiUrl(url: string, defaultUrl: string): string {
  if (!url)
    return defaultUrl

  url = url.replace(/\/$/, '')

  if (!url.endsWith('/v1/chat/completions'))
    url += '/v1/chat/completions'

  return url
}

export const defaultGeminiModels: string[] = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash',
]

export const defaultGrokModels: string[] = [
  'grok-4-1-fast-reasoning',
  'grok-4-fast-reasoning',
  'grok-4',
  'grok-2-image-1212',
]

export const defaultChatGPTModels: string[] = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
]

export const defaultModelOptions: ModelOption[] = [
  ...defaultGeminiModels.map(id => ({ id, provider: 'Gemini' as AIProvider })),
  ...defaultGrokModels.map(id => ({ id, provider: 'Grok' as AIProvider })),
  ...defaultChatGPTModels.map(id => ({ id, provider: 'ChatGPT' as AIProvider })),
]

function migrateModelOptions(): ModelOption[] {
  const stored = localStorage.getItem('model-options')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // If it's already in the new format
        if (typeof parsed[0] === 'object' && parsed[0].id && parsed[0].provider) {
          return parsed
        }
        // If it's old string array format
        if (typeof parsed[0] === 'string') {
          const migrated = parsed.map((model: string) => ({
            id: model,
            provider: 'Gemini' as AIProvider,
          }))
          localStorage.setItem('model-options', JSON.stringify(migrated))
          return migrated
        }
        // If it's old object format with 'value' property
        if (parsed[0].value) {
          const migrated = parsed.map((item: { value: string }) => ({
            id: item.value,
            provider: 'Gemini' as AIProvider,
          }))
          localStorage.setItem('model-options', JSON.stringify(migrated))
          return migrated
        }
      }
    }
    catch {
      // Parse failed, use default
    }
  }
  return [...defaultModelOptions]
}

// 按提供商分组的模型列表
export const geminiModels = useStorage<string[]>('gemini-models', [])
export const grokModels = useStorage<string[]>('grok-models', [])
export const chatgptModels = useStorage<string[]>('chatgpt-models', [])

// 兼容旧版的统一模型列表（用于迁移）
export const modelOptions = useStorage<ModelOption[]>('model-options', [])

function needsMigration(data: any[]): boolean {
  if (data.length === 0)
    return false

  const first = data[0]
  return typeof first === 'string'
    || (typeof first === 'object' && !first.provider)
}

// 从旧版统一模型列表迁移到分组模型列表
function migrateToProviderModels() {
  const oldModels = modelOptions.value

  // 如果旧版模型列表存在且新版为空，则进行迁移
  if (oldModels.length > 0 && geminiModels.value.length === 0 && grokModels.value.length === 0 && chatgptModels.value.length === 0) {
    const gemini: string[] = []
    const grok: string[] = []
    const chatgpt: string[] = []

    for (const model of oldModels) {
      if (model.provider === 'Gemini') {
        gemini.push(model.id)
      }
      else if (model.provider === 'Grok') {
        grok.push(model.id)
      }
      else if (model.provider === 'ChatGPT') {
        chatgpt.push(model.id)
      }
    }

    if (gemini.length > 0)
      geminiModels.value = gemini
    if (grok.length > 0)
      grokModels.value = grok
    if (chatgpt.length > 0)
      chatgptModels.value = chatgpt

    console.log('[Migration] Migrated models to provider-based storage', {
      gemini: gemini.length,
      grok: grok.length,
      chatgpt: chatgpt.length,
    })
  }
}

function initializeModelOptions() {
  const current = modelOptions.value

  // 兼容旧版数据格式
  if (current.length === 0 || needsMigration(current)) {
    modelOptions.value = migrateModelOptions()
  }

  // 先执行迁移（如果需要），这样可以从旧版 model-options 迁移数据
  migrateToProviderModels()

  // 如果迁移后分组模型列表仍为空，则初始化为默认值
  if (geminiModels.value.length === 0) {
    geminiModels.value = [...defaultGeminiModels]
  }
  if (grokModels.value.length === 0) {
    grokModels.value = [...defaultGrokModels]
  }
  if (chatgptModels.value.length === 0) {
    chatgptModels.value = [...defaultChatGPTModels]
  }
}

initializeModelOptions()

export function addModel(model: ModelOption) {
  modelOptions.value.push(model)
}

export function removeModel(index: number) {
  modelOptions.value.splice(index, 1)
}

export function updateModel(index: number, model: ModelOption) {
  modelOptions.value[index] = model
}

export function resetModelOptions() {
  modelOptions.value = [...defaultModelOptions]
}

// 新的按提供商管理模型的函数
export function addProviderModel(provider: AIProvider, modelId: string) {
  const trimmedId = modelId.trim()
  if (!trimmedId)
    return

  switch (provider) {
    case 'Gemini':
      if (!geminiModels.value.includes(trimmedId)) {
        geminiModels.value.push(trimmedId)
      }
      break
    case 'Grok':
      if (!grokModels.value.includes(trimmedId)) {
        grokModels.value.push(trimmedId)
      }
      break
    case 'ChatGPT':
      if (!chatgptModels.value.includes(trimmedId)) {
        chatgptModels.value.push(trimmedId)
      }
      break
  }
}

export function removeProviderModel(provider: AIProvider, index: number) {
  switch (provider) {
    case 'Gemini':
      geminiModels.value.splice(index, 1)
      break
    case 'Grok':
      grokModels.value.splice(index, 1)
      break
    case 'ChatGPT':
      chatgptModels.value.splice(index, 1)
      break
  }
}

export function updateProviderModel(provider: AIProvider, index: number, newId: string) {
  const trimmedId = newId.trim()
  if (!trimmedId)
    return

  switch (provider) {
    case 'Gemini':
      geminiModels.value[index] = trimmedId
      break
    case 'Grok':
      grokModels.value[index] = trimmedId
      break
    case 'ChatGPT':
      chatgptModels.value[index] = trimmedId
      break
  }
}

export function resetProviderModels(provider?: AIProvider) {
  if (!provider) {
    // 重置所有
    geminiModels.value = [...defaultGeminiModels]
    grokModels.value = [...defaultGrokModels]
    chatgptModels.value = [...defaultChatGPTModels]
  }
  else {
    switch (provider) {
      case 'Gemini':
        geminiModels.value = [...defaultGeminiModels]
        break
      case 'Grok':
        grokModels.value = [...defaultGrokModels]
        break
      case 'ChatGPT':
        chatgptModels.value = [...defaultChatGPTModels]
        break
    }
  }
}

export function getProviderModels(provider: AIProvider): string[] {
  switch (provider) {
    case 'Gemini':
      return geminiModels.value
    case 'Grok':
      return grokModels.value
    case 'ChatGPT':
      return chatgptModels.value
    default:
      return []
  }
}

// 从 API 获取模型列表
export async function fetchModelsFromAPI(provider: AIProvider): Promise<string[]> {
  try {
    if (provider === 'Gemini') {
      const apiKey = googleApiKey.value
      if (!apiKey) {
        throw new Error('请先配置 Gemini API 密钥')
      }

      const baseUrl = geminiApiUrl.value || 'https://generativelanguage.googleapis.com'

      // 先尝试标准 Gemini API
      try {
        const url = `${baseUrl}/v1beta/models?key=${apiKey}`
        console.log('[Gemini Models API] 尝试标准 Gemini API:', url)

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          console.log('[Gemini Models API] 返回数据:', data)

          // 提取模型列表
          let models = data.models || []

          // 检查第一个模型是否有 supportedGenerationMethods 字段
          if (models.length > 0 && models[0].supportedGenerationMethods) {
            models = models.filter((model: any) =>
              model.supportedGenerationMethods?.includes('generateContent'),
            )
          }

          // 提取模型名称
          const modelNames = models.map((model: any) => {
            return model.name?.replace('models/', '') || model.name
          })

          console.log('[Gemini Models API] 过滤后的模型:', modelNames)
          return modelNames
        }
      }
      catch (error) {
        console.warn('[Gemini Models API] 标准 API 失败，尝试 OpenAI 兼容格式:', error)
      }

      // 如果标准 API 失败，尝试 OpenAI 兼容格式
      const openaiUrl = `${baseUrl}/v1/models`
      console.log('[Gemini Models API] 尝试 OpenAI 兼容格式:', openaiUrl)

      const response = await fetch(openaiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[Gemini Models API] 错误响应:', error)
        throw new Error(`Gemini API 错误 (${response.status}): ${error}`)
      }

      const data = await response.json()
      console.log('[Gemini Models API] OpenAI 格式返回数据:', data)

      // OpenAI 格式：{ data: [{ id: 'model-name', ... }] }
      const models = data.data?.map((model: any) => model.id) || []
      console.log('[Gemini Models API] 提取的模型:', models)

      return models
    }
    else if (provider === 'Grok') {
      const apiKey = grokApiKey.value
      if (!apiKey) {
        throw new Error('请先配置 Grok API 密钥')
      }

      const baseUrl = grokApiUrl.value || 'https://api.x.ai'
      const url = `${baseUrl}/v1/models`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Grok API 错误 (${response.status}): ${error}`)
      }

      const data = await response.json()
      const models = data.data?.map((model: any) => model.id) || []

      return models
    }
    else if (provider === 'ChatGPT') {
      const apiKey = chatgptApiKey.value
      if (!apiKey) {
        throw new Error('请先配置 ChatGPT API 密钥')
      }

      const baseUrl = chatgptApiUrl.value || 'https://api.openai.com'
      const url = `${baseUrl}/v1/models`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`ChatGPT API 错误 (${response.status}): ${error}`)
      }

      const data = await response.json()
      // 过滤出 GPT 模型
      const models = data.data
        ?.filter((model: any) =>
          model.id.startsWith('gpt-')
          || model.id.startsWith('o1-')
          || model.id.startsWith('chatgpt-'),
        )
        ?.map((model: any) => model.id) || []

      return models
    }

    throw new Error(`不支持的提供商: ${provider}`)
  }
  catch (error) {
    console.error(`[${provider}] 获取模型列表失败:`, error)
    throw error
  }
}

export async function generateContent(model: string, contents: any, systemInstruction: string, provider: AIProvider, onChunk?: (text: string) => void) {
  if (provider === 'Gemini') {
    const apiKey = googleApiKey.value
    if (!apiKey) {
      throw new Error('Gemini API key not set')
    }

    const baseUrl = geminiApiUrl.value || 'https://generativelanguage.googleapis.com'

    // 判断是否为标准 Gemini API（包含 generativelanguage.googleapis.com）
    const isStandardGemini = baseUrl.includes('generativelanguage.googleapis.com') || baseUrl.includes('gemini')

    if (isStandardGemini) {
      // 使用标准 Gemini API 格式
      const apiUrl = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`
      console.log('[Gemini Request] 使用标准 Gemini API:', { model, apiUrl })

      // 构建请求体
      const requestBody: any = {
        contents: Array.isArray(contents)
          ? contents.map((content: any) => {
              if (typeof content === 'string') {
                return {
                  role: 'user',
                  parts: [{ text: content }],
                }
              }
              else if ('text' in content && content.text) {
                return {
                  role: 'user',
                  parts: [{ text: content.text }],
                }
              }
              else if ('inlineData' in content && content.inlineData) {
                return {
                  role: 'user',
                  parts: [{
                    inlineData: {
                      mimeType: content.inlineData.mimeType,
                      data: content.inlineData.data,
                    },
                  }],
                }
              }
              return content
            })
          : [contents],
        generationConfig: {
          temperature: 0.7,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
        ],
      }

      if (systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: systemInstruction }],
        }
      }

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const error = await response.text()
          console.error('[Gemini Error]', { status: response.status, statusText: response.statusText, error })
          throw new Error(`Gemini API error (${response.status}): ${error}`)
        }

        const data = await response.json()
        console.log('[Gemini Response]', data)

        // 提取文本内容
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const finishReason = data.candidates?.[0]?.finishReason || 'STOP'

        return {
          text,
          candidates: [{
            finishReason,
          }],
        }
      }
      catch (error) {
        console.error('[Gemini Error]', { model, apiUrl, error })
        throw error
      }
    }
    else {
      // 使用 OpenAI 兼容格式
      const apiUrl = normalizeApiUrl(baseUrl, `${baseUrl}/v1/chat/completions`)
      console.log('[Gemini Request] 使用 OpenAI 兼容格式:', { model, apiUrl })

      const messages: any[] = []

      if (systemInstruction) {
        messages.push({
          role: 'system',
          content: systemInstruction,
        })
      }

      // 转换 contents 为 messages
      for (const content of Array.isArray(contents) ? contents : [contents]) {
        if (typeof content === 'string') {
          messages.push({
            role: 'user',
            content,
          })
        }
        else if ('text' in content && content.text) {
          messages.push({
            role: 'user',
            content: content.text,
          })
        }
        else if ('inlineData' in content && content.inlineData) {
          // 处理图片数据
          messages.push({
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${content.inlineData.mimeType};base64,${content.inlineData.data}`,
                },
              },
            ],
          })
        }
        else if ('role' in content && 'parts' in content) {
          // 已经是 Gemini 格式的 content，需要转换
          const parts = content.parts || []
          for (const part of parts) {
            if (part.text) {
              messages.push({
                role: 'user',
                content: part.text,
              })
            }
            else if (part.inlineData) {
              messages.push({
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    },
                  },
                ],
              })
            }
            else if (part.fileData) {
              // fileData 格式暂不支持 OpenAI 格式，跳过
              console.warn('[Gemini] fileData 不支持 OpenAI 兼容格式')
            }
          }
        }
      }

      // 合并连续的用户消息
      const mergedMessages: any[] = []
      for (const msg of messages) {
        if (msg.role === 'system') {
          mergedMessages.push(msg)
          continue
        }

        const lastMsg = mergedMessages[mergedMessages.length - 1]
        if (lastMsg && lastMsg.role === 'user') {
          // 合并到前一个用户消息
          if (Array.isArray(lastMsg.content) && Array.isArray(msg.content)) {
            lastMsg.content.push(...msg.content)
          }
          else if (Array.isArray(lastMsg.content) && typeof msg.content === 'string') {
            lastMsg.content.push({ type: 'text', text: msg.content })
          }
          else if (typeof lastMsg.content === 'string' && Array.isArray(msg.content)) {
            lastMsg.content = [{ type: 'text', text: lastMsg.content }, ...msg.content]
          }
          else if (typeof lastMsg.content === 'string' && typeof msg.content === 'string') {
            lastMsg.content = `${lastMsg.content}\n${msg.content}`
          }
          else {
            mergedMessages.push(msg)
          }
        }
        else {
          mergedMessages.push(msg)
        }
      }

      const requestBody = {
        model,
        messages: mergedMessages,
        temperature: 0.7,
      }

      console.log('[Gemini OpenAI Format] 请求体:', JSON.stringify(requestBody, null, 2))

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const error = await response.text()
          console.error('[Gemini OpenAI Format Error]', { status: response.status, statusText: response.statusText, error })
          throw new Error(`Gemini API error (${response.status}): ${error}`)
        }

        const data = await response.json()
        console.log('[Gemini OpenAI Format Response]', data)

        // 转换为统一格式
        return {
          text: data.choices?.[0]?.message?.content || '',
          candidates: [{
            finishReason: data.choices?.[0]?.finish_reason === 'content_filter' ? 'PROHIBITED_CONTENT' : 'STOP',
          }],
        }
      }
      catch (error) {
        console.error('[Gemini OpenAI Format Error]', { model, apiUrl, error })
        throw error
      }
    }
  }
  else if (provider === 'Grok') {
    const apiKey = grokApiKey.value
    if (!apiKey) {
      throw new Error('Grok API key not set')
    }

    const apiUrl = normalizeApiUrl(grokApiUrl.value, 'https://api.x.ai/v1/chat/completions')
    console.log('[Grok Request]', { model, apiUrl })
    const messages: any[] = []

    if (systemInstruction) {
      messages.push({
        role: 'system',
        content: systemInstruction,
      })
    }

    // Convert contents to messages
    for (const content of Array.isArray(contents) ? contents : [contents]) {
      if (typeof content === 'string') {
        messages.push({
          role: 'user',
          content,
        })
      }
      else if ('text' in content && content.text) {
        messages.push({
          role: 'user',
          content: content.text,
        })
      }
      else if ('inlineData' in content && content.inlineData) {
        // Handle image data
        messages.push({
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${content.inlineData.mimeType};base64,${content.inlineData.data}`,
              },
            },
          ],
        })
      }
    }

    // Merge consecutive user messages with images
    const mergedMessages: any[] = []
    for (const msg of messages) {
      if (msg.role === 'system') {
        mergedMessages.push(msg)
        continue
      }

      const lastMsg = mergedMessages[mergedMessages.length - 1]
      if (lastMsg && lastMsg.role === 'user') {
        // Merge with previous user message
        if (Array.isArray(lastMsg.content) && Array.isArray(msg.content)) {
          lastMsg.content.push(...msg.content)
        }
        else if (Array.isArray(lastMsg.content) && typeof msg.content === 'string') {
          lastMsg.content.push({ type: 'text', text: msg.content })
        }
        else if (typeof lastMsg.content === 'string' && Array.isArray(msg.content)) {
          lastMsg.content = [{ type: 'text', text: lastMsg.content }, ...msg.content]
        }
        else {
          mergedMessages.push(msg)
        }
      }
      else {
        mergedMessages.push(msg)
      }
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: mergedMessages,
          temperature: 0.7,
          stream: true,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[Grok Error]', { status: response.status, statusText: response.statusText, error })
        throw new Error(`Grok API error (${response.status}): ${error}`)
      }

      // Handle SSE stream response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

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
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: '))
            continue

          const dataStr = line.slice(6) // Remove 'data: ' prefix
          if (dataStr === '[DONE]')
            continue

          try {
            const data = JSON.parse(dataStr)
            const delta = data.choices?.[0]?.delta
            if (delta?.content) {
              fullText += delta.content
              onChunk?.(delta.content)
            }
            if (data.choices?.[0]?.finish_reason) {
              finishReason = data.choices[0].finish_reason
            }
          }
          catch (parseError) {
            console.warn('[Grok] Failed to parse chunk:', dataStr, parseError)
          }
        }
      }

      // Process any remaining buffered line
      if (buffer.trim() && buffer.startsWith('data: ')) {
        const dataStr = buffer.slice(6)
        if (dataStr !== '[DONE]') {
          try {
            const data = JSON.parse(dataStr)
            const delta = data.choices?.[0]?.delta
            if (delta?.content) {
              fullText += delta.content
              onChunk?.(delta.content)
            }
            if (data.choices?.[0]?.finish_reason) {
              finishReason = data.choices[0].finish_reason
            }
          }
          catch (parseError) {
            console.warn('[Grok] Failed to parse final chunk:', dataStr, parseError)
          }
        }
      }

      // Convert OpenAI format response to Google AI format
      return {
        text: fullText,
        candidates: [{
          finishReason: finishReason === 'content_filter' ? 'PROHIBITED_CONTENT' : 'STOP',
        }],
      }
    }
    catch (error) {
      console.error('[Grok Error]', { model, apiUrl, error })
      throw error
    }
  }
  else if (provider === 'ChatGPT') {
    const apiKey = chatgptApiKey.value
    if (!apiKey) {
      throw new Error('ChatGPT API key not set')
    }

    const apiUrl = normalizeApiUrl(chatgptApiUrl.value, 'https://api.openai.com/v1/chat/completions')
    console.log('[ChatGPT Request]', { model, apiUrl })
    const messages: any[] = []

    if (systemInstruction) {
      messages.push({
        role: 'system',
        content: systemInstruction,
      })
    }

    // Convert contents to messages
    for (const content of Array.isArray(contents) ? contents : [contents]) {
      if (typeof content === 'string') {
        messages.push({
          role: 'user',
          content,
        })
      }
      else if ('text' in content && content.text) {
        messages.push({
          role: 'user',
          content: content.text,
        })
      }
      else if ('inlineData' in content && content.inlineData) {
        // Handle image data
        messages.push({
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${content.inlineData.mimeType};base64,${content.inlineData.data}`,
              },
            },
          ],
        })
      }
    }

    // Merge consecutive user messages with images
    const mergedMessages: any[] = []
    for (const msg of messages) {
      if (msg.role === 'system') {
        mergedMessages.push(msg)
        continue
      }

      const lastMsg = mergedMessages[mergedMessages.length - 1]
      if (lastMsg && lastMsg.role === 'user') {
        // Merge with previous user message
        if (Array.isArray(lastMsg.content) && Array.isArray(msg.content)) {
          lastMsg.content.push(...msg.content)
        }
        else if (Array.isArray(lastMsg.content) && typeof msg.content === 'string') {
          lastMsg.content.push({ type: 'text', text: msg.content })
        }
        else if (typeof lastMsg.content === 'string' && Array.isArray(msg.content)) {
          lastMsg.content = [{ type: 'text', text: lastMsg.content }, ...msg.content]
        }
        else {
          mergedMessages.push(msg)
        }
      }
      else {
        mergedMessages.push(msg)
      }
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: mergedMessages,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[ChatGPT Error]', { status: response.status, statusText: response.statusText, error })
        throw new Error(`ChatGPT API error (${response.status}): ${error}`)
      }

      const data = await response.json()

      // Convert OpenAI format response to Google AI format
      return {
        text: data.choices[0]?.message?.content || '',
        candidates: [{
          finishReason: data.choices[0]?.finish_reason === 'content_filter' ? 'PROHIBITED_CONTENT' : 'STOP',
        }],
      }
    }
    catch (error) {
      console.error('[ChatGPT Error]', { model, apiUrl, error })
      throw error
    }
  }

  throw new Error(`Unsupported provider: ${provider}`)
}

export async function uploadFileToAPI(file: File) {
  const apiKey = googleApiKey.value
  if (!apiKey) {
    throw new Error('Gemini API key not set')
  }

  const baseUrl = geminiApiUrl.value || 'https://generativelanguage.googleapis.com'
  const apiUrl = `${baseUrl}/upload/v1beta/files?key=${apiKey}`

  const formData = new FormData()
  formData.append('file', file)

  const metadataHeaders = {
    file: JSON.stringify({
      mimeType: file.type,
    }),
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'multipart',
        ...metadataHeaders,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Gemini File Upload Error]', error)
      throw new Error(`Gemini file upload error (${response.status}): ${error}`)
    }

    const data = await response.json()
    console.log('[Gemini File Upload Response]', data)

    return {
      uri: data.file?.uri || data.uri,
      mimeType: data.file?.mimeType || data.mimeType || file.type,
      name: data.file?.name || data.name,
    }
  }
  catch (error) {
    console.error('[Gemini File Upload Error]', error)
    throw error
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1])
      }
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

export const imageStore = useIDBKeyval<Record<string, string>>('favorite-images', {}, { shallow: true })

// 统一收藏结果存储，各处共用同一个 Ref 实例以保证跨组件响应式
export const favoriteResults = useIDBKeyval<FavoriteResult[] | undefined>('favorite-results', undefined, { shallow: true })

export async function saveImage(base64: string, mimeType: string): Promise<string> {
  const hash = await computeImageHash(base64)
  if (!imageStore.data.value[hash]) {
    imageStore.data.value = { ...imageStore.data.value, [hash]: base64 }
  }
  // store mimeType alongside — key: hash, mimeType key: hash+':mime'
  if (!imageStore.data.value[`${hash}:mime`]) {
    imageStore.data.value = { ...imageStore.data.value, [`${hash}:mime`]: mimeType }
  }
  return hash
}

export function getImageByHash(hash: string): { base64: string, mimeType: string } {
  const base64 = imageStore.data.value[hash] ?? ''
  const mimeType = imageStore.data.value[`${hash}:mime`] ?? 'image/png'
  return { base64, mimeType }
}

export function deleteImageIfUnused(hash: string, usedHashes: Set<string>) {
  if (!usedHashes.has(hash)) {
    const next = { ...imageStore.data.value }
    delete next[hash]
    delete next[`${hash}:mime`]
    imageStore.data.value = next
  }
}

// 墓碑标记存储：追踪本地主动删除的收藏项时间戳，用于 WebDAV 同步防幽灵复活
export const deletedTimestampsStore = useIDBKeyval<number[]>('favorite-deleted-timestamps', [])

export function markAsDeleted(time: number) {
  const current = deletedTimestampsStore.data.value
  if (!current.includes(time)) {
    deletedTimestampsStore.data.value = [...current, time]
  }
}

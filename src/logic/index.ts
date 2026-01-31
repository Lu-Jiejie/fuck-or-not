import type { ContentListUnion } from '@google/genai'
import type { AIProvider, ModelOption } from '~/types'
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai'
import { useDark, useStorage, useToggle } from '@vueuse/core'
import { ref, watch } from 'vue'

export const isDark = useDark()
export const toggleDark = useToggle(isDark)

export const googleApiKey = useStorage('google-api-key', '')
export const geminiApiUrl = useStorage('gemini-api-url', '')
export const grokApiKey = useStorage('grok-api-key', '')
export const grokApiUrl = useStorage('grok-api-url', '')
export const chatgptApiKey = useStorage('chatgpt-api-key', '')
export const chatgptApiUrl = useStorage('chatgpt-api-url', '')

function normalizeGrokApiUrl(url: string): string {
  if (!url) {
    return 'https://api.x.ai/v1/chat/completions'
  }

  url = url.replace(/\/$/, '')

  if (!url.endsWith('/v1/chat/completions')) {
    url += '/v1/chat/completions'
  }

  return url
}

function normalizeChatGPTApiUrl(url: string): string {
  if (!url) {
    return 'https://api.openai.com/v1/chat/completions'
  }

  url = url.replace(/\/$/, '')

  if (!url.endsWith('/v1/chat/completions')) {
    url += '/v1/chat/completions'
  }

  return url
}

const geminiAI = ref<GoogleGenAI | null>(createGeminiClient())

function createGeminiClient() {
  if (!googleApiKey.value)
    return null

  const config: any = { apiKey: googleApiKey.value }

  if (geminiApiUrl.value) {
    config.baseUrl = geminiApiUrl.value
  }

  return new GoogleGenAI(config)
}

watch([googleApiKey, geminiApiUrl], () => {
  geminiAI.value = createGeminiClient()
})

export const defaultModelOptions: ModelOption[] = [
  { id: 'gemini-2.5-flash', provider: 'Gemini' },
  { id: 'gemini-2.5-flash-lite', provider: 'Gemini' },
  { id: 'gemini-3-flash', provider: 'Gemini' },
  { id: 'grok-4-1-fast-reasoning', provider: 'Grok' },
  { id: 'grok-4-fast-reasoning', provider: 'Grok' },
  { id: 'grok-4', provider: 'Grok' },
  { id: 'grok-2-image-1212', provider: 'Grok' },
  { id: 'gpt-4o', provider: 'ChatGPT' },
  { id: 'gpt-4o-mini', provider: 'ChatGPT' },
  { id: 'gpt-4-turbo', provider: 'ChatGPT' },
  { id: 'gpt-4', provider: 'ChatGPT' },
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

export const modelOptions = useStorage<ModelOption[]>('model-options', [])

function needsMigration(data: any[]): boolean {
  if (data.length === 0)
    return false

  const first = data[0]
  return typeof first === 'string'
    || (typeof first === 'object' && !first.provider)
}

function initializeModelOptions() {
  const current = modelOptions.value

  if (current.length === 0 || needsMigration(current)) {
    modelOptions.value = migrateModelOptions()
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

export async function generateContent(model: string, contents: ContentListUnion, systemInstruction: string, provider: AIProvider) {
  if (provider === 'Gemini') {
    return geminiAI.value!.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      },
    })
  }
  else if (provider === 'Grok') {
    const apiKey = grokApiKey.value
    if (!apiKey) {
      throw new Error('Grok API key not set')
    }

    const apiUrl = normalizeGrokApiUrl(grokApiUrl.value)
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
      throw new Error(`Grok API error: ${error}`)
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
  else if (provider === 'ChatGPT') {
    const apiKey = chatgptApiKey.value
    if (!apiKey) {
      throw new Error('ChatGPT API key not set')
    }

    const apiUrl = normalizeChatGPTApiUrl(chatgptApiUrl.value)
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
      throw new Error(`ChatGPT API error: ${error}`)
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

  throw new Error(`Unsupported provider: ${provider}`)
}

export function uploadFileToAPI(file: File) {
  return geminiAI.value!.files.upload({
    file,
    config: {
      mimeType: file.type,
    },
  })
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

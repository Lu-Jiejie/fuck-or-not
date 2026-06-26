export type APIProviderType = 'gemini' | 'openai'

export interface ProviderConfig {
  id: string
  name: string
  type: APIProviderType
  apiUrl: string
  apiKey: string
  models: string[]
}

export interface CustomPrompt {
  id: string
  name: string
  content: string
}

export interface FavoriteResult {
  model: string
  mode: string
  imageHash: string
  mimeType: string
  time: number
  result: string
  prompt?: string
  additionalPrompt?: string
  /** 网络图片链接：设置此项时表示图片来自 URL，不存入 imageStore */
  imageUrl?: string
}

// 旧版数据结构，用于迁移兼容
export interface LegacyFavoriteResult {
  model: string
  mode: 'concise' | 'detailed' | 'novel' | 'custom'
  image: string
  time: number
  result: string
}

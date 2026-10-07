export type APIProviderType = 'gemini' | 'openai'

export interface GenerationConfig {
  temperature?: number
  maxTokens?: number
  topP?: number
  topK?: number
}

export interface ProviderConfig {
  id: string
  name: string
  type: APIProviderType
  apiUrl: string
  apiKey: string
  models: string[]
  generationConfig?: GenerationConfig
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

/** 单个版本的更新记录 */
export interface ChangelogEntry {
  /** 版本号，与 package.json / git tag 保持一致 */
  version: string
  /** 发布日期 */
  date: string
  /** 要点式更新内容 */
  items: string[]
}

// 旧版数据结构，用于迁移兼容
export interface LegacyFavoriteResult {
  model: string
  mode: 'concise' | 'detailed' | 'novel' | 'custom'
  image: string
  time: number
  result: string
}

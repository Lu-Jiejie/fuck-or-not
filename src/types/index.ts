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

// 分析完成但尚未保存的条目；图片数据暂存在 _pendingBase64 / _sourceUrl，
// 保存成功后决定落到 imageStore 还是直接记 URL，随后即丢弃
export interface PendingFavoriteResult extends FavoriteResult {
  _pendingBase64?: string
  _sourceUrl?: string
}

// 会话历史条目：分析完成后写入，用于误刷新恢复与回看。
// 图片按原样保存（base64 或外链），因此条目可能较大，只存 IndexedDB 并限条数。
export interface HistoryEntry {
  id: string
  time: number
  result: string
  model: string
  mode: string
  mimeType: string
  prompt?: string
  additionalPrompt?: string
  imageHash: string
  /** 图片 base64；外链图片时为空 */
  imageBase64?: string
  /** 外链地址；文件图片时为空 */
  imageUrl?: string
  /** 是否已保存进收藏，用于提示「尚未保存」 */
  saved: boolean
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

export type AIProvider = 'Gemini' | 'Grok' | 'ChatGPT'

export interface ModelOption {
  id: string
  provider: AIProvider
}

export interface GeminiConfig {
  apiUrl?: string
  apiKey?: string
}

export interface GrokConfig {
  apiUrl?: string
  apiKey?: string
}

export interface ChatGPTConfig {
  apiUrl?: string
  apiKey?: string
}

export interface FavoriteResult {
  model: string
  mode: 'concise' | 'detailed' | 'novel' | 'custom'
  image: string
  time: number
  result: string
}

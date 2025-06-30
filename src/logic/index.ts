import type { ContentListUnion } from '@google/genai'
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai'
import { useDark, useToggle } from '@vueuse/core'

export const isDark = useDark()
export const toggleDark = useToggle(isDark)

export function generateContent(apiKey: string, model: string, contents: ContentListUnion, systemInstruction: string) {
  const ai = new GoogleGenAI({ apiKey })
  return ai.models.generateContent({
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

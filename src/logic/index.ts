import type { ContentListUnion } from '@google/genai'
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai'
import { useDark, useStorage, useToggle } from '@vueuse/core'
import { ref, watch } from 'vue'

export const isDark = useDark()
export const toggleDark = useToggle(isDark)
export const googleApiKey = useStorage('google-api-key', '')
const ai = ref<GoogleGenAI | null>(new GoogleGenAI({ apiKey: googleApiKey.value }))

watch(googleApiKey, (key) => {
  ai.value = key ? new GoogleGenAI({ apiKey: key }) : null
})

export function generateContent(model: string, contents: ContentListUnion, systemInstruction: string) {
  return ai.value!.models.generateContent({
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

export function uploadFileToAPI(file: File) {
  return ai.value!.files.upload({
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

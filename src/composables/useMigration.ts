import type { FavoriteResult, LegacyFavoriteResult } from '~/types'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { computeImageHash, imageStore } from '~/logic'

const favoriteResults = useIDBKeyval<(FavoriteResult | LegacyFavoriteResult)[] | undefined>('favorite-results', undefined)

function isLegacy(item: FavoriteResult | LegacyFavoriteResult): item is LegacyFavoriteResult {
  return 'image' in item
}

export async function migrateIfNeeded() {
  const items = favoriteResults.data.value
  if (!items || !items.length)
    return

  const hasLegacy = items.some(isLegacy)
  if (!hasLegacy)
    return

  const migrated: FavoriteResult[] = []
  const newImages: Record<string, string> = { ...imageStore.data.value }

  for (const item of items) {
    if (isLegacy(item)) {
      const base64 = item.image
      const hash = await computeImageHash(base64)
      newImages[hash] = base64
      newImages[`${hash}:mime`] = 'image/png'
      migrated.push({
        model: item.model,
        mode: item.mode,
        imageHash: hash,
        mimeType: 'image/png',
        time: item.time,
        result: item.result,
      })
    }
    else {
      migrated.push(item)
    }
  }

  imageStore.data.value = newImages
  favoriteResults.data.value = migrated
}

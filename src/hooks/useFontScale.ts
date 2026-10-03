'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  FONT_SCALE_STORAGE_KEY,
  FontScale,
  persistFontScale,
  readStoredFontScale,
} from '@/lib/accessibility/font-scale'

/** Escuta mudanças de escala (mesmo storage / outras abas / outros controles). */
export function useFontScale() {
  const [scale, setScaleState] = useState<FontScale>(1)

  useEffect(() => {
    setScaleState(readStoredFontScale())

    const onStorage = (e: StorageEvent) => {
      if (e.key === FONT_SCALE_STORAGE_KEY || e.key === null) {
        setScaleState(readStoredFontScale())
      }
    }
    const onCustom = () => setScaleState(readStoredFontScale())

    window.addEventListener('storage', onStorage)
    window.addEventListener('a11y-font-scale', onCustom)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('a11y-font-scale', onCustom)
    }
  }, [])

  const setScale = useCallback((next: FontScale) => {
    persistFontScale(next)
    setScaleState(next)
    window.dispatchEvent(new Event('a11y-font-scale'))
  }, [])

  return { scale, setScale }
}

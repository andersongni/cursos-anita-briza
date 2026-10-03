'use client'

import { useEffect } from 'react'
import { applyFontScale, readStoredFontScale } from '@/lib/accessibility/font-scale'

/** Aplica a escala de fonte salva em qualquer página (incluindo prova/simulado). */
export default function FontScaleProvider() {
  useEffect(() => {
    applyFontScale(readStoredFontScale())

    const sync = () => applyFontScale(readStoredFontScale())
    window.addEventListener('a11y-font-scale', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('a11y-font-scale', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return null
}

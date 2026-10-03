'use client'

import { useEffect } from 'react'
import { applyFontScale, readStoredFontScale } from '@/lib/accessibility/font-scale'

/** Aplica a escala de fonte salva em qualquer página (antes do paint útil). */
export default function FontScaleProvider() {
  useEffect(() => {
    applyFontScale(readStoredFontScale())
  }, [])

  return null
}

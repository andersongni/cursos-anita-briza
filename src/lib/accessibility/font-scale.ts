export const FONT_SCALE_STORAGE_KEY = 'a11y-font-scale'

/** Escalas disponíveis (multiplicador da fonte base do navegador) */
export const FONT_SCALES = [1, 1.125, 1.25, 1.5] as const
export type FontScale = (typeof FONT_SCALES)[number]

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  1: 'Normal',
  1.125: 'Média',
  1.25: 'Grande',
  1.5: 'Muito grande',
}

export function isFontScale(value: unknown): value is FontScale {
  return typeof value === 'number' && (FONT_SCALES as readonly number[]).includes(value)
}

export function readStoredFontScale(): FontScale {
  if (typeof window === 'undefined') return 1
  try {
    const raw = localStorage.getItem(FONT_SCALE_STORAGE_KEY)
    if (!raw) return 1
    const n = Number(raw)
    return isFontScale(n) ? n : 1
  } catch {
    return 1
  }
}

export function applyFontScale(scale: FontScale) {
  if (typeof document === 'undefined') return
  // Base 16px * escala → rem do site inteiro (inclui prova/simulado)
  document.documentElement.style.setProperty('--a11y-scale', String(scale))
  document.documentElement.style.fontSize = `${16 * scale}px`
  document.documentElement.dataset.fontScale = String(scale)
}

export function persistFontScale(scale: FontScale) {
  applyFontScale(scale)
  try {
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(scale))
  } catch {
    // ignore quota / private mode
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('a11y-font-scale'))
  }
}

export function nextFontScale(current: FontScale): FontScale {
  const idx = FONT_SCALES.indexOf(current)
  return FONT_SCALES[Math.min(idx + 1, FONT_SCALES.length - 1)]
}

export function prevFontScale(current: FontScale): FontScale {
  const idx = FONT_SCALES.indexOf(current)
  return FONT_SCALES[Math.max(idx - 1, 0)]
}

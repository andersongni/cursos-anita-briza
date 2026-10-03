'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  FONT_SCALE_LABELS,
  FONT_SCALES,
  FontScale,
  nextFontScale,
  persistFontScale,
  prevFontScale,
  readStoredFontScale,
} from '@/lib/accessibility/font-scale'

type FontSizeControlProps = {
  className?: string
  compact?: boolean
}

export default function FontSizeControl({ className, compact = false }: FontSizeControlProps) {
  const [scale, setScale] = useState<FontScale>(1)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const current = readStoredFontScale()
    setScale(current)
    persistFontScale(current)
    setReady(true)

    const sync = () => setScale(readStoredFontScale())
    window.addEventListener('a11y-font-scale', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('a11y-font-scale', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const set = (next: FontScale) => {
    setScale(next)
    persistFontScale(next)
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border-2 border-slate-300 bg-white',
        compact ? 'p-0.5' : 'gap-1 px-2 py-1',
        className
      )}
      role="group"
      aria-label="Tamanho da fonte"
      data-ready={ready ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={() => set(prevFontScale(scale))}
        disabled={scale === FONT_SCALES[0]}
        className="min-w-9 h-9 px-2 rounded-md text-sm font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Diminuir fonte"
        aria-label="Diminuir tamanho da fonte"
      >
        A−
      </button>
      {!compact && (
        <span className="px-1 text-xs font-medium text-slate-600 tabular-nums min-w-[5rem] text-center">
          {FONT_SCALE_LABELS[scale]}
        </span>
      )}
      <button
        type="button"
        onClick={() => set(nextFontScale(scale))}
        disabled={scale === FONT_SCALES[FONT_SCALES.length - 1]}
        className="min-w-9 h-9 px-2 rounded-md text-lg font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Aumentar fonte"
        aria-label="Aumentar tamanho da fonte"
      >
        A+
      </button>
    </div>
  )
}

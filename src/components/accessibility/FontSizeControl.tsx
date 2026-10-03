'use client'

import { useEffect, useState } from 'react'
import { ALargeSmall } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FONT_SCALE_LABELS,
  FontScale,
  nextFontScale,
  persistFontScale,
  prevFontScale,
  readStoredFontScale,
} from '@/lib/accessibility/font-scale'

type FontSizeControlProps = {
  className?: string
  /** Versão compacta (só A− / A+) */
  compact?: boolean
}

export default function FontSizeControl({ className, compact = false }: FontSizeControlProps) {
  const [scale, setScale] = useState<FontScale>(1)

  useEffect(() => {
    const stored = readStoredFontScale()
    setScale(stored)
    persistFontScale(stored)
  }, [])

  const set = (next: FontScale) => {
    setScale(next)
    persistFontScale(next)
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white',
        compact ? 'p-0.5' : 'px-1 py-0.5',
        className
      )}
      role="group"
      aria-label="Tamanho da fonte"
    >
      {!compact && (
        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 text-xs text-slate-500">
          <ALargeSmall className="w-3.5 h-3.5" aria-hidden />
          Texto
        </span>
      )}
      <button
        type="button"
        onClick={() => set(prevFontScale(scale))}
        disabled={scale === 1}
        className="min-w-8 h-8 px-1.5 rounded-md text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Diminuir fonte"
        aria-label="Diminuir tamanho da fonte"
      >
        A−
      </button>
      <span className="px-1 text-xs text-slate-500 tabular-nums min-w-[4.5rem] text-center hidden md:inline">
        {FONT_SCALE_LABELS[scale]}
      </span>
      <button
        type="button"
        onClick={() => set(nextFontScale(scale))}
        disabled={scale === 1.5}
        className="min-w-8 h-8 px-1.5 rounded-md text-base font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Aumentar fonte"
        aria-label="Aumentar tamanho da fonte"
      >
        A+
      </button>
    </div>
  )
}

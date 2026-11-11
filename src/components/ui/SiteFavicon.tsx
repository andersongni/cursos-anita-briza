'use client'

import { useEffect } from 'react'
import { setSiteFavicon } from '@/lib/platform/favicon'

/**
 * Garante o mesmo favicon em todas as páginas: o logo da plataforma
 * servido por /api/platform/icon (Admin → Configurações).
 */
export default function SiteFavicon() {
  useEffect(() => {
    let cancelled = false
    const apply = () => {
      if (!cancelled) setSiteFavicon('/api/platform/icon')
    }

    // Aplica já no mount (mesmo ícone do metadata) e revalida após branding.
    apply()
    void fetch('/api/platform/branding', { cache: 'no-store' })
      .then(() => apply())
      .catch(() => apply())

    return () => {
      cancelled = true
    }
  }, [])

  return null
}

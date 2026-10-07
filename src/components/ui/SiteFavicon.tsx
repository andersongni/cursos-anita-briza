'use client'

import { useEffect } from 'react'
import { DEFAULT_LOGO_URL } from '@/lib/platform/logo'
import { setSiteFavicon } from '@/lib/platform/favicon'

/** Mantém o favicon alinhado ao logo configurado em Admin → Configurações. */
export default function SiteFavicon() {
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/platform/branding', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setSiteFavicon(DEFAULT_LOGO_URL)
          return
        }
        const data = await res.json()
        const url =
          typeof data.logo_url === 'string' && data.logo_url
            ? data.logo_url
            : DEFAULT_LOGO_URL
        if (!cancelled) setSiteFavicon(url)
      } catch {
        if (!cancelled) setSiteFavicon(DEFAULT_LOGO_URL)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}

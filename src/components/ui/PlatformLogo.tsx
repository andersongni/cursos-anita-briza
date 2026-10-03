'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { DEFAULT_LOGO_URL } from '@/lib/platform/logo'
import { cn } from '@/lib/utils'

type PlatformLogoProps = {
  width?: number
  height?: number
  className?: string
  alt?: string
  priority?: boolean
}

export default function PlatformLogo({
  width = 40,
  height = 40,
  className,
  alt = 'Logo',
  priority,
}: PlatformLogoProps) {
  const [src, setSrc] = useState(DEFAULT_LOGO_URL)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/platform/branding', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && typeof data.logo_url === 'string' && data.logo_url) {
          setSrc(data.logo_url)
        }
      } catch {
        // mantém padrão
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={cn(className)}
      unoptimized
    />
  )
}

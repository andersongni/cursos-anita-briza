'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  username: string
  full_name: string
  role: string
  status: string
}

/**
 * Mantém o perfil e desloga se a sessão for invalidada (ex.: reset de senha).
 */
export function useSessionGuard(pollMs = 15000) {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      if (res.status === 401) {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
        router.replace('/login')
        return null
      }
      if (!res.ok) return null
      const data = await res.json()
      setProfile(data)
      return data as Profile
    } catch {
      return null
    }
  }, [router])

  useEffect(() => {
    void check()
    const id = window.setInterval(() => void check(), pollMs)
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void check()
    })
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [check, pollMs])

  return { profile, refresh: check }
}

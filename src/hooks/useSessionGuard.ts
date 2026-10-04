'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  username: string
  full_name: string
  role: string
  status: string
}

/** Intervalo mínimo entre touches de atividade no servidor (alinha com throttle do JWT). */
const ACTIVITY_TOUCH_MIN_MS = 5 * 60 * 1000

/**
 * Mantém o perfil e desloga se a sessão for invalidada (ex.: reset de senha)
 * ou expirar por 24h de inatividade.
 */
export function useSessionGuard(pollMs = 15000) {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const lastTouchRef = useRef(0)

  const forceLogout = useCallback(
    async (idle = false) => {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
      router.replace(idle ? '/login?idle=1' : '/login')
    },
    [router]
  )

  const check = useCallback(
    async (touch = false) => {
      try {
        const url = touch ? '/api/auth/me?touch=1' : '/api/auth/me'
        const res = await fetch(url, { cache: 'no-store' })
        if (res.status === 401) {
          let idle = false
          try {
            const body = await res.json()
            idle = body?.code === 'IDLE'
          } catch {
            // ignore
          }
          await forceLogout(idle)
          return null
        }
        if (!res.ok) return null
        const data = await res.json()
        setProfile(data)
        return data as Profile
      } catch {
        return null
      }
    },
    [forceLogout]
  )

  const touchActivity = useCallback(() => {
    const now = Date.now()
    if (now - lastTouchRef.current < ACTIVITY_TOUCH_MIN_MS) return
    lastTouchRef.current = now
    void check(true)
  }, [check])

  useEffect(() => {
    void check(false)
    const id = window.setInterval(() => void check(false), pollMs)

    const onFocus = () => void check(false)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check(false)
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'touchstart',
      'scroll',
    ]

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    for (const event of activityEvents) {
      window.addEventListener(event, touchActivity, { passive: true })
    }

    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const event of activityEvents) {
        window.removeEventListener(event, touchActivity)
      }
    }
  }, [check, pollMs, touchActivity])

  return { profile, refresh: () => check(false) }
}

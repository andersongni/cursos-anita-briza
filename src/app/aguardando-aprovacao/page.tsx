'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PlatformLogo from '@/components/ui/PlatformLogo'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

export default function AguardandoAprovacaoPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const redirectedRef = useRef(false)

  const goApproved = useCallback((role?: string) => {
    if (redirectedRef.current) return
    redirectedRef.current = true
    toast.success('Seu cadastro foi aprovado!')
    // Hard navigation garante uso do cookie JWT já sincronizado
    const dest = role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'
    window.location.assign(dest)
  }, [])

  const checkStatus = useCallback(async () => {
    if (redirectedRef.current) return
    setChecking(true)

    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          redirectedRef.current = true
          router.replace('/login')
        }
        return
      }

      const profile = await res.json()

      if (profile.status === 'APPROVED') {
        goApproved(profile.role)
        return
      }

      if (profile.status === 'BLOCKED') {
        redirectedRef.current = true
        router.replace('/login?blocked=true')
        return
      }

      setLastCheckedAt(new Date())
    } catch (error) {
      console.error(error)
    } finally {
      if (!redirectedRef.current) setChecking(false)
    }
  }, [goApproved, router])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    router.push('/login')
  }, [router])

  useEffect(() => {
    void checkStatus()
    const interval = setInterval(() => {
      void checkStatus()
    }, 3000)

    const onFocus = () => {
      void checkStatus()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [checkStatus])

  const lastCheckedLabel = lastCheckedAt
    ? lastCheckedAt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <PlatformLogo
          alt="Núcleo Assistencial Anita Briza"
          width={120}
          height={120}
          className="rounded-full shadow-md mb-6 object-cover"
          priority
        />
      </div>

      <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <div className="p-8 flex flex-col items-center text-center">
            <Clock className="w-16 h-16 text-accent mb-4 animate-pulse" />

            <h2 className="text-2xl font-bold text-secondary mb-2">
              Cadastro Realizado!
            </h2>

            <p className="text-gray-700 mb-6">
              Seu cadastro foi realizado com sucesso e está aguardando aprovação do
              administrador.
            </p>

            <div
              className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 mb-6"
              aria-live="polite"
              aria-busy={checking}
            >
              <div className="flex flex-col items-center gap-3">
                <Spinner size="md" className="text-amber-700" />
                <p className="text-sm font-medium text-amber-900">
                  {checking
                    ? 'Verificando aprovação…'
                    : 'Aguardando aprovação — esta página atualiza sozinha'}
                </p>
                <p className="text-xs text-amber-800/80">
                  {lastCheckedLabel
                    ? `Última verificação: ${lastCheckedLabel}`
                    : 'Consultando status do cadastro…'}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-8">
              Quando o administrador aprovar, você será redirecionado automaticamente
              para a área logada.
            </p>

            <Button variant="outline" className="w-full" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

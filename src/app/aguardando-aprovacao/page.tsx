'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PlatformLogo from '@/components/ui/PlatformLogo'
import toast from 'react-hot-toast'

export default function AguardandoAprovacaoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const redirectedRef = useRef(false)

  const checkStatus = useCallback(
    async (opts?: { manual?: boolean }) => {
      if (redirectedRef.current) return
      if (opts?.manual) setLoading(true)

      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            router.push('/login')
          }
          return
        }

        const profile = await res.json()

        if (profile.status === 'APPROVED') {
          redirectedRef.current = true
          toast.success('Seu cadastro foi aprovado!')
          if (profile.role === 'ADMIN') {
            router.replace('/admin/dashboard')
          } else {
            router.replace('/dashboard')
          }
          return
        }

        if (profile.status === 'BLOCKED') {
          redirectedRef.current = true
          router.replace('/login?blocked=true')
          return
        }

        if (opts?.manual) {
          toast('Cadastro ainda em análise. Aguarde a aprovação do administrador.')
        }
      } catch (error) {
        console.error(error)
        if (opts?.manual) toast.error('Erro ao verificar status.')
      } finally {
        if (opts?.manual) setLoading(false)
      }
    },
    [router]
  )

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
    }, 5000)

    const onFocus = () => {
      void checkStatus()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [checkStatus])

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

            <p className="text-gray-700 mb-4">
              Seu cadastro foi realizado com sucesso e está aguardando aprovação do administrador.
            </p>

            <p className="text-sm text-gray-500 mb-8">
              Assim que seu cadastro for aprovado, você será redirecionado automaticamente
              para a área logada. Esta página verifica a cada 5 segundos.
            </p>

            <div className="w-full space-y-3">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => checkStatus({ manual: true })}
                loading={loading}
              >
                Verificar status agora
              </Button>

              <Button variant="outline" className="w-full" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PlatformLogo from '@/components/ui/PlatformLogo'
import toast from 'react-hot-toast'

export default function AguardandoAprovacaoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const checkStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        router.push('/login')
        return
      }

      const profile = await res.json()

      if (profile.status === 'APPROVED') {
        toast.success('Seu cadastro foi aprovado!')
        if (profile.role === 'ADMIN') {
          router.push('/admin/dashboard')
        } else {
          router.push('/dashboard')
        }
      } else if (profile.status === 'BLOCKED') {
        router.push('/login?blocked=true')
      } else {
        toast('Cadastro ainda em análise. Aguarde a aprovação do administrador.')
      }
    } catch (error) {
      console.error(error)
      toast.error('Erro ao verificar status.')
    } finally {
      setLoading(false)
    }
  }, [router])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    router.push('/login')
  }, [router])

  useEffect(() => {
    const interval = setInterval(checkStatus, 30000)
    return () => clearInterval(interval)
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
              Assim que seu cadastro for aprovado, você poderá acessar a plataforma.
              Esta página verifica automaticamente a cada 30 segundos.
            </p>

            <div className="w-full space-y-3">
              <Button
                variant="primary"
                className="w-full"
                onClick={checkStatus}
                loading={loading}
              >
                Verificar status agora
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

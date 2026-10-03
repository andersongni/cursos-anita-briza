'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import PlatformLogo from '@/components/ui/PlatformLogo'
import toast from 'react-hot-toast'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const blocked = searchParams.get('blocked')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao fazer login')
      }

      toast.success('Login realizado com sucesso!')

      if (data.status === 'PENDING') {
        router.push('/aguardando-aprovacao')
      } else if (data.role === 'ADMIN') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="p-6">
        {blocked && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Sua conta foi bloqueada. Entre em contato com o administrador.
          </div>
        )}

        <form className="space-y-6" onSubmit={handleLogin}>
          <Input
            label="Usuário"
            type="text"
            required
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
          />

          <Input
            label="Senha"
            type="password"
            required
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={loading}
          >
            Entrar
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/cadastro" className="text-sm text-accent hover:text-secondary font-medium">
            Não possui conta? Cadastre-se
          </Link>
        </div>
      </div>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <PlatformLogo
          alt="Núcleo Assistencial Anita Briza"
          width={150}
          height={150}
          className="rounded-full shadow-lg mb-6 object-cover"
          priority
        />
        <h2 className="text-center text-3xl font-extrabold text-secondary">
          Plataforma de Avaliação
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Núcleo Assistencial Anita Briza
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Suspense required because LoginForm uses useSearchParams() */}
        <Suspense fallback={<div className="text-center text-gray-500">Carregando...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}

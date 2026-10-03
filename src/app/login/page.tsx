'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import PlatformLogo from '@/components/ui/PlatformLogo'
import RecaptchaWidget from '@/components/auth/RecaptchaWidget'
import toast from 'react-hot-toast'

type CaptchaProvider = 'recaptcha' | 'math'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [requiresCaptcha, setRequiresCaptcha] = useState(false)
  const [captchaProvider, setCaptchaProvider] = useState<CaptchaProvider>('math')
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('')
  const [recaptchaToken, setRecaptchaToken] = useState('')
  const [recaptchaResetKey, setRecaptchaResetKey] = useState(0)
  const [captchaQuestion, setCaptchaQuestion] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')

  const blocked = searchParams.get('blocked')

  const clearCaptchaUi = () => {
    setRequiresCaptcha(false)
    setCaptchaProvider('math')
    setRecaptchaSiteKey('')
    setRecaptchaToken('')
    setCaptchaQuestion('')
    setCaptchaToken('')
    setCaptchaAnswer('')
  }

  const applyCaptcha = (data: {
    requiresCaptcha?: boolean
    captchaProvider?: CaptchaProvider
    recaptchaSiteKey?: string
    captchaQuestion?: string
    captchaToken?: string
  }) => {
    if (!data.requiresCaptcha) return

    setRequiresCaptcha(true)
    const provider = data.captchaProvider === 'recaptcha' ? 'recaptcha' : 'math'
    setCaptchaProvider(provider)

    if (provider === 'recaptcha' && data.recaptchaSiteKey) {
      setRecaptchaSiteKey(data.recaptchaSiteKey)
      setRecaptchaToken('')
      setRecaptchaResetKey((k) => k + 1)
      return
    }

    if (data.captchaQuestion && data.captchaToken) {
      setCaptchaQuestion(data.captchaQuestion)
      setCaptchaToken(data.captchaToken)
      setCaptchaAnswer('')
    }
  }

  const refreshCaptchaState = async (user = username) => {
    const key = user.trim().toLowerCase()
    if (!key) return
    try {
      const res = await fetch(`/api/auth/captcha?username=${encodeURIComponent(key)}`, {
        cache: 'no-store',
      })
      const data = await res.json()
      if (data.requiresCaptcha) {
        applyCaptcha(data)
      } else {
        clearCaptchaUi()
      }
    } catch {
      // o próximo login trará o desafio se necessário
    }
  }

  useEffect(() => {
    const key = username.trim().toLowerCase()
    if (key.length < 2) return
    const t = setTimeout(() => {
      void refreshCaptchaState(key)
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao username
  }, [username])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (requiresCaptcha && captchaProvider === 'recaptcha' && !recaptchaToken) {
      toast.error('Marque “Não sou um robô” para continuar.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          ...(requiresCaptcha && captchaProvider === 'recaptcha'
            ? { recaptchaToken }
            : {}),
          ...(requiresCaptcha && captchaProvider === 'math'
            ? { captchaToken, captchaAnswer }
            : {}),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        applyCaptcha(data)
        throw new Error(data.error || 'Erro ao fazer login')
      }

      clearCaptchaUi()
      toast.success('Login realizado com sucesso!')

      if (data.must_change_password) {
        router.push('/alterar-senha')
      } else if (data.status === 'PENDING') {
        router.push('/aguardando-aprovacao')
      } else if (data.role === 'ADMIN') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao fazer login'
      toast.error(message)
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
            autoComplete="username"
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
          />

          <Input
            label="Senha"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          />

          {requiresCaptcha && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                Muitas tentativas incorretas. Confirme que você não é um robô.
              </p>

              {captchaProvider === 'recaptcha' && recaptchaSiteKey ? (
                <RecaptchaWidget
                  siteKey={recaptchaSiteKey}
                  onChange={setRecaptchaToken}
                  resetKey={recaptchaResetKey}
                />
              ) : (
                <Input
                  label={`Quanto é ${captchaQuestion}?`}
                  type="number"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  value={captchaAnswer}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCaptchaAnswer(e.target.value)
                  }
                />
              )}
            </div>
          )}

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
        <Suspense fallback={<div className="text-center text-gray-500">Carregando...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}

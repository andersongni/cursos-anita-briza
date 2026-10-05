'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import PlatformLogo from '@/components/ui/PlatformLogo'
import RecaptchaWidget from '@/components/auth/RecaptchaWidget'
import {
  formatPhoneMask,
  isValidBrazilianMobile,
  isValidEmail,
  isValidFullName,
  isValidUsername,
} from '@/lib/utils'
import toast from 'react-hot-toast'

type CaptchaProvider = 'recaptcha' | 'math'
type FieldName =
  | 'fullName'
  | 'username'
  | 'password'
  | 'confirmPassword'
  | 'email'
  | 'phone'

export default function CadastroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameOk, setUsernameOk] = useState(false)
  const usernameCheckSeq = useRef(0)
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    phone: '',
  })
  const [courses, setCourses] = useState<Array<{ id: string; name: string; description: string | null }>>([])
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [courseError, setCourseError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})

  const [captchaProvider, setCaptchaProvider] = useState<CaptchaProvider>('math')
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState('')
  const [recaptchaToken, setRecaptchaToken] = useState('')
  const [recaptchaResetKey, setRecaptchaResetKey] = useState(0)
  const [captchaQuestion, setCaptchaQuestion] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')

  const setFieldError = useCallback((field: FieldName, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }))
  }, [])

  const clearFieldError = useCallback((field: FieldName) => {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const applyCaptcha = useCallback(
    (data: {
      captchaProvider?: CaptchaProvider
      recaptchaSiteKey?: string
      captchaQuestion?: string
      captchaToken?: string
    }) => {
      const provider = data.captchaProvider === 'recaptcha' ? 'recaptcha' : 'math'
      setCaptchaProvider(provider)

      if (provider === 'recaptcha' && data.recaptchaSiteKey) {
        setRecaptchaSiteKey(data.recaptchaSiteKey)
        setRecaptchaToken('')
        setRecaptchaResetKey((k) => k + 1)
        setCaptchaQuestion('')
        setCaptchaToken('')
        setCaptchaAnswer('')
        return
      }

      if (data.captchaQuestion && data.captchaToken) {
        setCaptchaQuestion(data.captchaQuestion)
        setCaptchaToken(data.captchaToken)
        setCaptchaAnswer('')
        setRecaptchaSiteKey('')
        setRecaptchaToken('')
      }
    },
    []
  )

  const loadCaptcha = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/captcha?for=register', { cache: 'no-store' })
      const data = await res.json()
      if (data.requiresCaptcha) applyCaptcha(data)
    } catch {
      // o submit pedirá novo desafio se necessário
    }
  }, [applyCaptcha])

  useEffect(() => {
    void loadCaptcha()
  }, [loadCaptcha])

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const res = await fetch('/api/courses', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        setCourses(Array.isArray(data.courses) ? data.courses : [])
      } catch {
        // ignore
      }
    }
    void loadCourses()
  }, [])

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    )
    setCourseError(null)
  }

  const validateFullName = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        setFieldError('fullName', 'Nome é obrigatório')
        return false
      }
      if (!isValidFullName(trimmed)) {
        setFieldError('fullName', 'Informe nome e sobrenome (pelo menos duas palavras)')
        return false
      }
      clearFieldError('fullName')
      return true
    },
    [clearFieldError, setFieldError]
  )

  const checkUsernameAvailability = useCallback(
    async (value: string) => {
      const username = value.trim().toLowerCase()
      if (!username) {
        setUsernameOk(false)
        setFieldError('username', 'Usuário é obrigatório')
        return false
      }
      if (!isValidUsername(username)) {
        setUsernameOk(false)
        setFieldError('username', 'Use apenas letras minúsculas, números e pontos')
        return false
      }

      const seq = ++usernameCheckSeq.current
      setCheckingUsername(true)
      try {
        const res = await fetch(
          `/api/auth/check-username?username=${encodeURIComponent(username)}`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        if (seq !== usernameCheckSeq.current) return false

        if (!data.available) {
          setUsernameOk(false)
          setFieldError('username', data.error || 'Este nome de usuário já está em uso')
          return false
        }

        setUsernameOk(true)
        clearFieldError('username')
        return true
      } catch {
        if (seq !== usernameCheckSeq.current) return false
        setUsernameOk(false)
        setFieldError('username', 'Não foi possível verificar o usuário')
        return false
      } finally {
        if (seq === usernameCheckSeq.current) setCheckingUsername(false)
      }
    },
    [clearFieldError, setFieldError]
  )

  const validatePasswordField = useCallback(
    (password: string) => {
      if (!password) {
        setFieldError('password', 'Senha é obrigatória')
        return false
      }
      if (password.length < 6) {
        setFieldError('password', 'A senha deve ter no mínimo 6 caracteres')
        return false
      }
      clearFieldError('password')
      return true
    },
    [clearFieldError, setFieldError]
  )

  const validateConfirmPassword = useCallback(
    (password: string, confirmPassword: string) => {
      if (!confirmPassword) {
        setFieldError('confirmPassword', 'Confirme a senha')
        return false
      }
      if (confirmPassword !== password) {
        setFieldError('confirmPassword', 'As senhas não coincidem')
        return false
      }
      clearFieldError('confirmPassword')
      return true
    },
    [clearFieldError, setFieldError]
  )

  const validateEmail = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        clearFieldError('email')
        return true
      }
      if (!isValidEmail(trimmed)) {
        setFieldError('email', 'Informe um e-mail válido')
        return false
      }
      clearFieldError('email')
      return true
    },
    [clearFieldError, setFieldError]
  )

  const validatePhone = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        clearFieldError('phone')
        return true
      }
      if (!isValidBrazilianMobile(trimmed)) {
        setFieldError('phone', 'Informe um telefone válido')
        return false
      }
      clearFieldError('phone')
      return true
    },
    [clearFieldError, setFieldError]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    let nextValue = value
    if (name === 'username') {
      nextValue = value.toLowerCase().replace(/[^a-z0-9.]/g, '')
      setUsernameOk(false)
    } else if (name === 'phone') {
      nextValue = formatPhoneMask(value)
    }
    setFormData((prev) => ({ ...prev, [name]: nextValue }))
    if (errors[name as FieldName]) {
      clearFieldError(name as FieldName)
    }
  }

  const handleBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    switch (name) {
      case 'fullName':
        validateFullName(value)
        break
      case 'username':
        await checkUsernameAvailability(value)
        break
      case 'password':
        validatePasswordField(value)
        if (formData.confirmPassword) {
          validateConfirmPassword(value, formData.confirmPassword)
        }
        break
      case 'confirmPassword':
        validateConfirmPassword(formData.password, value)
        break
      case 'email':
        validateEmail(value)
        break
      case 'phone':
        validatePhone(value)
        break
      default:
        break
    }
  }

  const validateAll = async () => {
    const nameOk = validateFullName(formData.fullName)
    const userOk = await checkUsernameAvailability(formData.username)
    const passOk = validatePasswordField(formData.password)
    const confirmOk = validateConfirmPassword(formData.password, formData.confirmPassword)
    const emailOk = validateEmail(formData.email)
    const phoneOk = validatePhone(formData.phone)
    const coursesOk = selectedCourseIds.length > 0
    if (!coursesOk) {
      setCourseError('Selecione ao menos um curso para solicitar matrícula')
    }
    return nameOk && userOk && passOk && confirmOk && emailOk && phoneOk && coursesOk
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const ok = await validateAll()
    if (!ok) {
      toast.error('Corrija os campos destacados antes de continuar.')
      return
    }

    if (captchaProvider === 'recaptcha' && !recaptchaToken) {
      toast.error('Marque “Não sou um robô” para continuar.')
      return
    }
    if (captchaProvider === 'math' && !captchaAnswer.trim()) {
      toast.error('Responda o captcha para continuar.')
      return
    }

    setConfirmOpen(true)
  }

  const createAccount = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          full_name: formData.fullName,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          courseIds: selectedCourseIds,
          ...(captchaProvider === 'recaptcha' ? { recaptchaToken } : {}),
          ...(captchaProvider === 'math' ? { captchaToken, captchaAnswer } : {}),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setConfirmOpen(false)
        if (data.requiresCaptcha) applyCaptcha(data)
        else void loadCaptcha()
        throw new Error(data.error || 'Erro ao criar conta')
      }

      setConfirmOpen(false)
      toast.success('Conta criada com sucesso!')
      router.push('/aguardando-aprovacao')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <PlatformLogo
          alt="Núcleo Assistencial Anita Briza"
          width={100}
          height={100}
          className="rounded-full shadow-md mb-4 object-cover"
          priority
        />
        <h2 className="text-center text-3xl font-extrabold text-secondary">Criar Conta</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <div className="p-6">
            <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
              <Input
                label="Nome completo"
                name="fullName"
                type="text"
                required
                placeholder="Maria da Silva"
                autoComplete="name"
                value={formData.fullName}
                onChange={handleChange}
                onBlur={(e) => void handleBlur(e)}
                error={errors.fullName}
              />

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">
                  Curso(s) desejado(s) <span className="text-red-500">*</span>
                </legend>
                <p className="text-xs text-slate-500">
                  A matrícula fica pendente até o administrador aprovar (além da aprovação da conta).
                </p>
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  {courses.length === 0 ? (
                    <p className="text-sm text-slate-500">Carregando cursos…</p>
                  ) : (
                    courses.map((course) => (
                      <label
                        key={course.id}
                        className="flex items-start gap-3 cursor-pointer rounded-md px-1 py-1.5 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedCourseIds.includes(course.id)}
                          onChange={() => toggleCourse(course.id)}
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-800">
                            {course.name}
                          </span>
                          {course.description && (
                            <span className="block text-xs text-slate-500 mt-0.5">
                              {course.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {courseError && <p className="text-sm text-red-600">{courseError}</p>}
              </fieldset>

              <Input
                label="Nome de usuário"
                name="username"
                type="text"
                required
                placeholder="maria.silva"
                value={formData.username}
                onChange={handleChange}
                onBlur={(e) => void handleBlur(e)}
                error={errors.username}
                helperText={
                  checkingUsername
                    ? 'Verificando disponibilidade…'
                    : usernameOk && !errors.username
                      ? 'Usuário disponível'
                      : undefined
                }
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
              />

              <Input
                label="Senha"
                name="password"
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={handleChange}
                onBlur={(e) => void handleBlur(e)}
                error={errors.password}
                autoComplete="new-password"
              />

              <Input
                label="Confirmar senha"
                name="confirmPassword"
                type="password"
                required
                placeholder="Repita a senha"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={(e) => void handleBlur(e)}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />

              <Input
                label="E-mail"
                name="email"
                type="email"
                placeholder="maria.silva@email.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={(e) => void handleBlur(e)}
                error={errors.email}
                helperText="Opcional"
                autoComplete="email"
              />

              <Input
                label="Telefone"
                name="phone"
                type="tel"
                inputMode="numeric"
                placeholder="(11) 98765-4321"
                value={formData.phone}
                onChange={handleChange}
                onBlur={(e) => void handleBlur(e)}
                error={errors.phone}
                helperText="Opcional"
                autoComplete="tel"
              />

              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-700">Confirme que você não é um robô.</p>

                {captchaProvider === 'recaptcha' && recaptchaSiteKey ? (
                  <RecaptchaWidget
                    siteKey={recaptchaSiteKey}
                    onChange={setRecaptchaToken}
                    resetKey={recaptchaResetKey}
                  />
                ) : (
                  <Input
                    label={
                      captchaQuestion ? `Quanto é ${captchaQuestion}?` : 'Carregando captcha…'
                    }
                    type="number"
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    value={captchaAnswer}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCaptchaAnswer(e.target.value)
                    }
                    disabled={!captchaQuestion}
                  />
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-6"
                disabled={loading || checkingUsername}
              >
                Criar conta
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm text-accent hover:text-secondary font-medium">
                Já possui conta? Faça login
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (!loading) setConfirmOpen(false)
        }}
        title="Anote seu usuário e senha"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Antes de finalizar, guarde o <strong>nome de usuário</strong> e a{' '}
            <strong>senha</strong> em um lugar seguro. Você precisará deles para entrar novamente.
          </p>
          <p className="text-sm text-slate-700">
            Não há recuperação automática de senha. Se esquecer, fale com o administrador.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-2">
            <p>
              Seu usuário será:{' '}
              <strong className="font-mono">{formData.username}</strong>
            </p>
            <p>
              Sua senha:{' '}
              <strong className="font-mono tracking-widest" aria-label="Senha oculta">
                {'•'.repeat(Math.max(6, formData.password.length))}
              </strong>
            </p>
            <p className="text-xs text-amber-900/80">
              A senha não é exibida por segurança. Confirme se você a anotou antes de continuar.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" disabled={loading} onClick={() => setConfirmOpen(false)}>
              Voltar
            </Button>
            <Button loading={loading} onClick={() => void createAccount()}>
              Anotei, criar conta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

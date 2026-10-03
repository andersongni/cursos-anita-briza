'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import PlatformLogo from '@/components/ui/PlatformLogo'
import toast from 'react-hot-toast'

export default function CadastroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    phone: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (errors[e.target.name]) {
      setErrors(prev => ({ ...prev, [e.target.name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.fullName.trim()) newErrors.fullName = 'Nome é obrigatório'
    
    if (!formData.username.trim()) {
      newErrors.username = 'Usuário é obrigatório'
    } else if (!/^[a-zA-Z0-9._]+$/.test(formData.username)) {
      newErrors.username = 'Use apenas letras, números, pontos e sublinhados'
    }

    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória'
    } else if (formData.password.length < 6) {
      newErrors.password = 'A senha deve ter no mínimo 6 caracteres'
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
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
          phone: formData.phone || undefined
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar conta')
      }

      toast.success('Conta criada com sucesso!')
      router.push('/aguardando-aprovacao')
    } catch (error: any) {
      toast.error(error.message)
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
        <h2 className="text-center text-3xl font-extrabold text-secondary">
          Criar Conta
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <div className="p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Nome completo"
                name="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={handleChange}
                error={errors.fullName}
              />
              
              <Input
                label="Nome de usuário"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                error={errors.username}
                helperText="Use letras, números e pontos"
              />
              
              <Input
                label="Senha"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                helperText="Mínimo 6 caracteres"
              />
              
              <Input
                label="Confirmar senha"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
              />
              
              <Input
                label="E-mail"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                helperText="Opcional"
              />
              
              <Input
                label="Telefone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                helperText="Opcional"
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-6"
                loading={loading}
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
    </div>
  )
}

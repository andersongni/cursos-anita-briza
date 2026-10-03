'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import PlatformLogo from '@/components/ui/PlatformLogo'
import toast from 'react-hot-toast'

export default function AlterarSenhaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha')

      toast.success('Senha alterada com sucesso!')
      router.replace('/admin/dashboard')
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao alterar senha'
      toast.error(message)
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
        <h2 className="text-2xl font-bold text-secondary text-center">
          Troca de senha obrigatória
        </h2>
        <p className="mt-2 text-sm text-gray-600 text-center px-4">
          Por segurança, altere a senha padrão antes de acessar a plataforma.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <form className="p-6 space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Senha atual"
              type="password"
              autoComplete="current-password"
              required
              value={form.current_password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, current_password: e.target.value }))
              }
            />
            <Input
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              required
              helperText="Mínimo 6 caracteres"
              value={form.new_password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, new_password: e.target.value }))
              }
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              autoComplete="new-password"
              required
              value={form.confirm_password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, confirm_password: e.target.value }))
              }
            />
            <Button type="submit" variant="primary" className="w-full" loading={loading}>
              Salvar nova senha
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

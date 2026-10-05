'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import PlatformLogo from '@/components/ui/PlatformLogo'
import { DEFAULT_LOGO_URL } from '@/lib/platform/logo'
import toast from 'react-hot-toast'

export default function AdminConfiguracoesPage() {
  const [loading, setLoading] = useState(true)
  const [changingPassword, setChangingPassword] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO_URL)
  const [logoKey, setLogoKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar configurações')
      const data = await res.json()
      const logo = (data.settings ?? []).find(
        (s: { key: string }) => s.key === 'platform.logo_url'
      )
      if (typeof logo?.value === 'string' && logo.value) {
        setLogoUrl(String(logo.value))
      } else {
        setLogoUrl(DEFAULT_LOGO_URL)
      }
      setLogoKey((k) => k + 1)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleChangePassword = async () => {
    setChangingPassword(true)
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha')
      toast.success('Senha alterada com sucesso!')
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao alterar senha')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return
    setUploadingLogo(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/logo', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar logo')
      setLogoUrl(data.logo_url)
      setLogoKey((k) => k + 1)
      if (data.compressed) {
        const from = Math.round((data.original_bytes || 0) / 1024)
        const to = Math.round((data.final_bytes || 0) / 1024)
        toast.success(`Logo comprimido (${from} KB → ${to} KB) e atualizado.`)
      } else {
        toast.success('Logo atualizado.')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar logo')
    } finally {
      setUploadingLogo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleLogoReset = async () => {
    if (!window.confirm('Restaurar o logo padrão da plataforma?')) return
    setUploadingLogo(true)
    try {
      const res = await fetch('/api/admin/logo', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao restaurar logo')
      setLogoUrl(data.logo_url || DEFAULT_LOGO_URL)
      setLogoKey((k) => k + 1)
      toast.success('Logo padrão restaurado.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao restaurar logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-3xl font-bold text-secondary">Configurações do Sistema</h1>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center flex-wrap gap-2">
          <CardTitle>Logo da Plataforma</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              loading={uploadingLogo}
              onClick={() => fileInputRef.current?.click()}
            >
              Enviar novo logo
            </Button>
            <Button
              variant="ghost"
              loading={uploadingLogo}
              onClick={handleLogoReset}
              disabled={
                logoUrl === DEFAULT_LOGO_URL ||
                logoUrl.startsWith('/logo.png') ||
                logoUrl.startsWith('/logo.jpg')
              }
            >
              Restaurar padrão
            </Button>
          </div>
        </CardHeader>
        <div className="p-4 pt-0 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Image
            key={logoKey}
            src={logoUrl}
            alt="Logo atual"
            width={112}
            height={112}
            unoptimized
            className="w-28 h-28 rounded-full object-cover border border-slate-200 shadow-sm bg-white"
          />
          <div className="text-sm text-slate-600 space-y-2">
            <p>Este logo aparece no login, cadastro e menus da plataforma.</p>
            <p className="text-xs text-slate-500">
              Formatos: JPG, PNG, WEBP ou GIF · até 20 MB · acima de 2 MB a imagem é
              comprimida automaticamente · imagem quadrada fica melhor.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-slate-400 flex items-center gap-2">
              Prévia nos menus:
              <PlatformLogo key={`nav-${logoKey}`} width={32} height={32} className="rounded-full" />
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Alterar Senha do Administrador</CardTitle>
          <Button loading={changingPassword} onClick={handleChangePassword}>
            Atualizar Senha
          </Button>
        </CardHeader>
        <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Senha atual"
            type="password"
            autoComplete="current-password"
            value={passwordForm.current_password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPasswordForm((f) => ({ ...f, current_password: e.target.value }))
            }
          />
          <Input
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            helperText="Mínimo 6 caracteres"
            value={passwordForm.new_password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPasswordForm((f) => ({ ...f, new_password: e.target.value }))
            }
          />
          <Input
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            value={passwordForm.confirm_password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPasswordForm((f) => ({ ...f, confirm_password: e.target.value }))
            }
          />
        </div>
      </Card>
    </div>
  )
}

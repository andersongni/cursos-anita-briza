'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Card, { CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import PlatformLogo from '@/components/ui/PlatformLogo'
import { DEFAULT_LOGO_URL } from '@/lib/platform/logo'
import toast from 'react-hot-toast'

type SettingsMap = Record<string, string | number | boolean>
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function asString(v: unknown, fallback = ''): string {
  if (v == null) return fallback
  return String(v)
}

function toApiValue(raw: unknown) {
  if (typeof raw === 'string' && /^-?\d+(\.\d+)?$/.test(raw.trim())) {
    return Number(raw)
  }
  return raw
}

export default function AdminConfiguracoesPage() {
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [changingPassword, setChangingPassword] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO_URL)
  const [logoKey, setLogoKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [settings, setSettings] = useState<SettingsMap>({})
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const readyRef = useRef(false)
  const savedLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar configurações')
      const data = await res.json()
      const map: SettingsMap = {}
      for (const s of data.settings ?? []) {
        map[s.key] = s.value
      }
      setSettings(map)
      if (typeof map['platform.logo_url'] === 'string' && map['platform.logo_url']) {
        setLogoUrl(String(map['platform.logo_url']))
      } else {
        setLogoUrl(DEFAULT_LOGO_URL)
      }
      setLogoKey((k) => k + 1)
      readyRef.current = true
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timers = debounceTimers.current
    const savedTimer = savedLabelTimer
    return () => {
      Object.values(timers).forEach(clearTimeout)
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
  }, [load])

  const persistKey = useCallback(async (key: string, raw: unknown) => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: toApiValue(raw) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Erro ao salvar ${key}`)
      }
      setSaveStatus('saved')
      if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
      savedLabelTimer.current = setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (e: any) {
      setSaveStatus('error')
      toast.error(e.message || 'Erro ao salvar configuração')
    }
  }, [])

  const setField = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    if (!readyRef.current) return

    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(() => {
      void persistKey(key, value)
    }, 500)
  }

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
    } catch (e: any) {
      toast.error(e.message)
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
    } catch (e: any) {
      toast.error(e.message)
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
    } catch (e: any) {
      toast.error(e.message)
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

  const statusLabel =
    saveStatus === 'saving'
      ? 'Salvando…'
      : saveStatus === 'saved'
        ? 'Salvo automaticamente'
        : saveStatus === 'error'
          ? 'Erro ao salvar'
          : 'Alterações são salvas automaticamente'

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold text-secondary">Configurações do Sistema</h1>
        <p
          className={`text-sm ${
            saveStatus === 'error'
              ? 'text-red-600'
              : saveStatus === 'saving'
                ? 'text-amber-600'
                : saveStatus === 'saved'
                  ? 'text-green-600'
                  : 'text-slate-500'
          }`}
        >
          {statusLabel}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurações da Avaliação</CardTitle>
          <CardDescription>
            Valem para a prova oficial e para o simulado.
          </CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Quantidade de perguntas"
            type="number"
            value={asString(settings['assessment.prova.question_count'], '40')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setField('assessment.prova.question_count', e.target.value)
            }
          />
          <Input
            label="Tempo limite (minutos)"
            type="number"
            value={asString(settings['assessment.prova.time_limit_minutes'], '120')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setField('assessment.prova.time_limit_minutes', e.target.value)
            }
          />
          <Input
            label="Nota mínima para aprovação (%)"
            type="number"
            value={asString(settings['assessment.prova.passing_score'], '70')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setField('assessment.prova.passing_score', e.target.value)
            }
          />
        </div>
      </Card>

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

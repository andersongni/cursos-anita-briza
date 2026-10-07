'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import PlatformLogo from '@/components/ui/PlatformLogo'
import { DEFAULT_LOGO_URL, isDefaultLogoUrl, normalizeLogoUrl } from '@/lib/platform/logo'
import { setSiteFavicon } from '@/lib/platform/favicon'
import toast from 'react-hot-toast'

type GeminiStatus = {
  configured: boolean
  source: 'database' | 'env' | null
  maskedKey: string | null
  model: string
}

const DEFAULT_MODEL = 'gemini-2.5-flash'

export default function AdminConfiguracoesPage() {
  const [loading, setLoading] = useState(true)
  const [changingPassword, setChangingPassword] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [savingGemini, setSavingGemini] = useState(false)
  const [removingGemini, setRemovingGemini] = useState(false)
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO_URL)
  const [logoKey, setLogoKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatus | null>(null)
  const [geminiApiKey, setGeminiApiKey] = useState('')

  const load = useCallback(async () => {
    try {
      const [settingsRes, geminiRes] = await Promise.all([
        fetch('/api/admin/settings', { cache: 'no-store' }),
        fetch('/api/admin/gemini', { cache: 'no-store' }),
      ])
      if (!settingsRes.ok) throw new Error('Falha ao carregar configurações')
      const data = await settingsRes.json()
      const logo = (data.settings ?? []).find(
        (s: { key: string }) => s.key === 'platform.logo_url'
      )
      const nextLogo = normalizeLogoUrl(logo?.value)
      setLogoUrl(nextLogo)
      setSiteFavicon(nextLogo)
      setLogoKey((k) => k + 1)

      if (geminiRes.ok) {
        setGeminiStatus((await geminiRes.json()) as GeminiStatus)
      }
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
      setSiteFavicon(data.logo_url)
      setLogoKey((k) => k + 1)
      if (data.compressed) {
        const from = Math.round((data.original_bytes || 0) / 1024)
        const to = Math.round((data.final_bytes || 0) / 1024)
        toast.success(`Logo e ícone comprimidos (${from} KB → ${to} KB).`)
      } else {
        toast.success('Logo e ícone do site atualizados.')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar logo')
    } finally {
      setUploadingLogo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleLogoReset = async () => {
    if (!window.confirm('Restaurar o logo e o ícone padrão da plataforma?')) return
    setUploadingLogo(true)
    try {
      const res = await fetch('/api/admin/logo', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao restaurar logo')
      const restored = data.logo_url || DEFAULT_LOGO_URL
      setLogoUrl(restored)
      setSiteFavicon(restored)
      setLogoKey((k) => k + 1)
      toast.success('Logo e ícone padrão restaurados.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao restaurar logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleSaveGemini = async () => {
    if (!geminiApiKey.trim()) {
      toast.error('Informe a chave da API Gemini')
      return
    }
    setSavingGemini(true)
    try {
      const res = await fetch('/api/admin/gemini', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiApiKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar')
      setGeminiStatus({
        configured: data.configured,
        source: data.source,
        maskedKey: data.maskedKey,
        model: data.model,
      })
      setGeminiApiKey('')
      toast.success('Chave Gemini salva (criptografada no banco).')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar Gemini')
    } finally {
      setSavingGemini(false)
    }
  }

  const handleRemoveGemini = async () => {
    if (
      !window.confirm(
        'Remover a chave Gemini do banco? A correção por IA só continuará se houver chave no ambiente do servidor.'
      )
    ) {
      return
    }
    setRemovingGemini(true)
    try {
      const res = await fetch('/api/admin/gemini', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao remover')
      setGeminiStatus({
        configured: data.configured,
        source: data.source,
        maskedKey: data.maskedKey,
        model: data.model,
      })
      setGeminiApiKey('')
      toast.success('Chave removida do banco.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover chave')
    } finally {
      setRemovingGemini(false)
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
          <CardTitle>Logo e ícone do site</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              loading={uploadingLogo}
              onClick={() => fileInputRef.current?.click()}
            >
              Enviar nova imagem
            </Button>
            <Button
              variant="ghost"
              loading={uploadingLogo}
              onClick={handleLogoReset}
              disabled={isDefaultLogoUrl(logoUrl)}
            >
              Restaurar padrão
            </Button>
          </div>
        </CardHeader>
        <div className="p-4 pt-0 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Image
            key={logoKey}
            src={logoUrl}
            alt="Logo e ícone atuais"
            width={112}
            height={112}
            unoptimized
            className="w-28 h-28 rounded-full object-cover border border-slate-200 shadow-sm bg-white"
          />
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              Esta imagem é o logo nos menus/login e o ícone da aba do navegador
              (favicon).
            </p>
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
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="inline-flex items-center gap-2">
                Menu:
                <PlatformLogo
                  key={`nav-${logoKey}`}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              </span>
              <span className="inline-flex items-center gap-2">
                Ícone da aba:
                <Image
                  key={`favicon-${logoKey}`}
                  src={logoUrl}
                  alt="Prévia do favicon"
                  width={20}
                  height={20}
                  unoptimized
                  className="w-5 h-5 rounded-sm object-cover border border-slate-200 bg-white"
                />
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center flex-wrap gap-2">
          <CardTitle>Correção por IA (Google Gemini)</CardTitle>
          <div className="flex gap-2">
            <Button
              loading={savingGemini}
              onClick={handleSaveGemini}
              disabled={!geminiApiKey.trim()}
            >
              Salvar
            </Button>
            <Button
              variant="ghost"
              loading={removingGemini}
              onClick={handleRemoveGemini}
              disabled={geminiStatus?.source !== 'database'}
            >
              Remover chave
            </Button>
          </div>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          <p className="text-sm text-slate-600">
            Usada para corrigir questões discursivas (faixa gratuita do Google AI
            Studio). A chave é criptografada (AES-256-GCM) no banco e nunca é
            exibida por completo de novo.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {geminiStatus?.configured ? (
              <>
                Status:{' '}
                <span className="font-medium text-green-700">configurada</span>
                {geminiStatus.maskedKey ? ` (${geminiStatus.maskedKey})` : ''}
                {' · '}
                origem:{' '}
                {geminiStatus.source === 'database'
                  ? 'banco (criptografada)'
                  : 'variável de ambiente'}
              </>
            ) : (
              <>
                Status:{' '}
                <span className="font-medium text-amber-700">não configurada</span>
                {' — '}sem chave, a correção usa fallback local.
              </>
            )}
          </div>
          <Input
            label="Chave da API Gemini"
            type="password"
            autoComplete="off"
            placeholder={
              geminiStatus?.configured
                ? 'Cole uma nova chave para substituir'
                : 'AIza...'
            }
            value={geminiApiKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setGeminiApiKey(e.target.value)
            }
            helperText={`Obtenha em aistudio.google.com/apikey · modelo fixo: ${geminiStatus?.model || DEFAULT_MODEL}`}
          />
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

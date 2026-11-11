import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  CERTIFICATE_BACKGROUND_KEY,
  CERTIFICATE_LAYOUT_KEY,
  DEFAULT_CERTIFICATE_BACKGROUND,
  normalizeCertificateLayout,
  parseLayoutSettingValue,
} from '@/lib/certificate/layout'
import {
  CERT_BG_MAX_UPLOAD_BYTES,
  compressCertificateBackground,
} from '@/lib/platform/compress-certificate-bg'
import {
  clearUploadsByPrefix,
  persistUpload,
} from '@/lib/platform/persist-upload'

export const runtime = 'nodejs'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

async function upsertSetting(key: string, value: unknown, userId: string, description: string) {
  const stringified = JSON.stringify(value)
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: stringified, updated_by: userId, description },
    create: { key, value: stringified, updated_by: userId, description },
  })
}

async function patchLayoutBackground(userId: string, backgroundUrl: string) {
  const row = await prisma.systemSetting.findUnique({ where: { key: CERTIFICATE_LAYOUT_KEY } })
  const current = parseLayoutSettingValue(row?.value)
  const layout = normalizeCertificateLayout({
    ...(current ?? {}),
    backgroundUrl,
  })
  layout.backgroundUrl = backgroundUrl
  await upsertSetting(
    CERTIFICATE_LAYOUT_KEY,
    layout,
    userId,
    'Layout visual do certificado (posições e textos)'
  )
  await upsertSetting(
    CERTIFICATE_BACKGROUND_KEY,
    backgroundUrl,
    userId,
    'Imagem de fundo do certificado'
  )
  return layout
}

export async function POST(req: Request) {
  try {
    const { user } = await verifyAdmin()
    const form = await req.formData()
    const file = form.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Formato inválido. Use JPG, PNG, WEBP ou GIF.' },
        { status: 400 }
      )
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: 'Arquivo vazio.' }, { status: 400 })
    }
    if (file.size > CERT_BG_MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Envie uma imagem de até 25 MB.' },
        { status: 400 }
      )
    }

    const input = Buffer.from(await file.arrayBuffer())
    let result
    try {
      result = await compressCertificateBackground(input)
    } catch (e: unknown) {
      return NextResponse.json(
        {
          error:
            e instanceof Error ? e.message : 'Não foi possível processar a imagem de fundo.',
        },
        { status: 400 }
      )
    }

    await clearUploadsByPrefix('certificate-background')
    const filename = `certificate-background${result.ext}`
    const saved = await persistUpload({
      filename,
      buffer: result.buffer,
      mime: result.mime,
    })
    const layout = await patchLayoutBackground(user.id, saved.url)

    return NextResponse.json({
      success: true,
      backgroundUrl: saved.url,
      layout,
      original_bytes: result.originalBytes,
      final_bytes: result.finalBytes,
    })
  } catch (error: unknown) {
    console.error('Certificate background upload error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao enviar imagem de fundo' },
      { status: err.status || 500 }
    )
  }
}

export async function DELETE() {
  try {
    const { user } = await verifyAdmin()
    await clearUploadsByPrefix('certificate-background')
    const layout = await patchLayoutBackground(user.id, DEFAULT_CERTIFICATE_BACKGROUND)
    return NextResponse.json({
      success: true,
      backgroundUrl: DEFAULT_CERTIFICATE_BACKGROUND,
      layout,
    })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao restaurar fundo padrão' },
      { status: err.status || 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  DEFAULT_LOGO_URL,
  normalizeLogoUrl,
  PLATFORM_LOGO_SETTING_KEY,
} from '@/lib/platform/logo'
import {
  compressLogoImage,
  LOGO_MAX_UPLOAD_BYTES,
} from '@/lib/platform/compress-logo'
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


async function saveLogoSetting(userId: string, logoUrl: string) {
  const value = JSON.stringify(logoUrl)
  await prisma.systemSetting.upsert({
    where: { key: PLATFORM_LOGO_SETTING_KEY },
    update: {
      value,
      updated_by: userId,
      description: 'URL do logo e ícone do site',
    },
    create: {
      key: PLATFORM_LOGO_SETTING_KEY,
      value,
      updated_by: userId,
      description: 'URL do logo e ícone do site',
    },
  })
}

export async function GET() {
  try {
    await verifyAdmin()
    const row = await prisma.systemSetting.findUnique({
      where: { key: PLATFORM_LOGO_SETTING_KEY },
    })
    let raw: unknown = DEFAULT_LOGO_URL
    if (row) {
      try {
        raw = JSON.parse(row.value)
      } catch {
        raw = row.value
      }
    }
    return NextResponse.json({ logo_url: normalizeLogoUrl(raw) })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar logo' },
      { status: error.status || 500 }
    )
  }
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

    if (file.size > LOGO_MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Envie uma imagem de até 20 MB.' },
        { status: 400 }
      )
    }

    const input = Buffer.from(await file.arrayBuffer())
    let result
    try {
      result = await compressLogoImage(input)
    } catch (e: any) {
      return NextResponse.json(
        { error: e.message || 'Não foi possível processar a imagem.' },
        { status: 400 }
      )
    }

    await clearUploadsByPrefix('platform-logo')

    const filename = `platform-logo${result.ext}`
    const saved = await persistUpload({
      filename,
      buffer: result.buffer,
      mime: result.mime || 'image/png',
    })
    await saveLogoSetting(user.id, saved.url)

    return NextResponse.json({
      success: true,
      logo_url: saved.url,
      compressed: result.compressed || file.size > result.finalBytes,
      original_bytes: result.originalBytes,
      final_bytes: result.finalBytes,
    })
  } catch (error: any) {
    console.error('Logo upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar logo' },
      { status: error.status || 500 }
    )
  }
}

export async function DELETE() {
  try {
    const { user } = await verifyAdmin()
    await clearUploadsByPrefix('platform-logo')
    await saveLogoSetting(user.id, DEFAULT_LOGO_URL)
    return NextResponse.json({ success: true, logo_url: DEFAULT_LOGO_URL })
  } catch (error: any) {
    console.error('Logo reset error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao restaurar logo' },
      { status: error.status || 500 }
    )
  }
}


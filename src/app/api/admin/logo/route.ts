import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
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

export const runtime = 'nodejs'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

function uploadsDir() {
  return path.join(process.cwd(), 'public', 'uploads')
}

async function ensureUploadsDir() {
  await fs.mkdir(uploadsDir(), { recursive: true })
}

async function clearPreviousLogos() {
  try {
    const dir = uploadsDir()
    const files = await fs.readdir(dir)
    await Promise.all(
      files
        .filter((f) => f.startsWith('platform-logo.'))
        .map((f) => fs.unlink(path.join(dir, f)).catch(() => undefined))
    )
  } catch {
    // pasta ainda não existe
  }
}

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

    await ensureUploadsDir()
    await clearPreviousLogos()

    const filename = `platform-logo${result.ext}`
    const diskPath = path.join(uploadsDir(), filename)
    await fs.writeFile(diskPath, result.buffer)

    const logoUrl = `/uploads/${filename}?v=${Date.now()}`
    await saveLogoSetting(user.id, logoUrl)

    return NextResponse.json({
      success: true,
      logo_url: logoUrl,
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
    await clearPreviousLogos()
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

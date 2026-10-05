import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { verifyAdmin } from '@/lib/auth/verify'
import { compressLogoImage, LOGO_MAX_UPLOAD_BYTES } from '@/lib/platform/compress-logo'

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

export async function POST(req: Request) {
  try {
    await verifyAdmin()
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
    } catch (e: unknown) {
      return NextResponse.json(
        {
          error: e instanceof Error ? e.message : 'Não foi possível processar a imagem.',
        },
        { status: 400 }
      )
    }

    await ensureUploadsDir()
    const filename = `certificate-element-${Date.now()}${result.ext}`
    await fs.writeFile(path.join(uploadsDir(), filename), result.buffer)
    const imageUrl = `/uploads/${filename}?v=${Date.now()}`

    return NextResponse.json({
      success: true,
      imageUrl,
      original_bytes: result.originalBytes,
      final_bytes: result.finalBytes,
    })
  } catch (error: unknown) {
    console.error('Certificate element image upload error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao enviar imagem do elemento' },
      { status: err.status || 500 }
    )
  }
}

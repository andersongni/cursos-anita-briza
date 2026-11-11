import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  readUploadFromDb,
  sanitizeUploadFilename,
} from '@/lib/platform/persist-upload'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ filename: string }> }

function uploadsDir() {
  return path.join(process.cwd(), 'public', 'uploads')
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { filename: raw } = await params
    const filename = sanitizeUploadFilename(decodeURIComponent(raw))
    if (!filename) {
      return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 })
    }

    // Fonte canônica: banco (local e produção)
    const stored = await readUploadFromDb(filename)
    if (stored) {
      return new NextResponse(Buffer.from(stored.dataBase64, 'base64'), {
        status: 200,
        headers: {
          'Content-Type': stored.mime || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    // Fallback: uploads antigos ainda no disco
    try {
      const absolute = path.join(uploadsDir(), filename)
      const buffer = await fs.readFile(absolute)
      const ext = path.extname(filename).toLowerCase()
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
              ? 'image/gif'
              : 'image/jpeg'
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }
  } catch (error: unknown) {
    console.error('Upload serve error:', error)
    return NextResponse.json({ error: 'Erro ao servir arquivo' }, { status: 500 })
  }
}

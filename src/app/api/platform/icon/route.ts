import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/db'
import {
  DEFAULT_LOGO_URL,
  logoPathOnly,
  normalizeLogoUrl,
  PLATFORM_LOGO_SETTING_KEY,
} from '@/lib/platform/logo'

export const runtime = 'nodejs'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
}

async function resolveLogoPath(): Promise<string> {
  try {
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
    return logoPathOnly(normalizeLogoUrl(raw))
  } catch {
    return DEFAULT_LOGO_URL
  }
}

export async function GET() {
  const logoUrl = await resolveLogoPath()
  const relative = logoUrl.replace(/^\//, '')
  const diskPath = path.join(process.cwd(), 'public', relative)

  try {
    const buffer = await fs.readFile(diskPath)
    const ext = path.extname(diskPath).toLowerCase()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': MIME[ext] || 'image/png',
        'Cache-Control': 'public, max-age=300, must-revalidate',
      },
    })
  } catch {
    const fallback = path.join(process.cwd(), 'public', 'logo.png')
    try {
      const buffer = await fs.readFile(fallback)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60, must-revalidate',
        },
      })
    } catch {
      return new NextResponse('Icon not found', { status: 404 })
    }
  }
}

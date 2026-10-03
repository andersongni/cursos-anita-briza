import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { DEFAULT_LOGO_URL, normalizeLogoUrl, PLATFORM_LOGO_SETTING_KEY } from '@/lib/platform/logo'

export async function GET() {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: {
        key: { in: [PLATFORM_LOGO_SETTING_KEY, 'platform.name', 'platform.institution'] },
      },
    })

    const map: Record<string, unknown> = {}
    for (const row of rows) {
      try {
        map[row.key] = JSON.parse(row.value)
      } catch {
        map[row.key] = row.value
      }
    }

    return NextResponse.json({
      logo_url: normalizeLogoUrl(map[PLATFORM_LOGO_SETTING_KEY] ?? DEFAULT_LOGO_URL),
      name: typeof map['platform.name'] === 'string' ? map['platform.name'] : 'Plataforma de Avaliação',
      institution:
        typeof map['platform.institution'] === 'string'
          ? map['platform.institution']
          : 'Núcleo Assistencial Anita Briza',
    })
  } catch (error) {
    console.error('Branding error:', error)
    return NextResponse.json({
      logo_url: DEFAULT_LOGO_URL,
      name: 'Plataforma de Avaliação',
      institution: 'Núcleo Assistencial Anita Briza',
    })
  }
}

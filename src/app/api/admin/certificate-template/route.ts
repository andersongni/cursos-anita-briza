import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  CERTIFICATE_BACKGROUND_KEY,
  CERTIFICATE_LAYOUT_KEY,
  createDefaultCertificateLayout,
  normalizeCertificateLayout,
} from '@/lib/certificate/layout'
import { getCertificateLayout, getCertificateSettings } from '@/lib/certificate/settings'

export const runtime = 'nodejs'

const LEGACY_TEXT_KEYS: Record<string, string> = {
  title: 'certificate.title',
  subtitle: 'certificate.subtitle',
  intro: 'certificate.intro_text',
  middle: 'certificate.middle_text',
  description: 'certificate.course_description',
  date_line: 'certificate.date_line',
  date_label: 'certificate.date_label',
  code_label: 'certificate.code_label',
  signature_title: 'certificate.signature_title',
  signature_subtitle: 'certificate.signature_subtitle',
}

async function upsertSetting(key: string, value: unknown, userId: string, description?: string) {
  const stringified = JSON.stringify(value)
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: stringified, updated_by: userId, ...(description ? { description } : {}) },
    create: {
      key,
      value: stringified,
      updated_by: userId,
      description: description ?? key,
    },
  })
}

export async function GET() {
  try {
    await verifyAdmin()
    const [layout, settings] = await Promise.all([
      getCertificateLayout(),
      getCertificateSettings(),
    ])
    return NextResponse.json({
      layout,
      editableVariables: settings.editableVariables,
      meta: {
        courseName: settings.courseName,
        institutionName: settings.institutionName,
        courseHours: settings.courseHours,
        location: settings.location,
        logoUrl: settings.logoUrl,
      },
    })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar modelo do certificado' },
      { status: err.status || 500 }
    )
  }
}

export async function PUT(req: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await req.json()
    const layout = normalizeCertificateLayout(body.layout)

    await upsertSetting(
      CERTIFICATE_LAYOUT_KEY,
      layout,
      user.id,
      'Layout visual do certificado (posições e textos)'
    )
    await upsertSetting(
      CERTIFICATE_BACKGROUND_KEY,
      layout.backgroundUrl,
      user.id,
      'Imagem de fundo do certificado'
    )

    // Mantém chaves legadas em sync com os textos do layout
    for (const el of layout.elements) {
      if (el.type === 'image') continue
      const key = LEGACY_TEXT_KEYS[el.id]
      if (!key) continue
      await upsertSetting(key, el.text, user.id)
    }

    return NextResponse.json({ success: true, layout })
  } catch (error: unknown) {
    console.error('Save certificate template error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao salvar modelo do certificado' },
      { status: err.status || 500 }
    )
  }
}

export async function DELETE() {
  try {
    const { user } = await verifyAdmin()
    const layout = createDefaultCertificateLayout()
    await upsertSetting(CERTIFICATE_LAYOUT_KEY, layout, user.id)
    await upsertSetting(
      CERTIFICATE_BACKGROUND_KEY,
      layout.backgroundUrl,
      user.id,
      'Imagem de fundo do certificado'
    )
    return NextResponse.json({ success: true, layout })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao restaurar modelo padrão' },
      { status: err.status || 500 }
    )
  }
}

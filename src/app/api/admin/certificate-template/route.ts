import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  CERTIFICATE_BACKGROUND_KEY,
  CERTIFICATE_LAYOUT_KEY,
  createDefaultCertificateLayout,
  normalizeCertificateLayout,
} from '@/lib/certificate/layout'
import { getCertificateSettings } from '@/lib/certificate/settings'
import { resolveAdminCourseId } from '@/lib/courses'

export const runtime = 'nodejs'

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
    const courseId = await resolveAdminCourseId()
    const settings = await getCertificateSettings({ courseId })
    return NextResponse.json({
      layout: settings.layout,
      editableVariables: settings.editableVariables,
      meta: {
        courseName: settings.courseName,
        institutionName: settings.institutionName,
        courseHours: settings.courseHours,
        location: settings.location,
        logoUrl: settings.logoUrl,
        courseId,
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

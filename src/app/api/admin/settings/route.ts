import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { mirroredAssessmentSettingKey } from '@/lib/settings/assessment'

export async function GET() {
  try {
    await verifyAdmin()
    const settingsRaw = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' }
    })
    
    const settings = settingsRaw.map(s => {
      let parsedValue = s.value
      try {
        parsedValue = JSON.parse(s.value)
      } catch {
        // use raw if unparseable
      }
      return { ...s, value: parsedValue }
    })

    return NextResponse.json({ settings })
  } catch (error: unknown) {
    console.error('Error fetching settings:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: err.status || 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await req.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 })
    }

    const stringifiedValue = JSON.stringify(value)
    const mirrorKey = mirroredAssessmentSettingKey(key)

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: stringifiedValue, updated_by: user.id },
      create: { key, value: stringifiedValue, updated_by: user.id },
    })

    // Prova e simulado compartilham quantidade, tempo e nota mínima
    if (mirrorKey) {
      await prisma.systemSetting.upsert({
        where: { key: mirrorKey },
        update: { value: stringifiedValue, updated_by: user.id },
        create: { key: mirrorKey, value: stringifiedValue, updated_by: user.id },
      })
    }

    return NextResponse.json({ setting: { ...setting, value } })
  } catch (error: unknown) {
    console.error('Error updating setting:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: err.status || 500 })
  }
}

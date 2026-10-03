import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const settingsRaw = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' }
    })
    
    const settings = settingsRaw.map(s => {
      let parsedValue = s.value
      try {
        parsedValue = JSON.parse(s.value)
      } catch (e) {
        // use raw if unparseable
      }
      return { ...s, value: parsedValue }
    })

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
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

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: stringifiedValue, updated_by: user.id },
      create: { key, value: stringifiedValue, updated_by: user.id },
    })

    return NextResponse.json({ setting: { ...setting, value } })
  } catch (error: any) {
    console.error('Error updating setting:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}

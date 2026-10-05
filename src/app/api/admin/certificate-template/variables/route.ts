import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  getCertificateEditableVariables,
  saveCertificateEditableVariables,
} from '@/lib/certificate/settings'
import { normalizeEditableVariables } from '@/lib/certificate/variables'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await verifyAdmin()
    const variables = await getCertificateEditableVariables()
    return NextResponse.json({ variables })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar variáveis' },
      { status: err.status || 500 }
    )
  }
}

export async function PUT(req: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await req.json()
    const variables = normalizeEditableVariables(body.variables, [], { allowEmpty: true })
    const saved = await saveCertificateEditableVariables(user.id, variables)
    return NextResponse.json({ success: true, variables: saved })
  } catch (error: unknown) {
    console.error('Save certificate variables error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao salvar variáveis' },
      { status: err.status || 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  clearGeminiApiKey,
  getGeminiSettingsStatus,
  setGeminiApiKey,
} from '@/lib/gemini/settings'

export async function GET() {
  try {
    await verifyAdmin()
    const status = await getGeminiSettingsStatus()
    return NextResponse.json(status)
  } catch (error: unknown) {
    console.error('GET gemini settings error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar configuração Gemini' },
      { status: err.status || 500 }
    )
  }
}

export async function PUT(req: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await req.json()
    const apiKey =
      typeof body.apiKey === 'string'
        ? body.apiKey
        : typeof body.api_key === 'string'
          ? body.api_key
          : null

    if (apiKey == null || !apiKey.trim()) {
      return NextResponse.json(
        { error: 'Informe a chave da API Gemini' },
        { status: 400 }
      )
    }

    await setGeminiApiKey(apiKey, user.id)

    const status = await getGeminiSettingsStatus()
    return NextResponse.json({
      success: true,
      ...status,
    })
  } catch (error: unknown) {
    console.error('PUT gemini settings error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao salvar configuração Gemini' },
      { status: err.status || 500 }
    )
  }
}

export async function DELETE() {
  try {
    const { user } = await verifyAdmin()
    await clearGeminiApiKey(user.id)
    const status = await getGeminiSettingsStatus()
    return NextResponse.json({
      success: true,
      ...status,
    })
  } catch (error: unknown) {
    console.error('DELETE gemini settings error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao remover chave Gemini' },
      { status: err.status || 500 }
    )
  }
}

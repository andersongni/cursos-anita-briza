import { NextResponse } from 'next/server'

/** OpenAI foi substituído por Gemini — redireciona clientes antigos. */
export async function GET() {
  return NextResponse.json(
    {
      error:
        'OpenAI foi desativado. Use Admin → Configurações → Gemini (/api/admin/gemini).',
    },
    { status: 410 }
  )
}

export async function PUT() {
  return GET()
}

export async function DELETE() {
  return GET()
}

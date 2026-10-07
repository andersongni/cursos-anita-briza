import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { generateGeminiText } from '@/lib/gemini/client'

const SYSTEM_PROMPT = [
  'Você elabora rubricas de correção para questões discursivas de avaliações escolares/profissionalizantes.',
  'Receberá contexto do curso, tema, enunciado da pergunta e o rascunho atual de critérios do professor.',
  'Use esse contexto para alinhar a rubrica ao conteúdo do curso e do tema — sem inventar outro assunto.',
  'Reescreva e amplie esses critérios em português do Brasil, de forma clara para um corretor automático e para um professor humano.',
  '',
  'Inclua, quando fizer sentido:',
  '- Expectativa de resposta do aluno (o que uma boa resposta deve conter).',
  '- Critérios para notas intermediárias (ex.: 100%, ~75%, ~50%, ~25%, 0%), com exemplos de respostas típicas em cada faixa.',
  '- Lista bem extensa de exemplos válidos (equivalentes, sinônimos, variações comuns).',
  '- Exemplos inválidos ou confusões frequentes a não aceitar.',
  '- Orientações sobre typos leves, sinônimos e respostas parciais.',
  '- Como tratar respostas que misturam itens certos e errados.',
  '',
  'Regras:',
  '- Parta do texto já escrito pelo professor; preserve a intenção dele e só melhore/amplie.',
  '- Respeite o nome do curso, o tema e o enunciado como fronteira do conteúdo.',
  '- Não invente um tema diferente da pergunta.',
  '- Não mencione que você é uma IA.',
  '- Responda APENAS com o texto final dos critérios (texto puro, sem JSON, sem markdown de código).',
  '- Use seções com títulos curtos e listas, fáceis de ler.',
].join('\n')

function asOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function POST(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json()
    const questionText =
      asOptionalString(body.questionText) ||
      asOptionalString(body.question_text) ||
      ''
    const currentCriteria =
      asOptionalString(body.criteria) ||
      asOptionalString(body.expected_answer) ||
      ''
    const courseName =
      asOptionalString(body.courseName) || asOptionalString(body.course_name)
    const themeName =
      asOptionalString(body.themeName) ||
      asOptionalString(body.theme_name) ||
      asOptionalString(body.dimensionName) ||
      asOptionalString(body.dimension_name)
    const assessmentType =
      asOptionalString(body.assessmentType) ||
      asOptionalString(body.assessment_type) ||
      asOptionalString(body.tipo)

    if (!questionText) {
      return NextResponse.json(
        { error: 'Informe o enunciado da pergunta' },
        { status: 400 }
      )
    }
    if (!currentCriteria) {
      return NextResponse.json(
        { error: 'Escreva algum critério antes de incrementar com IA' },
        { status: 400 }
      )
    }

    const result = await generateGeminiText({
      systemPrompt: SYSTEM_PROMPT,
      userText: JSON.stringify(
        {
          curso: courseName,
          tema: themeName,
          tipoAvaliacao: assessmentType,
          enunciado: questionText,
          criteriosAtuais: currentCriteria,
        },
        null,
        2
      ),
      temperature: 0.4,
      maxOutputTokens: 8192,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 502 }
      )
    }

    return NextResponse.json({ criteria: result.text, model: result.model })
  } catch (error: unknown) {
    console.error('expand-criteria error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao elaborar critérios' },
      { status: err.status || 500 }
    )
  }
}

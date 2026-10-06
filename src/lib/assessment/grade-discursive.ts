export type DiscursiveGrade = {
  scorePercent: number
  feedback: string
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * Fallback mínimo quando a IA não está disponível.
 * Usa só os critérios cadastrados na pergunta (não há listas fixas de domínio).
 */
function gradeByCriteriaFallback(
  questionText: string,
  expectedAnswer: string,
  studentAnswer: string
): DiscursiveGrade {
  const student = studentAnswer.trim()
  if (!student) {
    return { scorePercent: 0, feedback: 'Resposta em branco.' }
  }

  if (!expectedAnswer.trim()) {
    return {
      scorePercent: 0,
      feedback:
        'Correção por IA indisponível e a pergunta não tem critérios cadastrados.',
    }
  }

  const normalize = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const studentNorm = normalize(student)
  const afterLabel = expectedAnswer.replace(/^[^:]*:\s*/i, '')
  const criteria = afterLabel
    .split(/[\n;,/|]+/)
    .map((s) => normalize(s))
    .filter((s) => s.length >= 3)
    .filter(
      (s) =>
        !/^(aceitar|quaisquer|exemplos?|como|dois|tres|um|tambem|incluindo)\b/.test(
          s
        )
    )

  const qNorm = normalize(questionText)
  let required = 2
  if (/\b(tres|3)\b/.test(qNorm)) required = 3
  else if (/\b(dois|2)\b/.test(qNorm)) required = 2
  else if (/\b(um|1)\b/.test(qNorm)) required = 1

  const cited = student
    .split(/\s*(?:,|;|\/|\||\s+e\s+)\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)

  const items = cited.length > 0 ? cited : [student]
  let valid = 0
  let invalid = 0
  for (const item of items) {
    const n = normalize(item)
    const ok = criteria.some(
      (c) => n.includes(c) || c.includes(n) || studentNorm.includes(c)
    )
    if (ok) valid++
    else invalid++
  }

  const total = valid + invalid
  const credit = Math.min(valid, required) / required
  const accuracy = total > 0 ? valid / total : 0
  const scorePercent = clampScore(credit * accuracy * 100)

  return {
    scorePercent,
    feedback:
      `Correção provisória (IA indisponível). ${valid} item(ns) alinhado(s) aos critérios, ` +
      `${invalid} fora dos critérios cadastrados.`,
  }
}

async function gradeWithOpenAI(
  questionText: string,
  expectedAnswer: string,
  studentAnswer: string
): Promise<DiscursiveGrade | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    console.warn(
      '[grade-discursive] OPENAI_API_KEY ausente — usando fallback local'
    )
    return null
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'Você é um corretor de avaliações de curso profissionalizante (ex.: Informática Básica).',
              'Avalie a resposta do aluno com bom senso pedagógico, não com lista rígida de palavras.',
              '',
              'Responda APENAS JSON válido:',
              '{"scorePercent": number, "feedback": string}',
              '',
              'Regras de nota:',
              '- scorePercent: inteiro de 0 a 100.',
              '- Interprete o significado da resposta (sinônimos, typos leves, exemplos equivalentes).',
              '- Use os critérios/exemplos do professor como orientação, não como lista exclusiva.',
              '- Se a pergunta pede N exemplos: identifique corretos e incorretos.',
              '- Fórmula sugerida quando houver itens mistos: (corretos/N) * (corretos/(corretos+incorretos)) * 100.',
              '- Não dê 100% se houver itens claramente errados misturados aos certos.',
              '- Em informática: hardware = parte física; software = programas, apps, sistemas e também sites/plataformas web.',
              '- Ex.: Windows no hardware está errado; mouse no software está errado; Railway/Vercel/Gmail são software (sites/plataformas).',
              '- Feedback curto em português: diga o que estava certo e o que estava errado.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({
              pergunta: questionText,
              criteriosDoProfessor: expectedAnswer || null,
              respostaDoAluno: studentAnswer,
            }),
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(
        '[grade-discursive] OpenAI HTTP',
        res.status,
        errText.slice(0, 300)
      )
      return null
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') return null

    const parsed = JSON.parse(content) as {
      scorePercent?: unknown
      feedback?: unknown
    }
    const score = Number(parsed.scorePercent)
    if (!Number.isFinite(score)) return null

    return {
      scorePercent: clampScore(score),
      feedback:
        typeof parsed.feedback === 'string' && parsed.feedback.trim()
          ? parsed.feedback.trim()
          : 'Corrigida por IA.',
    }
  } catch (err) {
    console.error('[grade-discursive] OpenAI error:', err)
    return null
  }
}

/**
 * Avalia resposta discursiva com IA (OpenAI).
 * Fallback local só se a chave/API falhar — sem listas fixas de domínio.
 */
export async function gradeDiscursiveAnswer(input: {
  questionText: string
  expectedAnswer: string
  studentAnswer: string
}): Promise<DiscursiveGrade> {
  const studentAnswer = (input.studentAnswer || '').trim()
  const expectedAnswer = (input.expectedAnswer || '').trim()
  const questionText = (input.questionText || '').trim()

  if (!studentAnswer) {
    return { scorePercent: 0, feedback: 'Resposta em branco.' }
  }

  const ai = await gradeWithOpenAI(questionText, expectedAnswer, studentAnswer)
  if (ai) return ai

  return gradeByCriteriaFallback(questionText, expectedAnswer, studentAnswer)
}

export type DiscursiveGrade = {
  scorePercent: number
  feedback: string
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

const SYSTEM_PROMPT = [
  'Você é um professor paciente. Avalie a resposta do aluno com bom senso pedagógico.',
  'Use apenas a pergunta, os critérios/exemplos do professor e a resposta do aluno.',
  'Não invente regras de domínio que não estejam nesses dados ou no conhecimento geral do tema da pergunta.',
  '',
  'Responda APENAS JSON válido com este formato:',
  '{"scorePercent": number, "feedback": string}',
  '',
  'Campo feedback = comentário didático ao aluno (português do Brasil):',
  '- 2 a 4 frases, tom acolhedor.',
  '- Explique o que estava certo e o que estava errado.',
  '- Se houver confusão conceitual, explique com base no tema da pergunta e nos critérios do professor.',
  '- NÃO use a palavra "feedback".',
  '- NÃO mencione IA, inteligência artificial, Gemini, OpenAI, sistema automático ou correção provisória.',
  '- NÃO fale de critérios cadastrados, banco de dados ou prompt.',
  '',
  'Regras de nota (scorePercent inteiro 0–100):',
  '- Interprete significado (sinônimos, typos leves, exemplos equivalentes).',
  '- Critérios/exemplos do professor orientam a correção, sem serem lista exclusiva se equivalentes claros existirem.',
  '- Se a pergunta pede N exemplos: classifique cada item citado como correto ou incorreto.',
  '- Fórmula: (quantidade_de_corretos / max(total_de_itens_citados, N)) * 100.',
  '- Exemplo numérico genérico: pediu 2, citou 3 e acertou 1 → ≈ 33%; pediu 2, citou 3 e acertou 2 → ≈ 67%.',
  '- Não dê 100% se houver itens claramente errados misturados aos certos.',
  '- Justifique a nota no comentário.',
].join('\n')

function normalize(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitStudentItems(student: string): string[] {
  const parts = student
    .split(/\s*(?:,|;|\/|\||\n|\s+e\s+)\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  return parts.length > 0 ? parts : [student.trim()]
}

function itemMatchesCriterion(itemNorm: string, criterionNorm: string): boolean {
  if (!itemNorm || !criterionNorm) return false
  if (itemNorm === criterionNorm) return true
  // Plural simples em português (jogo/jogos, site/sites)
  if (itemNorm === `${criterionNorm}s` || criterionNorm === `${itemNorm}s`) {
    return true
  }
  // Evita match frouxo em critérios muito curtos
  if (criterionNorm.length <= 3) {
    return itemNorm === criterionNorm
  }
  if (itemNorm.includes(criterionNorm) || criterionNorm.includes(itemNorm)) {
    return true
  }
  // Tokens: "microsoft word" vs "word"
  const itemTokens = new Set(itemNorm.split(' ').filter((t) => t.length >= 3))
  const critTokens = criterionNorm.split(' ').filter((t) => t.length >= 3)
  if (critTokens.length === 0) return false
  return critTokens.every((t) => itemTokens.has(t) || itemNorm.includes(t))
}

function requiredExamples(questionText: string): number {
  const qNorm = normalize(questionText)
  if (/\b(tres|3)\b/.test(qNorm)) return 3
  if (/\b(dois|2)\b/.test(qNorm)) return 2
  if (/\b(um|1)\b/.test(qNorm)) return 1
  return 2
}

function parseCriteria(expectedAnswer: string): string[] {
  const afterLabel = expectedAnswer.replace(/^[^:]*:\s*/i, '')
  return afterLabel
    .split(/[\n;,/|]+/)
    .map((s) => normalize(s))
    .filter((s) => s.length >= 3)
    .filter(
      (s) =>
        !/^(aceitar|quaisquer|exemplos?|como|dois|tres|um|tambem|incluindo)\b/.test(
          s
        )
    )
}

function isItemCorrect(itemNorm: string, criteria: string[]): boolean {
  return criteria.some((c) => itemMatchesCriterion(itemNorm, c))
}

/** Nota justa: corretos / max(citados, pedidos). Ex.: 1 certo em 3 → 33%. */
function scoreFromItems(valid: number, total: number, required: number): number {
  if (valid <= 0 || total <= 0) return 0
  const denom = Math.max(total, required)
  return clampScore((valid / denom) * 100)
}

function buildDidacticComment(input: {
  required: number
  correctItems: string[]
  wrongItems: string[]
  scorePercent: number
  criteriaSample: string[]
}): string {
  const { required, correctItems, wrongItems, scorePercent, criteriaSample } =
    input

  const parts: string[] = []

  if (correctItems.length > 0) {
    parts.push(`Você acertou: ${correctItems.join(', ')}.`)
  }

  if (wrongItems.length > 0) {
    parts.push(`Não se encaixam no pedido: ${wrongItems.join(', ')}.`)
  }

  if (scorePercent < 100 && criteriaSample.length > 0) {
    const sample = criteriaSample.slice(0, 4).join(', ')
    parts.push(`Exemplos aceitos para esta pergunta incluem: ${sample}.`)
  } else if (correctItems.length < required) {
    parts.push(
      `A pergunta pede ${required} exemplo(s) corretos. Revise o conteúdo e tente exemplos mais precisos.`
    )
  }

  if (scorePercent >= 100) {
    return parts[0] || 'Muito bem! Sua resposta atende ao que foi pedido.'
  }

  if (parts.length === 0) {
    return 'Sua resposta ainda não atende ao que foi pedido. Revise o conteúdo da aula e tente exemplos mais claros.'
  }

  return parts.join(' ')
}

/**
 * Fallback quando a API de correção não responde.
 * Compara item a item (sem vazar match do texto inteiro) e gera comentário didático.
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
        'Não foi possível corrigir esta resposta agora. Peça ao professor para conferir os critérios da pergunta.',
    }
  }

  const criteria = parseCriteria(expectedAnswer)
  const required = requiredExamples(questionText)
  const items = splitStudentItems(student)

  const correctItems: string[] = []
  const wrongItems: string[] = []

  for (const item of items) {
    const n = normalize(item)
    if (isItemCorrect(n, criteria)) correctItems.push(item)
    else wrongItems.push(item)
  }

  const valid = correctItems.length
  const total = valid + wrongItems.length
  const scorePercent = scoreFromItems(valid, total, required)

  return {
    scorePercent,
    feedback: buildDidacticComment({
      required,
      correctItems,
      wrongItems,
      scorePercent,
      criteriaSample: criteria,
    }),
  }
}

function extractJsonObject(text: string): {
  scorePercent?: unknown
  feedback?: unknown
  comentario?: unknown
} | null {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed) as {
      scorePercent?: unknown
      feedback?: unknown
      comentario?: unknown
    }
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as {
        scorePercent?: unknown
        feedback?: unknown
        comentario?: unknown
      }
    } catch {
      return null
    }
  }
}

function sanitizeStudentFacingComment(text: string): string {
  return text
    .replace(/\b(IA|inteligência artificial|Gemini|OpenAI)\b/gi, '')
    .replace(/corre[cç][aã]o provis[oó]ria[^.]*\.?/gi, '')
    .replace(/\bfeedback\b/gi, 'comentário')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function gradeWithGemini(
  questionText: string,
  expectedAnswer: string,
  studentAnswer: string
): Promise<DiscursiveGrade | null> {
  const { getGeminiApiKey, getGeminiModel } = await import(
    '@/lib/gemini/settings'
  )
  const apiKey = await getGeminiApiKey()
  if (!apiKey) {
    console.warn(
      '[grade-discursive] Chave Gemini ausente (banco/env) — usando fallback local'
    )
    return null
  }

  const model = await getGeminiModel()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: JSON.stringify({
                  pergunta: questionText,
                  criteriosDoProfessor: expectedAnswer || null,
                  respostaDoAluno: studentAnswer,
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(
        '[grade-discursive] Gemini HTTP',
        res.status,
        errText.slice(0, 400)
      )
      return null
    }

    const data = await res.json()
    const content = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text || '')
      .join('')
    if (typeof content !== 'string' || !content.trim()) return null

    const parsed = extractJsonObject(content)
    if (!parsed) return null

    const score = Number(parsed.scorePercent)
    if (!Number.isFinite(score)) return null

    const rawComment =
      (typeof parsed.feedback === 'string' && parsed.feedback.trim()) ||
      (typeof parsed.comentario === 'string' && parsed.comentario.trim()) ||
      ''

    return {
      scorePercent: clampScore(score),
      feedback: sanitizeStudentFacingComment(rawComment) ||
        'Revise o conteúdo da aula e compare sua resposta com os exemplos corretos do tema.',
    }
  } catch (err) {
    console.error('[grade-discursive] Gemini error:', err)
    return null
  }
}

/**
 * Avalia resposta discursiva (Gemini). Fallback local se a API falhar.
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

  const ai = await gradeWithGemini(questionText, expectedAnswer, studentAnswer)
  if (ai) return ai

  return gradeByCriteriaFallback(questionText, expectedAnswer, studentAnswer)
}

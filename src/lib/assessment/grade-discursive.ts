export type DiscursiveGrade = {
  scorePercent: number
  feedback: string
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

const SYSTEM_PROMPT = [
  'Professor. Avalie respostas discursivas.',
  'Responda APENAS JSON: {"grades":[{"id":string,"scorePercent":number,"feedback":string}]}',
  'feedback: 1–2 frases em PT-BR, sem mencionar IA/Gemini/sistema.',
  'Nota 0–100. Aceite sinônimos/equivalentes. Se pedir N exemplos: (corretos/max(citados,N))*100.',
].join('\n')

/** Critérios suficientes para correção local (fallback / modo opcional). */
function hasLocalCriteria(expectedAnswer: string): boolean {
  return parseCriteria(expectedAnswer).length >= 2
}

/**
 * Opt-in: pular IA e usar só critérios locais (mais rápido, menos flexível).
 * Padrão: sempre IA em lote (1 chamada).
 */
function preferLocalGrading(): boolean {
  return process.env.DISCURSIVE_LOCAL_FIRST === '1'
}

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

function sanitizeStudentFacingComment(text: string): string {
  return text
    .replace(/\b(IA|inteligência artificial|Gemini|OpenAI)\b/gi, '')
    .replace(/corre[cç][aã]o provis[oó]ria[^.]*\.?/gi, '')
    .replace(/\bfeedback\b/gi, 'comentário')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function parseGradeFromObject(parsed: {
  scorePercent?: unknown
  feedback?: unknown
  comentario?: unknown
} | null): DiscursiveGrade | null {
  if (!parsed) return null
  const score = Number(parsed.scorePercent)
  if (!Number.isFinite(score)) return null
  const rawComment =
    (typeof parsed.feedback === 'string' && parsed.feedback.trim()) ||
    (typeof parsed.comentario === 'string' && parsed.comentario.trim()) ||
    ''
  return {
    scorePercent: clampScore(score),
    feedback:
      sanitizeStudentFacingComment(rawComment) ||
      'Revise o conteúdo da aula e compare sua resposta com os exemplos corretos do tema.',
  }
}

function extractGradesArray(text: string): Array<{
  id?: unknown
  scorePercent?: unknown
  feedback?: unknown
  comentario?: unknown
}> | null {
  const trimmed = text.trim()
  try {
    const parsed = JSON.parse(trimmed) as {
      grades?: unknown
      scorePercent?: unknown
    }
    if (Array.isArray(parsed.grades)) {
      return parsed.grades as Array<{
        id?: unknown
        scorePercent?: unknown
        feedback?: unknown
        comentario?: unknown
      }>
    }
    // Resposta no formato antigo (1 item)
    if (parsed.scorePercent != null) return [parsed]
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[0]) as { grades?: unknown }
      if (Array.isArray(parsed.grades)) {
        return parsed.grades as Array<{
          id?: unknown
          scorePercent?: unknown
          feedback?: unknown
          comentario?: unknown
        }>
      }
    } catch {
      return null
    }
  }
  return null
}

/**
 * Uma única chamada Gemini para várias discursivas (muito mais rápido que N idas).
 */
async function gradeBatchWithGemini(
  items: Array<{
    id: string
    questionText: string
    expectedAnswer: string
    studentAnswer: string
  }>
): Promise<Map<string, DiscursiveGrade>> {
  const out = new Map<string, DiscursiveGrade>()
  if (items.length === 0) return out

  const { generateGeminiText, gradingModelsToTry } = await import(
    '@/lib/gemini/client'
  )

  const result = await generateGeminiText({
    systemPrompt: SYSTEM_PROMPT,
    userText: JSON.stringify({
      items: items.map((it) => ({
        id: it.id,
        pergunta: it.questionText.slice(0, 400),
        criterios: (it.expectedAnswer || '').slice(0, 600) || null,
        resposta: it.studentAnswer.slice(0, 800),
      })),
    }),
    temperature: 0,
    // 1–2 frases por item
    maxOutputTokens: Math.min(160 * items.length, 512),
    responseMimeType: 'application/json',
    models: gradingModelsToTry(),
    maxModelAttempts: 1,
    timeoutMs: 8_000,
  })

  if (!result.ok) {
    console.warn('[grade-discursive] batch:', result.error)
    return out
  }

  const grades = extractGradesArray(result.text)
  if (!grades) return out

  for (const row of grades) {
    const id = typeof row.id === 'string' ? row.id : null
    const grade = parseGradeFromObject(row)
    if (!id || !grade) continue
    out.set(id, grade)
  }

  // Fallback: se veio 1 grade sem id e só há 1 item
  if (out.size === 0 && grades.length === 1 && items.length === 1) {
    const grade = parseGradeFromObject(grades[0])
    if (grade) out.set(items[0].id, grade)
  }

  return out
}

export type DiscursiveGradeInput = {
  id: string
  questionText: string
  expectedAnswer: string
  studentAnswer: string
}

/**
 * Corrige várias discursivas sempre com IA (1 chamada em lote), de forma rápida:
 * 1) resposta em branco → 0
 * 2) opcional DISCURSIVE_LOCAL_FIRST=1 → só critérios locais
 * 3) 1 chamada Gemini para todas; se falhar/timeout → local
 */
export async function gradeDiscursiveAnswers(
  inputs: DiscursiveGradeInput[]
): Promise<Map<string, DiscursiveGrade>> {
  const out = new Map<string, DiscursiveGrade>()
  const needAi: DiscursiveGradeInput[] = []
  const localFirst = preferLocalGrading()

  for (const input of inputs) {
    const studentAnswer = (input.studentAnswer || '').trim()
    const expectedAnswer = (input.expectedAnswer || '').trim()
    const questionText = (input.questionText || '').trim()

    if (!studentAnswer) {
      out.set(input.id, { scorePercent: 0, feedback: 'Resposta em branco.' })
      continue
    }

    if (localFirst && hasLocalCriteria(expectedAnswer)) {
      out.set(
        input.id,
        gradeByCriteriaFallback(questionText, expectedAnswer, studentAnswer)
      )
      continue
    }

    needAi.push({
      id: input.id,
      questionText,
      expectedAnswer,
      studentAnswer,
    })
  }

  if (needAi.length > 0) {
    const aiGrades = await gradeBatchWithGemini(needAi)
    for (const item of needAi) {
      const ai = aiGrades.get(item.id)
      out.set(
        item.id,
        ai ??
          gradeByCriteriaFallback(
            item.questionText,
            item.expectedAnswer,
            item.studentAnswer
          )
      )
    }
  }

  return out
}

/**
 * Avalia uma discursiva (via lote de 1). Sempre IA, com fallback local.
 */
export async function gradeDiscursiveAnswer(input: {
  questionText: string
  expectedAnswer: string
  studentAnswer: string
}): Promise<DiscursiveGrade> {
  const map = await gradeDiscursiveAnswers([
    {
      id: 'single',
      questionText: input.questionText,
      expectedAnswer: input.expectedAnswer,
      studentAnswer: input.studentAnswer,
    },
  ])
  return (
    map.get('single') ?? {
      scorePercent: 0,
      feedback: 'Não foi possível corrigir esta resposta.',
    }
  )
}

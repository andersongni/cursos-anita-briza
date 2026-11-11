import { prisma } from '@/lib/db'

const SETTING_KEY = 'assessment.grading.ms_per_discursive_samples'
const MAX_SAMPLES = 40
/** Heurística: 1 chamada em lote (~4–8s no total para 2 discursivas). */
export const DEFAULT_MS_PER_DISCURSIVE = 4_000

function parseSamples(raw: string | null | undefined): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 500 && n < 180_000)
      .slice(-MAX_SAMPLES)
  } catch {
    return []
  }
}

function average(samples: number[]): number | null {
  if (samples.length === 0) return null
  return samples.reduce((s, n) => s + n, 0) / samples.length
}

/** Registra duração média por questão discursiva após uma correção em lote. */
export async function recordDiscursiveGradingSample(
  totalMs: number,
  questionCount: number
): Promise<void> {
  if (questionCount <= 0 || !Number.isFinite(totalMs) || totalMs < 500) return
  const perQuestion = Math.round(totalMs / questionCount)
  if (perQuestion < 500) return

  const existing = await prisma.systemSetting.findUnique({
    where: { key: SETTING_KEY },
    select: { value: true },
  })
  const samples = [...parseSamples(existing?.value), perQuestion].slice(-MAX_SAMPLES)

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    create: {
      key: SETTING_KEY,
      value: JSON.stringify(samples),
      description:
        'Amostras recentes (ms por discursiva) para estimar tempo de correção automática',
    },
    update: { value: JSON.stringify(samples) },
  })
}

export async function getDiscursiveGradingAvgMs(): Promise<{
  avgMsPerQuestion: number
  sampleCount: number
}> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: SETTING_KEY },
    select: { value: true },
  })
  const samples = parseSamples(row?.value)
  const avg = average(samples)
  return {
    avgMsPerQuestion: Math.round(avg ?? DEFAULT_MS_PER_DISCURSIVE),
    sampleCount: samples.length,
  }
}

export async function estimateDiscursiveGrading(pendingCount: number): Promise<{
  pendingCount: number
  avgMsPerQuestion: number
  sampleCount: number
  estimatedTotalMs: number
  estimatedSeconds: number
}> {
  const pending = Math.max(0, pendingCount)
  const { avgMsPerQuestion, sampleCount } = await getDiscursiveGradingAvgMs()
  const estimatedTotalMs = pending * avgMsPerQuestion
  return {
    pendingCount: pending,
    avgMsPerQuestion,
    sampleCount,
    estimatedTotalMs,
    estimatedSeconds: Math.max(1, Math.ceil(estimatedTotalMs / 1000)),
  }
}

/** Texto amigável para ETA (ex.: "cerca de 30 segundos"). */
export function formatGradingEta(seconds: number): string {
  const s = Math.max(1, Math.round(seconds))
  if (s < 60) return `cerca de ${s} segundo${s === 1 ? '' : 's'}`
  const minutes = Math.max(1, Math.round(s / 60))
  if (minutes === 1) return 'cerca de 1 minuto'
  return `cerca de ${minutes} minutos`
}

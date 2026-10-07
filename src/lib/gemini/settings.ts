import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/crypto/secret'

export const GEMINI_API_KEY_SETTING = 'gemini.api_key_encrypted'

/** Modelo fixo (não configurável pela interface). */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

export type GeminiSettingsStatus = {
  configured: boolean
  source: 'database' | 'env' | null
  maskedKey: string | null
  model: string
}

async function readEncryptedKeyFromDb(): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: GEMINI_API_KEY_SETTING },
  })
  if (!row?.value?.trim()) return null
  try {
    const decrypted = decryptSecret(row.value.trim())
    return decrypted.trim() || null
  } catch (err) {
    console.error('[gemini/settings] Falha ao descriptografar chave:', err)
    return null
  }
}

/** Chave efetiva: banco (criptografado) tem prioridade; senão GEMINI_API_KEY do ambiente. */
export async function getGeminiApiKey(): Promise<string | null> {
  const fromDb = await readEncryptedKeyFromDb()
  if (fromDb) return fromDb
  const fromEnv =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
  return fromEnv || null
}

export async function getGeminiModel(): Promise<string> {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
}

export async function getGeminiSettingsStatus(): Promise<GeminiSettingsStatus> {
  const fromDb = await readEncryptedKeyFromDb()
  const fromEnv =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    null
  const model = await getGeminiModel()

  if (fromDb) {
    return {
      configured: true,
      source: 'database',
      maskedKey: maskSecret(fromDb),
      model,
    }
  }
  if (fromEnv) {
    return {
      configured: true,
      source: 'env',
      maskedKey: maskSecret(fromEnv),
      model,
    }
  }
  return {
    configured: false,
    source: null,
    maskedKey: null,
    model,
  }
}

export async function setGeminiApiKey(
  apiKey: string,
  userId: string
): Promise<void> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    throw Object.assign(new Error('Informe a chave da API Gemini'), {
      status: 400,
    })
  }
  if (trimmed.length < 20) {
    throw Object.assign(new Error('Chave da API parece inválida (muito curta)'), {
      status: 400,
    })
  }

  const encrypted = encryptSecret(trimmed)
  await prisma.systemSetting.upsert({
    where: { key: GEMINI_API_KEY_SETTING },
    update: {
      value: encrypted,
      updated_by: userId,
      description: 'Chave Gemini (AES-256-GCM)',
    },
    create: {
      key: GEMINI_API_KEY_SETTING,
      value: encrypted,
      updated_by: userId,
      description: 'Chave Gemini (AES-256-GCM)',
    },
  })
}

export async function clearGeminiApiKey(_userId: string): Promise<void> {
  await prisma.systemSetting.deleteMany({
    where: { key: GEMINI_API_KEY_SETTING },
  })
}

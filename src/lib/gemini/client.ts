import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_FREE_MODELS,
  getGeminiApiKey,
  getGeminiModel,
} from '@/lib/gemini/settings'

export type GeminiTextResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; status?: number }

function friendlyGeminiError(status: number, body: string): string {
  const lower = body.toLowerCase()
  if (status === 401 || status === 403 || /api key|permission|unauthenticated/i.test(body)) {
    return 'Chave Gemini inválida ou sem permissão. Confira em Admin → Configurações.'
  }
  if (status === 429 || /quota|rate limit|resource_exhausted/i.test(lower)) {
    return 'Cota gratuita do Gemini esgotada ou limite de uso. Tente mais tarde.'
  }
  if (
    status === 503 ||
    status === 500 ||
    /unavailable|overloaded|internal error|try again later/i.test(lower)
  ) {
    return 'O serviço Gemini está temporariamente indisponível. Aguarde alguns segundos e tente de novo.'
  }
  if (status === 404 || /not found|is not found/i.test(lower)) {
    return 'Modelo Gemini indisponível nesta conta. Tentando alternativa...'
  }
  if (/billing|payment/i.test(lower)) {
    return 'Conta Gemini com restrição de faturamento. Verifique o Google AI Studio.'
  }
  return `Falha na API Gemini (HTTP ${status}).`
}

function extractText(data: unknown): string | null {
  const candidates = (data as { candidates?: Array<{
    finishReason?: string
    content?: { parts?: Array<{ text?: string }> }
  }> })?.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null

  const parts = candidates[0]?.content?.parts
  const text = parts
    ?.map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim()
  if (text) return text

  const reason = candidates[0]?.finishReason
  if (reason && reason !== 'STOP') {
    return null
  }
  return null
}

/** Ordem: preferido (env/padrão) + os três free, sem duplicar. */
function modelsToTry(preferred: string): string[] {
  const free = [...GEMINI_FREE_MODELS]
  const list = [
    preferred,
    DEFAULT_GEMINI_MODEL,
    ...free,
  ].filter((m): m is string => Boolean(m && m.trim()))
  return [...new Set(list)]
}

function shouldTryNextModel(status: number): boolean {
  // Cota/modelo/indisponibilidade: outro modelo free pode ainda funcionar
  return (
    status === 404 ||
    status === 429 ||
    status === 500 ||
    status === 503
  )
}

/**
 * Gera texto com Gemini (com fallbacks de modelo e mensagens de erro úteis).
 */
export async function generateGeminiText(input: {
  systemPrompt: string
  userText: string
  temperature?: number
  maxOutputTokens?: number
  responseMimeType?: string
}): Promise<GeminiTextResult> {
  const apiKey = await getGeminiApiKey()
  if (!apiKey) {
    return {
      ok: false,
      error: 'Chave Gemini não configurada. Cadastre em Admin → Configurações.',
      status: 400,
    }
  }

  const preferred = await getGeminiModel()
  const models = modelsToTry(preferred)
  let lastError = 'Não foi possível falar com o Gemini.'
  let lastStatus = 502

  console.info('[gemini] tentando modelos:', models.join(' → '))

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.systemPrompt }] },
          contents: [
            {
              role: 'user',
              parts: [{ text: input.userText }],
            },
          ],
          generationConfig: {
            temperature: input.temperature ?? 0.4,
            maxOutputTokens: input.maxOutputTokens ?? 8192,
            ...(input.responseMimeType
              ? { responseMimeType: input.responseMimeType }
              : {}),
          },
        }),
      })

      const raw = await res.text()
      let data: unknown = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok) {
        lastError = friendlyGeminiError(res.status, raw)
        lastStatus = res.status === 429 ? 429 : 502
        console.error('[gemini]', model, res.status, raw.slice(0, 400))
        // Auth inválida: não adianta trocar de modelo
        if (res.status === 401 || res.status === 403) {
          return { ok: false, error: lastError, status: res.status }
        }
        if (shouldTryNextModel(res.status)) {
          console.warn(`[gemini] ${model} falhou (${res.status}); tentando próximo...`)
          continue
        }
        return { ok: false, error: lastError, status: lastStatus }
      }

      const text = extractText(data)
      if (!text) {
        const blockReason =
          (data as { promptFeedback?: { blockReason?: string } })?.promptFeedback
            ?.blockReason ||
          (data as { candidates?: Array<{ finishReason?: string }> })?.candidates?.[0]
            ?.finishReason
        lastError = blockReason
          ? `Resposta bloqueada pelo Gemini (${blockReason}). Ajuste o texto e tente de novo.`
          : 'A IA não retornou texto. Tente novamente.'
        console.error('[gemini] empty response', model, JSON.stringify(data).slice(0, 400))
        continue
      }

      if (model !== preferred) {
        console.info(`[gemini] usando fallback ${model} (preferido: ${preferred})`)
      }
      return { ok: true, text, model }
    } catch (err) {
      console.error('[gemini] network', model, err)
      lastError = 'Erro de rede ao chamar o Gemini. Verifique a conexão e tente novamente.'
      lastStatus = 502
    }
  }

  return { ok: false, error: lastError, status: lastStatus }
}

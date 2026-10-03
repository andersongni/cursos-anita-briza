/** Google reCAPTCHA v2 — o desafio de imagens é exibido pelo próprio Google. */

export function isRecaptchaConfigured(): boolean {
  return Boolean(
    process.env.RECAPTCHA_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim()
  )
}

export function getRecaptchaSiteKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim()
  return key || undefined
}

export async function verifyRecaptchaToken(token: unknown): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim()
  if (!secret) return false
  if (typeof token !== 'string' || !token.trim()) return false

  try {
    const body = new URLSearchParams({
      secret,
      response: token.trim(),
    })

    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    })

    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return Boolean(data.success)
  } catch {
    return false
  }
}

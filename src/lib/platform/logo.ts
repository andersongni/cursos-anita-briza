export const DEFAULT_LOGO_URL = '/logo.png'
export const PLATFORM_LOGO_SETTING_KEY = 'platform.logo_url'

export function normalizeLogoUrl(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_LOGO_URL
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_LOGO_URL
  // Aceita só caminhos locais relativos (evita URL externa arbitrária)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return DEFAULT_LOGO_URL
  return trimmed
}

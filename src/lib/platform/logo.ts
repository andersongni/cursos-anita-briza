export const DEFAULT_LOGO_URL = '/logo.png'
export const PLATFORM_LOGO_SETTING_KEY = 'platform.logo_url'

/** Remove query/hash para comparar com o padrão. */
export function logoPathOnly(url: string): string {
  const q = url.indexOf('?')
  const h = url.indexOf('#')
  let end = url.length
  if (q >= 0) end = Math.min(end, q)
  if (h >= 0) end = Math.min(end, h)
  return url.slice(0, end)
}

export function isDefaultLogoUrl(url: string): boolean {
  const path = logoPathOnly(url)
  return path === DEFAULT_LOGO_URL || path === '/logo.jpg'
}

export function normalizeLogoUrl(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_LOGO_URL
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_LOGO_URL
  // Aceita só caminhos locais relativos (evita URL externa arbitrária)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return DEFAULT_LOGO_URL
  // Seeds antigos apontavam para /logo.jpg — usa o PNG padrão atual
  if (logoPathOnly(trimmed) === '/logo.jpg') return DEFAULT_LOGO_URL
  return trimmed
}

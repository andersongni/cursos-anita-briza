import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOGO_URL,
  isDefaultLogoUrl,
  logoPathOnly,
  normalizeLogoUrl,
} from './logo'

describe('logo helpers', () => {
  it('remove query/hash', () => {
    expect(logoPathOnly('/logo.png?v=1#x')).toBe('/logo.png')
    expect(logoPathOnly('/logo.png#x')).toBe('/logo.png')
  })

  it('detecta logo padrão', () => {
    expect(isDefaultLogoUrl('/logo.png')).toBe(true)
    expect(isDefaultLogoUrl('/logo.jpg?v=2')).toBe(true)
    expect(isDefaultLogoUrl('/uploads/x.png')).toBe(false)
  })

  it('normaliza URL', () => {
    expect(normalizeLogoUrl(null)).toBe(DEFAULT_LOGO_URL)
    expect(normalizeLogoUrl('')).toBe(DEFAULT_LOGO_URL)
    expect(normalizeLogoUrl('https://evil.com/x')).toBe(DEFAULT_LOGO_URL)
    expect(normalizeLogoUrl('//evil.com')).toBe(DEFAULT_LOGO_URL)
    expect(normalizeLogoUrl('/logo.jpg')).toBe(DEFAULT_LOGO_URL)
    expect(normalizeLogoUrl('/uploads/a.png')).toBe('/uploads/a.png')
  })
})

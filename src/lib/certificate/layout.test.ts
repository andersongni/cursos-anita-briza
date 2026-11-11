import { describe, expect, it } from 'vitest'
import {
  CERT_PAGE_HEIGHT_MM,
  certPageHeightPt,
  createDefaultCertificateLayout,
  createImageElement,
  createTextElement,
  DEFAULT_CERTIFICATE_BACKGROUND,
  fontSizePtToPreviewPx,
  hexToRgb,
  isImageElement,
  isTextElement,
  normalizeCertificateLayout,
  normalizeLayoutElement,
  parseLayoutSettingValue,
  PLATFORM_LOGO_TOKEN,
  READONLY_CERTIFICATE_PLACEHOLDERS,
  resolveElementImageUrl,
} from './layout'

describe('certificate layout', () => {
  it('conversores e helpers', () => {
    expect(certPageHeightPt()).toBeCloseTo((CERT_PAGE_HEIGHT_MM / 25.4) * 72)
    expect(fontSizePtToPreviewPx(12, 0)).toBe(12)
    expect(fontSizePtToPreviewPx(12, certPageHeightPt())).toBeCloseTo(12)
    expect(hexToRgb('#0078a8')).toEqual([0, 120, 168])
    expect(hexToRgb('#abc')).toEqual([170, 187, 204])
    expect(READONLY_CERTIFICATE_PLACEHOLDERS.length).toBeGreaterThan(0)
  })

  it('cria elementos e resolve imagem', () => {
    const text = createTextElement({ label: 'T', text: 'Hi' })
    const image = createImageElement({ label: 'I' })
    expect(isTextElement(text)).toBe(true)
    expect(isImageElement(image)).toBe(true)
    expect(resolveElementImageUrl(text)).toBeNull()
    expect(resolveElementImageUrl(image, '/logo.png')).toBe('/logo.png')
    expect(
      resolveElementImageUrl({ ...image, imageUrl: '/x.png' }, '/logo.png')
    ).toBe('/x.png')
    expect(resolveElementImageUrl({ ...image, imageUrl: PLATFORM_LOGO_TOKEN }, null)).toBeNull()
  })

  it('normaliza layout e elementos', () => {
    const defaults = createDefaultCertificateLayout({ title: 'X' })
    expect(defaults.backgroundUrl).toBe(DEFAULT_CERTIFICATE_BACKGROUND)
    expect(defaults.elements.find((e) => e.id === 'title')?.text).toBe('X')

    const normalized = normalizeCertificateLayout({
      backgroundUrl: '/bg.jpg',
      showLogo: false,
      elements: [
        { id: 'title', text: 'Novo', align: 'left', color: '#fff', fontSize: 100, x: -1 },
        { id: 'custom', type: 'text', label: 'Extra', text: 'E' },
        { id: 'img1', type: 'image', label: 'Img' },
      ],
    })
    expect(normalized.backgroundUrl).toBe('/bg.jpg')
    expect(normalized.elements.find((e) => e.id === 'title')?.align).toBe('left')
    expect(normalized.elements.some((e) => e.id === 'custom')).toBe(true)
    expect(normalized.elements.some((e) => e.id === 'img1')).toBe(true)

    const migrated = normalizeCertificateLayout({ showLogo: true, elements: [] })
    expect(migrated.elements.find((e) => e.id === 'logo')?.visible).toBe(true)

    const migratedHidden = normalizeCertificateLayout({
      showLogo: false,
      elements: [],
    })
    expect(migratedHidden.elements.find((e) => e.id === 'logo')?.visible).toBe(false)

    expect(normalizeCertificateLayout(null).version).toBe(1)
    expect(normalizeCertificateLayout({ backgroundUrl: 'http://x' }).backgroundUrl).toBe(
      DEFAULT_CERTIFICATE_BACKGROUND
    )
    expect(
      normalizeCertificateLayout({
        backgroundUrl: '  ',
        elements: [{ id: 'custom2', type: 'image', label: '' }],
      }).elements.some((e) => e.id === 'custom2')
    ).toBe(true)
    expect(
      normalizeCertificateLayout({
        elements: [{ id: 'custom3', type: 'text', label: '', text: '' }],
      }).elements.some((e) => e.id === 'custom3')
    ).toBe(true)
    expect(
      normalizeCertificateLayout({
        elements: [
          {
            id: 'logo',
            type: 'image',
            visible: false,
            imageUrl: '/x.png',
            widthPct: 200,
            opacity: 2,
          },
        ],
      }).showLogo
    ).toBe(false)


    const el = normalizeLayoutElement(
      { type: 'text', color: 1 as unknown as string, align: 'weird' as never },
      createTextElement({ id: 't' })
    )
    expect(el.type).toBe('text')
    expect(el.color).toBe('#0078a8')

    expect(hexToRgb('vermelho')).toEqual([0, 120, 168])
    const flipped = normalizeLayoutElement(
      { type: 'text' },
      createImageElement({ id: 'img' })
    )
    expect(flipped.type).toBe('text')
    expect(
      normalizeLayoutElement({ type: 'image', color: 'red' }, createTextElement({ id: 't2' }))
        .type
    ).toBe('image')
  })


  it('parseLayoutSettingValue', () => {
    expect(parseLayoutSettingValue(null)).toBeNull()
    expect(parseLayoutSettingValue('')).toBeNull()
    expect(parseLayoutSettingValue('bad')).toBeNull()
    const parsed = parseLayoutSettingValue(
      JSON.stringify(createDefaultCertificateLayout())
    )
    expect(parsed?.version).toBe(1)
  })
})

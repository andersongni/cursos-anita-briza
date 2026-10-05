/** Largura/altura do PDF em mm (A4 paisagem). */
export const CERT_PAGE_WIDTH_MM = 297
export const CERT_PAGE_HEIGHT_MM = 210

/**
 * jsPDF `setFontSize` usa sempre pontos (pt), mesmo com coordenadas em mm.
 * 1 pt = 1/72 in; 1 in = 25.4 mm.
 */
export const PT_PER_INCH = 72
export const MM_PER_INCH = 25.4

/** Token especial: usa o logo da plataforma na emissão/preview. */
export const PLATFORM_LOGO_TOKEN = '{logo}'

/** Altura da página A4 paisagem em pontos tipográficos. */
export function certPageHeightPt(pageHeightMm = CERT_PAGE_HEIGHT_MM): number {
  return (pageHeightMm / MM_PER_INCH) * PT_PER_INCH
}

/** Converte tamanho tipográfico (pt) para pixels no preview, dada a altura do stage. */
export function fontSizePtToPreviewPx(fontSizePt: number, stageHeightPx: number): number {
  if (stageHeightPx <= 0) return fontSizePt
  return (fontSizePt / certPageHeightPt()) * stageHeightPx
}

export const CERTIFICATE_LAYOUT_KEY = 'certificate.layout'
export const CERTIFICATE_BACKGROUND_KEY = 'certificate.background_url'
/** Fundo oficial embutido em /public (cópia do modelo aprovado). */
export const DEFAULT_CERTIFICATE_BACKGROUND = '/certificate-template.jpg'

export type CertAlign = 'left' | 'center' | 'right'
export type CertElementType = 'text' | 'image'

export type CertificateLayoutElement = {
  id: string
  label: string
  type: CertElementType
  /** Texto exibido; variáveis ficam como chaves, ex.: {student_name} */
  text: string
  /** Posição X em % da largura (0–100). Texto: âncora; imagem: canto superior esquerdo. */
  x: number
  /** Posição Y em % da altura (0–100) */
  y: number
  /** Tamanho da fonte em pontos (pt) — unidade do jsPDF.setFontSize */
  fontSize: number
  align: CertAlign
  bold: boolean
  color: string
  /** Largura máxima para quebra de linha, em % da página (0 = sem quebra forçada) */
  maxWidthPct: number
  uppercase?: boolean
  underline?: boolean
  visible: boolean
  /**
   * URL da imagem, ou `{logo}` para o logo da plataforma.
   * Ignorado em elementos de texto.
   */
  imageUrl: string
  /** Largura da imagem em % da página */
  widthPct: number
  /** Altura da imagem em % da página */
  heightPct: number
  /** Opacidade 0–1 */
  opacity: number
}

export type CertificateLayout = {
  version: 1
  backgroundUrl: string
  /** @deprecated Preferir o elemento `logo`. Mantido em sync com `logo.visible`. */
  showLogo: boolean
  elements: CertificateLayoutElement[]
}

/**
 * Variáveis de sistema (não editáveis no modelo).
 * Variáveis editáveis ficam em `certificate.editable_variables` (ver variables.ts).
 */
export const READONLY_CERTIFICATE_PLACEHOLDERS = [
  {
    key: '{student_name}',
    label: 'Nome do aluno',
    description: 'Preenchido automaticamente com o nome do aluno na emissão',
  },
  {
    key: '{certificate_code}',
    label: 'Código do certificado',
    description: 'Código único gerado na emissão de cada certificado',
  },
  {
    key: '{date}',
    label: 'Data de conclusão',
    description: 'Data de conclusão do aluno na emissão',
  },
] as const

/** @deprecated Use READONLY_CERTIFICATE_PLACEHOLDERS + variáveis editáveis dinâmicas. */
export const CERTIFICATE_PLACEHOLDERS = READONLY_CERTIFICATE_PLACEHOLDERS

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function asColor(raw: unknown, fallback: string) {
  if (typeof raw !== 'string') return fallback
  const s = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1]
    const g = s[2]
    const b = s[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return fallback
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = asColor(hex, '#0078a8').slice(1)
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function isImageElement(el: CertificateLayoutElement): boolean {
  return el.type === 'image'
}

export function isTextElement(el: CertificateLayoutElement): boolean {
  return el.type !== 'image'
}

export function resolveElementImageUrl(
  el: CertificateLayoutElement,
  platformLogoUrl?: string | null
): string | null {
  if (!isImageElement(el)) return null
  const raw = (el.imageUrl || '').trim()
  if (!raw || raw === PLATFORM_LOGO_TOKEN) {
    return platformLogoUrl?.trim() || null
  }
  return raw
}

function textElementDefaults(
  partial: Partial<CertificateLayoutElement> & Pick<CertificateLayoutElement, 'id' | 'label'>
): CertificateLayoutElement {
  return {
    id: partial.id,
    label: partial.label,
    type: 'text',
    text: partial.text ?? 'Novo texto',
    x: partial.x ?? 50,
    y: partial.y ?? 50,
    fontSize: partial.fontSize ?? 16,
    align: partial.align ?? 'center',
    bold: partial.bold ?? false,
    color: partial.color ?? '#0078a8',
    maxWidthPct: partial.maxWidthPct ?? 50,
    uppercase: partial.uppercase ?? false,
    underline: partial.underline ?? false,
    visible: partial.visible ?? true,
    imageUrl: '',
    widthPct: 20,
    heightPct: 20,
    opacity: 1,
  }
}

function imageElementDefaults(
  partial: Partial<CertificateLayoutElement> & Pick<CertificateLayoutElement, 'id' | 'label'>
): CertificateLayoutElement {
  return {
    id: partial.id,
    label: partial.label,
    type: 'image',
    text: '',
    x: partial.x ?? 5,
    y: partial.y ?? 5,
    fontSize: 12,
    align: 'left',
    bold: false,
    color: '#0078a8',
    maxWidthPct: 0,
    visible: partial.visible ?? true,
    imageUrl: partial.imageUrl ?? PLATFORM_LOGO_TOKEN,
    widthPct: partial.widthPct ?? 15,
    heightPct: partial.heightPct ?? 20,
    opacity: partial.opacity ?? 1,
  }
}

export function createTextElement(
  partial?: Partial<CertificateLayoutElement>
): CertificateLayoutElement {
  const id = partial?.id || `text_${Date.now().toString(36)}`
  return textElementDefaults({
    ...partial,
    id,
    label: partial?.label || 'Novo texto',
  })
}

export function createImageElement(
  partial?: Partial<CertificateLayoutElement>
): CertificateLayoutElement {
  const id = partial?.id || `image_${Date.now().toString(36)}`
  return imageElementDefaults({
    ...partial,
    id,
    label: partial?.label || 'Nova imagem',
  })
}

function defaultLogoElement(visible: boolean): CertificateLayoutElement {
  return imageElementDefaults({
    id: 'logo',
    label: 'Logo',
    imageUrl: PLATFORM_LOGO_TOKEN,
    x: 4.7,
    y: 5.2,
    widthPct: 15.5,
    heightPct: 22,
    opacity: 1,
    visible,
  })
}

/** Layout padrão alinhado ao PDF atual. */
export function createDefaultCertificateLayout(
  texts?: Partial<{
    title: string
    subtitle: string
    introText: string
    middleText: string
    courseName: string
    courseDescription: string
    dateLine: string
    dateLabel: string
    codeLabel: string
    signatureTitle: string
    signatureSubtitle: string
  }>
): CertificateLayout {
  // Defaults oficiais (modelo aprovado no editor)
  const t = {
    title: 'CERTIFICADO',
    subtitle: 'DE CONCLUSÃO DE CURSO',
    introText: 'Certificamos que',
    middleText: 'concluiu com aproveitamento o curso de',
    courseName: '{course_name}',
    courseDescription:
      'desenvolvendo conhecimentos e habilidades para o uso do computador no dia a dia, incluindo sistema operacional, editor de textos, planilhas, internet e comunicação digital.',
    dateLine: '{location}, {date}',
    dateLabel: 'LOCAL E DATA',
    codeLabel: ' {certificate_code}',
    signatureTitle: 'Coordenação',
    signatureSubtitle: 'Núcleo Assistencial Anita Briza',
    ...texts,
  }

  const logo = defaultLogoElement(false)

  return {
    version: 1,
    backgroundUrl: DEFAULT_CERTIFICATE_BACKGROUND,
    showLogo: logo.visible,
    elements: [
      logo,
      textElementDefaults({
        id: 'title',
        label: 'Título',
        text: t.title,
        x: 92.6,
        y: 18.1,
        fontSize: 34,
        align: 'right',
        bold: true,
        color: '#0078a8',
        maxWidthPct: 45,
        uppercase: true,
        visible: false,
      }),
      textElementDefaults({
        id: 'subtitle',
        label: 'Subtítulo',
        text: t.subtitle,
        x: 92.6,
        y: 22.9,
        fontSize: 13,
        align: 'right',
        bold: false,
        color: '#e3c13b',
        maxWidthPct: 45,
        uppercase: true,
        visible: false,
      }),
      textElementDefaults({
        id: 'intro',
        label: 'Texto introdutório',
        text: t.introText,
        x: 50,
        y: 51.4,
        fontSize: 16,
        align: 'center',
        bold: false,
        color: '#0ca4e3',
        maxWidthPct: 50,
        visible: true,
      }),
      textElementDefaults({
        id: 'student_name',
        label: 'Nome do aluno',
        text: '{student_name}',
        x: 50,
        y: 56.5,
        fontSize: 28,
        align: 'center',
        bold: true,
        color: '#0078a8',
        maxWidthPct: 76,
        underline: true,
        visible: true,
      }),
      textElementDefaults({
        id: 'middle',
        label: 'Texto após o nome',
        text: t.middleText,
        x: 50,
        y: 61.5,
        fontSize: 16,
        align: 'center',
        bold: false,
        color: '#0ca4e3',
        maxWidthPct: 80,
        visible: true,
      }),
      textElementDefaults({
        id: 'course_name',
        label: 'Nome do curso',
        text: '{course_name}',
        x: 50,
        y: 67.2,
        fontSize: 30,
        align: 'center',
        bold: true,
        color: '#e3c13b',
        maxWidthPct: 70,
        uppercase: true,
        visible: true,
      }),
      textElementDefaults({
        id: 'description',
        label: 'Descrição do curso',
        text: t.courseDescription,
        x: 50,
        y: 72.0,
        fontSize: 16,
        align: 'center',
        bold: false,
        color: '#0ca4e3',
        maxWidthPct: 80,
        visible: true,
      }),
      textElementDefaults({
        id: 'date_line',
        label: 'Local e data',
        text: t.dateLine,
        x: 67.6,
        y: 80.7,
        fontSize: 16,
        align: 'center',
        bold: false,
        color: '#0078a8',
        maxWidthPct: 40,
        underline: true,
        visible: true,
      }),
      textElementDefaults({
        id: 'date_label',
        label: 'Rótulo da data',
        text: t.dateLabel,
        x: 67.6,
        y: 85.9,
        fontSize: 16,
        align: 'center',
        bold: true,
        color: '#0ca4e3',
        maxWidthPct: 20,
        visible: true,
      }),
      textElementDefaults({
        id: 'code_label',
        label: 'Código',
        text: t.codeLabel,
        x: 26.4,
        y: 83.9,
        fontSize: 12,
        align: 'center',
        bold: false,
        color: '#0078a8',
        maxWidthPct: 16,
        visible: true,
      }),
      textElementDefaults({
        id: 'signature_title',
        label: 'Assinatura (título)',
        text: t.signatureTitle,
        x: 78,
        y: 78.1,
        fontSize: 11,
        align: 'center',
        bold: true,
        color: '#0078a8',
        maxWidthPct: 30,
        visible: false,
      }),
      textElementDefaults({
        id: 'signature_subtitle',
        label: 'Assinatura (subtítulo)',
        text: t.signatureSubtitle,
        x: 78,
        y: 81.9,
        fontSize: 9,
        align: 'center',
        bold: false,
        color: '#0ca4e3',
        maxWidthPct: 30,
        visible: false,
      }),
    ],
  }
}

export function normalizeLayoutElement(
  raw: Partial<CertificateLayoutElement> | null | undefined,
  fallback: CertificateLayoutElement
): CertificateLayoutElement {
  const type: CertElementType =
    raw?.type === 'image' || fallback.type === 'image'
      ? raw?.type === 'text'
        ? 'text'
        : 'image'
      : 'text'

  const align =
    raw?.align === 'left' || raw?.align === 'right' || raw?.align === 'center'
      ? raw.align
      : fallback.align

  const base: CertificateLayoutElement = {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : fallback.id,
    label: typeof raw?.label === 'string' && raw.label ? raw.label : fallback.label,
    type,
    text: typeof raw?.text === 'string' ? raw.text : fallback.text,
    x: clamp(Number(raw?.x ?? fallback.x), 0, 100),
    y: clamp(Number(raw?.y ?? fallback.y), 0, 100),
    fontSize: clamp(Number(raw?.fontSize ?? fallback.fontSize), 4, 72),
    align,
    bold: Boolean(raw?.bold ?? fallback.bold),
    color: asColor(raw?.color, fallback.color),
    maxWidthPct: clamp(Number(raw?.maxWidthPct ?? fallback.maxWidthPct), 0, 100),
    uppercase: Boolean(raw?.uppercase ?? fallback.uppercase),
    underline: Boolean(raw?.underline ?? fallback.underline),
    visible: raw?.visible === undefined ? fallback.visible : Boolean(raw.visible),
    imageUrl:
      typeof raw?.imageUrl === 'string'
        ? raw.imageUrl
        : fallback.imageUrl || (type === 'image' ? PLATFORM_LOGO_TOKEN : ''),
    widthPct: clamp(Number(raw?.widthPct ?? fallback.widthPct ?? 15), 1, 100),
    heightPct: clamp(Number(raw?.heightPct ?? fallback.heightPct ?? 20), 1, 100),
    opacity: clamp(Number(raw?.opacity ?? fallback.opacity ?? 1), 0, 1),
  }

  if (type === 'image') {
    return {
      ...base,
      type: 'image',
      text: '',
      imageUrl: base.imageUrl || PLATFORM_LOGO_TOKEN,
    }
  }

  return {
    ...base,
    type: 'text',
    imageUrl: '',
  }
}

export function normalizeCertificateLayout(raw: unknown): CertificateLayout {
  const defaults = createDefaultCertificateLayout()
  if (!raw || typeof raw !== 'object') return defaults

  const obj = raw as Partial<CertificateLayout>
  const incoming = Array.isArray(obj.elements) ? obj.elements : []
  const byId = new Map(
    incoming
      .filter((e): e is CertificateLayoutElement => !!e && typeof e === 'object' && 'id' in e)
      .map((e) => [String((e as CertificateLayoutElement).id), e as CertificateLayoutElement])
  )

  // Mantém ordem padrão e mescla elementos salvos; inclui extras do usuário no fim
  const merged = defaults.elements.map((def) => {
    const saved = byId.get(def.id)
    if (def.id === 'logo' && !saved) {
      // Migra o antigo checkbox showLogo para o elemento logo
      const migratedVisible =
        obj.showLogo === undefined ? true : Boolean(obj.showLogo)
      return normalizeLayoutElement({ ...def, visible: migratedVisible }, def)
    }
    return normalizeLayoutElement(saved, def)
  })

  for (const [id, el] of byId) {
    if (merged.some((m) => m.id === id)) continue
    const isImage = el.type === 'image'
    merged.push(
      normalizeLayoutElement(
        el,
        isImage
          ? createImageElement({ id, label: el.label || id, visible: true })
          : createTextElement({
              id,
              label: el.label || id,
              text: el.text || '',
              visible: true,
            })
      )
    )
  }

  const bg =
    typeof obj.backgroundUrl === 'string' && obj.backgroundUrl.trim()
      ? obj.backgroundUrl.trim()
      : DEFAULT_CERTIFICATE_BACKGROUND

  const logoEl = merged.find((e) => e.id === 'logo')
  const showLogo = logoEl ? logoEl.visible : obj.showLogo === undefined ? true : Boolean(obj.showLogo)

  return {
    version: 1,
    backgroundUrl: bg.startsWith('/') ? bg : DEFAULT_CERTIFICATE_BACKGROUND,
    showLogo,
    elements: merged,
  }
}

export function parseLayoutSettingValue(raw: string | null | undefined): CertificateLayout | null {
  if (raw == null || raw === '') return null
  try {
    const parsed = JSON.parse(raw)
    return normalizeCertificateLayout(parsed)
  } catch {
    return null
  }
}

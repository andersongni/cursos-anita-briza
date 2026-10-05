import fs from 'node:fs'
import path from 'node:path'
import jsPDF from 'jspdf'
import { DEFAULT_LOGO_URL } from '@/lib/platform/logo'
import {
  CERT_PAGE_HEIGHT_MM,
  CERT_PAGE_WIDTH_MM,
  createDefaultCertificateLayout,
  hexToRgb,
  isImageElement,
  resolveElementImageUrl,
  type CertificateLayout,
} from '@/lib/certificate/layout'
import {
  editableVariablesToMap,
  stripVariableBraces,
  type CertificateEditableVariable,
} from '@/lib/certificate/variables'

export interface CertificateData {
  studentName: string
  courseName: string
  institutionName: string
  completionDateLabel: string
  certificateCode: string
  courseHours: number
  location: string
  logoUrl?: string
  layout?: CertificateLayout
  editableVariables?: CertificateEditableVariable[]
}

/** Fallback visual se a imagem de fundo não existir */
const GOLD: [number, number, number] = [227, 193, 59]
const BLUE: [number, number, number] = [0, 120, 168]
const CREAM: [number, number, number] = [255, 255, 255]

function resolvePublicFile(urlPath: string): string | null {
  const cleaned = urlPath.split('?')[0].replace(/^\//, '')
  if (!cleaned || cleaned.includes('..')) return null
  const absolute = path.join(process.cwd(), 'public', cleaned)
  return fs.existsSync(absolute) ? absolute : null
}

function loadImageAsDataUrl(filePath: string): { dataUrl: string; format: 'JPEG' | 'PNG' } | null {
  try {
    const ext = path.extname(filePath).toLowerCase()
    const format: 'JPEG' | 'PNG' = ext === '.png' ? 'PNG' : 'JPEG'
    const mime = format === 'PNG' ? 'image/png' : 'image/jpeg'
    const buffer = fs.readFileSync(filePath)
    return {
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
      format,
    }
  } catch {
    return null
  }
}

function registerFonts(doc: jsPDF) {
  const fonts = [
    { file: 'Nunito-Regular.ttf', name: 'Nunito', style: 'normal' },
    { file: 'Nunito-Bold.ttf', name: 'Nunito', style: 'bold' },
  ] as const

  for (const font of fonts) {
    const absolute = path.join(process.cwd(), 'public', 'fonts', font.file)
    if (!fs.existsSync(absolute)) continue
    const base64 = fs.readFileSync(absolute).toString('base64')
    doc.addFileToVFS(font.file, base64)
    doc.addFont(font.file, font.name, font.style)
  }
}

function hasFont(doc: jsPDF, name: string): boolean {
  try {
    return doc.getFontList()[name] != null
  } catch {
    return false
  }
}

function drawTopWaves(doc: jsPDF) {
  doc.setFillColor(...GOLD)
  doc.lines(
    [
      [60, -10],
      [100, 24],
      [160, 8],
      [45, 30],
      [-35, 20],
      [-80, 10],
      [-100, -12],
      [-60, -30],
    ],
    0,
    0,
    [1, 1],
    'F',
    true
  )

  doc.setFillColor(...BLUE)
  doc.lines(
    [
      [52, -8],
      [78, 18],
      [120, 6],
      [32, 22],
      [-24, 14],
      [-55, 6],
      [-75, -10],
      [-48, -24],
    ],
    0,
    10,
    [1, 1],
    'F',
    true
  )
}

function drawBottomWaves(doc: jsPDF, pageWidth: number, pageHeight: number) {
  doc.setFillColor(...BLUE)
  doc.lines(
    [
      [-60, 10],
      [-100, -24],
      [-160, -8],
      [-45, -30],
      [35, -20],
      [80, -10],
      [100, 12],
      [60, 30],
    ],
    pageWidth,
    pageHeight,
    [1, 1],
    'F',
    true
  )

  doc.setFillColor(...GOLD)
  doc.lines(
    [
      [-52, 8],
      [-78, -18],
      [-120, -6],
      [-32, -22],
      [24, -14],
      [55, -6],
      [75, 10],
      [48, 24],
    ],
    pageWidth,
    pageHeight - 10,
    [1, 1],
    'F',
    true
  )
}

function applyPlaceholders(text: string, vars: Record<string, string>) {
  let out = text
  const tokens = Object.keys(vars)
    .map((k) => (k.startsWith('{') ? k : `{${stripVariableBraces(k)}}`))
    .filter((k, i, arr) => arr.indexOf(k) === i)
    .sort((a, b) => b.length - a.length)

  for (const token of tokens) {
    const value = vars[token] ?? vars[stripVariableBraces(token)]
    if (value == null) continue
    out = out.split(token).join(value)
  }
  return out
}

export function generateCertificatePDF(data: CertificateData): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  registerFonts(doc)
  const bodyFont = hasFont(doc, 'Nunito') ? 'Nunito' : 'helvetica'

  const pageWidth = doc.internal.pageSize.getWidth() || CERT_PAGE_WIDTH_MM
  const pageHeight = doc.internal.pageSize.getHeight() || CERT_PAGE_HEIGHT_MM

  const custom = editableVariablesToMap(data.editableVariables ?? [])
  const vars: Record<string, string> = {
    ...custom,
    '{student_name}': data.studentName,
    student_name: data.studentName,
    '{certificate_code}': data.certificateCode,
    certificate_code: data.certificateCode,
    '{date}': data.completionDateLabel,
    date: data.completionDateLabel,
    '{course_name}': custom['{course_name}'] ?? data.courseName,
    course_name: custom['{course_name}'] ?? data.courseName,
    '{institution}': custom['{institution}'] ?? data.institutionName,
    institution: custom['{institution}'] ?? data.institutionName,
    '{course_hours}': custom['{course_hours}'] ?? String(data.courseHours),
    course_hours: custom['{course_hours}'] ?? String(data.courseHours),
    '{location}': custom['{location}'] ?? data.location,
    location: custom['{location}'] ?? data.location,
  }

  const layout = data.layout ?? createDefaultCertificateLayout()

  const templatePath = resolvePublicFile(layout.backgroundUrl || '/certificate-template.jpg')
  const template = templatePath ? loadImageAsDataUrl(templatePath) : null

  const platformLogoPath =
    resolvePublicFile(data.logoUrl || DEFAULT_LOGO_URL) ||
    resolvePublicFile(DEFAULT_LOGO_URL)
  const platformLogoUrl = data.logoUrl || DEFAULT_LOGO_URL

  if (template) {
    doc.addImage(template.dataUrl, template.format, 0, 0, pageWidth, pageHeight)
  } else {
    doc.setFillColor(...CREAM)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    drawTopWaves(doc)
    drawBottomWaves(doc, pageWidth, pageHeight)
  }

  const GStateCtor = (
    doc as unknown as { GState?: new (opts: { opacity: number }) => unknown }
  ).GState

  for (const el of layout.elements) {
    if (!el.visible) continue

    if (isImageElement(el)) {
      const url = resolveElementImageUrl(el, platformLogoUrl)
      if (!url) continue
      const filePath =
        resolvePublicFile(url) ||
        (url.includes('logo') ? platformLogoPath : null)
      const image = filePath ? loadImageAsDataUrl(filePath) : null
      if (!image) continue

      const x = (el.x / 100) * pageWidth
      const y = (el.y / 100) * pageHeight
      const w = (el.widthPct / 100) * pageWidth
      const h = (el.heightPct / 100) * pageHeight
      const opacity = Number.isFinite(el.opacity) ? el.opacity : 1

      try {
        if (GStateCtor && opacity < 1) {
          doc.setGState(new GStateCtor({ opacity }) as never)
        }
        doc.addImage(image.dataUrl, image.format, x, y, w, h)
        if (GStateCtor && opacity < 1) {
          doc.setGState(new GStateCtor({ opacity: 1 }) as never)
        }
      } catch {
        // imagem opcional
      }
      continue
    }

    let text = applyPlaceholders(el.text, vars)
    if (el.uppercase) text = text.toUpperCase()

    const x = (el.x / 100) * pageWidth
    const y = (el.y / 100) * pageHeight
    const [r, g, b] = hexToRgb(el.color)

    doc.setFont(bodyFont, el.bold ? 'bold' : 'normal')
    doc.setFontSize(el.fontSize)
    doc.setTextColor(r, g, b)

    const maxWidth =
      el.maxWidthPct > 0 ? (el.maxWidthPct / 100) * pageWidth : pageWidth * 0.9
    const lines = doc.splitTextToSize(text, maxWidth) as string[]
    doc.text(lines, x, y, { align: el.align })

    if (el.underline && lines.length > 0) {
      const first = lines[0] ?? ''
      const tw = doc.getTextWidth(first)
      let x1 = x
      let x2 = x + tw
      if (el.align === 'center') {
        x1 = x - tw / 2 - 2
        x2 = x + tw / 2 + 2
      } else if (el.align === 'right') {
        x1 = x - tw - 2
        x2 = x + 2
      } else {
        x1 = x
        x2 = x + Math.max(tw, 55)
      }
      doc.setDrawColor(r, g, b)
      doc.setLineWidth(0.35)
      doc.line(x1, y + 3, x2, y + 3)
    }
  }

  return doc
}

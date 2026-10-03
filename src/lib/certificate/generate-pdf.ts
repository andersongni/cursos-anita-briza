import fs from 'node:fs'
import path from 'node:path'
import jsPDF from 'jspdf'
import { DEFAULT_LOGO_URL } from '@/lib/platform/logo'

export interface CertificateData {
  studentName: string
  courseName: string
  institutionName: string
  completionDateLabel: string
  certificateCode: string
  courseHours: number
  title: string
  subtitle: string
  introText: string
  middleText: string
  courseDescription: string
  location: string
  dateLine: string
  dateLabel: string
  signatureTitle: string
  signatureSubtitle: string
  codeLabel: string
  logoUrl?: string
}

const RED: [number, number, number] = [227, 30, 36]
const BLUE: [number, number, number] = [29, 66, 138]
const BLUE_SOFT: [number, number, number] = [55, 95, 160]
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
  doc.setFillColor(...RED)
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

  doc.setFillColor(...RED)
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

type PlaceholderMap = {
  student_name: string
  course_name: string
  institution: string
  certificate_code: string
  course_hours: string
  date: string
  location: string
}

function applyPlaceholders(text: string, vars: PlaceholderMap) {
  return text
    .replaceAll('{student_name}', vars.student_name)
    .replaceAll('{course_name}', vars.course_name)
    .replaceAll('{institution}', vars.institution)
    .replaceAll('{certificate_code}', vars.certificate_code)
    .replaceAll('{course_hours}', vars.course_hours)
    .replaceAll('{date}', vars.date)
    .replaceAll('{location}', vars.location)
}

export function generateCertificatePDF(data: CertificateData): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  registerFonts(doc)
  const bodyFont = hasFont(doc, 'Nunito') ? 'Nunito' : 'helvetica'

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const vars: PlaceholderMap = {
    student_name: data.studentName,
    course_name: data.courseName,
    institution: data.institutionName,
    certificate_code: data.certificateCode,
    course_hours: String(data.courseHours),
    date: data.completionDateLabel,
    location: data.location,
  }

  const templatePath = resolvePublicFile('/certificate-template.jpg')
  const template = templatePath ? loadImageAsDataUrl(templatePath) : null

  if (template) {
    doc.addImage(template.dataUrl, template.format, 0, 0, pageWidth, pageHeight)
  } else {
    doc.setFillColor(...CREAM)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    drawTopWaves(doc)
    drawBottomWaves(doc, pageWidth, pageHeight)

    const logoPath =
      resolvePublicFile(data.logoUrl || DEFAULT_LOGO_URL) ||
      resolvePublicFile(DEFAULT_LOGO_URL)
    const logo = logoPath ? loadImageAsDataUrl(logoPath) : null

    if (logo) {
      try {
        const GState = (doc as unknown as { GState: new (opts: { opacity: number }) => unknown }).GState
        doc.setGState(new GState({ opacity: 0.08 }) as never)
        doc.addImage(logo.dataUrl, logo.format, pageWidth - 115, 45, 95, 95)
        doc.setGState(new GState({ opacity: 1 }) as never)
      } catch {
        // marca d'água opcional
      }
      doc.addImage(logo.dataUrl, logo.format, 18, 16, 38, 38)
    }

    doc.setFont(bodyFont, 'bold')
    doc.setFontSize(34)
    doc.setTextColor(...BLUE)
    doc.text(applyPlaceholders(data.title, vars), pageWidth - 22, 38, { align: 'right' })

    doc.setFontSize(13)
    doc.setTextColor(...RED)
    doc.text(applyPlaceholders(data.subtitle, vars), pageWidth - 22, 48, { align: 'right' })
  }

  const intro = applyPlaceholders(data.introText, vars)
  const middle = applyPlaceholders(data.middleText, vars)
  const description = applyPlaceholders(data.courseDescription, vars)
  const dateLine = applyPlaceholders(data.dateLine, vars)
  const dateLabel = applyPlaceholders(data.dateLabel, vars)
  const codeLabel = applyPlaceholders(data.codeLabel, vars)
  const courseName = applyPlaceholders(data.courseName, vars)

  // Corpo — tipografia arredondada (Nunito), próxima da identidade visual
  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(13)
  doc.setTextColor(...BLUE_SOFT)
  doc.text(intro, pageWidth / 2, 79, { align: 'center' })

  // Nome — Nunito negrito (legível)
  doc.setFont(bodyFont, 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...BLUE)
  doc.text(data.studentName, pageWidth / 2, 92, { align: 'center' })

  const nameWidth = doc.getTextWidth(data.studentName)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.35)
  doc.line(pageWidth / 2 - nameWidth / 2 - 2, 96, pageWidth / 2 + nameWidth / 2 + 2, 96)

  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(13)
  doc.setTextColor(...BLUE_SOFT)
  doc.text(middle, pageWidth / 2, 110, { align: 'center' })

  doc.setFont(bodyFont, 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...RED)
  doc.text(courseName.toUpperCase(), pageWidth / 2, 126, { align: 'center' })

  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...BLUE_SOFT)
  const descLines = doc.splitTextToSize(description, pageWidth - 90)
  doc.text(descLines, pageWidth / 2, 138, { align: 'center' })

  // Local/data e código: mais espaço após a descrição, ainda acima da faixa escura (~y > 175)
  const footerY = 164

  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...BLUE)
  doc.text(dateLine, 42, footerY)
  const dateWidth = doc.getTextWidth(dateLine)
  doc.setLineWidth(0.35)
  doc.line(42, footerY + 3, 42 + Math.max(dateWidth, 55), footerY + 3)
  doc.setFont(bodyFont, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BLUE_SOFT)
  doc.text(dateLabel, 42, footerY + 8)

  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BLUE)
  doc.text(codeLabel, pageWidth / 2, footerY + 8, { align: 'center' })

  return doc
}

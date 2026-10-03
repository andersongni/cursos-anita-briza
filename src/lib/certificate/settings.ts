import { prisma } from '@/lib/db'
import { DEFAULT_LOGO_URL, normalizeLogoUrl } from '@/lib/platform/logo'

function parseSettingValue(raw: string, fallback: string): string {
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed : String(parsed)
  } catch {
    return raw.replace(/^"|"$/g, '') || fallback
  }
}

function parseSettingNumber(raw: string, fallback: number): number {
  try {
    const parsed = JSON.parse(raw)
    const n = typeof parsed === 'number' ? parsed : Number(parsed)
    return Number.isFinite(n) && n > 0 ? n : fallback
  } catch {
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
}

export const CERTIFICATE_SETTING_DEFAULTS = {
  title: 'CERTIFICADO',
  subtitle: 'DE CONCLUSÃO DO CURSO',
  courseName: 'Informática Básica',
  institutionName: 'Núcleo Assistencial Anita Briza',
  introText: 'O {institution} certifica que',
  middleText: 'concluiu com aproveitamento o curso de',
  courseHours: 40,
  courseDescription:
    'com carga horária de {course_hours} horas, desenvolvendo conhecimentos e habilidades para o uso do computador no dia a dia, incluindo sistema operacional, editor de textos, planilhas, internet e comunicação digital.',
  location: 'São Paulo',
  dateLine: '{location}, {date}',
  dateLabel: 'LOCAL E DATA',
  signatureTitle: 'Coordenação',
  signatureSubtitle: 'Núcleo Assistencial Anita Briza',
  codeLabel: 'Código: {certificate_code}',
  logoUrl: DEFAULT_LOGO_URL,
} as const

export const CERTIFICATE_SETTING_KEYS = [
  'platform.course_name',
  'platform.institution',
  'platform.logo_url',
  'certificate.title',
  'certificate.subtitle',
  'certificate.intro_text',
  'certificate.middle_text',
  'certificate.course_hours',
  'certificate.course_description',
  'certificate.location',
  'certificate.date_line',
  'certificate.date_label',
  'certificate.signature_title',
  'certificate.signature_subtitle',
  'certificate.code_label',
] as const

export async function getCertificateSettings() {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...CERTIFICATE_SETTING_KEYS] } },
  })

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  return {
    title: parseSettingValue(map['certificate.title'] ?? '', CERTIFICATE_SETTING_DEFAULTS.title),
    subtitle: parseSettingValue(
      map['certificate.subtitle'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.subtitle
    ),
    courseName: parseSettingValue(
      map['platform.course_name'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.courseName
    ),
    institutionName: parseSettingValue(
      map['platform.institution'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.institutionName
    ),
    introText: parseSettingValue(
      map['certificate.intro_text'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.introText
    ),
    middleText: parseSettingValue(
      map['certificate.middle_text'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.middleText
    ),
    courseHours: parseSettingNumber(
      map['certificate.course_hours'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.courseHours
    ),
    courseDescription: parseSettingValue(
      map['certificate.course_description'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.courseDescription
    ),
    location: parseSettingValue(
      map['certificate.location'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.location
    ),
    dateLine: parseSettingValue(
      map['certificate.date_line'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.dateLine
    ),
    dateLabel: parseSettingValue(
      map['certificate.date_label'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.dateLabel
    ),
    signatureTitle: parseSettingValue(
      map['certificate.signature_title'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.signatureTitle
    ),
    signatureSubtitle: parseSettingValue(
      map['certificate.signature_subtitle'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.signatureSubtitle
    ),
    codeLabel: parseSettingValue(
      map['certificate.code_label'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.codeLabel
    ),
    logoUrl: normalizeLogoUrl(
      parseSettingValue(map['platform.logo_url'] ?? '', CERTIFICATE_SETTING_DEFAULTS.logoUrl)
    ),
  }
}

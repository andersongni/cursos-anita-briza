import { prisma } from '@/lib/db'
import { DEFAULT_LOGO_URL, normalizeLogoUrl } from '@/lib/platform/logo'
import {
  CERTIFICATE_BACKGROUND_KEY,
  CERTIFICATE_LAYOUT_KEY,
  createDefaultCertificateLayout,
  DEFAULT_CERTIFICATE_BACKGROUND,
  normalizeCertificateLayout,
  parseLayoutSettingValue,
  type CertificateLayout,
} from '@/lib/certificate/layout'
import {
  CERTIFICATE_EDITABLE_VARIABLES_KEY,
  createDefaultEditableVariables,
  editableVariablesToMap,
  LEGACY_VARIABLE_SETTING_KEYS,
  normalizeEditableVariables,
  type CertificateEditableVariable,
} from '@/lib/certificate/variables'

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
  subtitle: 'DE CONCLUSÃO DE CURSO',
  courseName: 'Informática Básica',
  institutionName: 'Núcleo Assistencial Anita Briza',
  introText: 'Certificamos que',
  middleText: 'concluiu com aproveitamento o curso de',
  courseHours: 40,
  courseDescription:
    'desenvolvendo conhecimentos e habilidades para o uso do computador no dia a dia, incluindo sistema operacional, editor de textos, planilhas, internet e comunicação digital.',
  location: 'São Paulo',
  dateLine: '{location}, {date}',
  dateLabel: 'LOCAL E DATA',
  signatureTitle: 'Coordenação',
  signatureSubtitle: 'Núcleo Assistencial Anita Briza',
  codeLabel: ' {certificate_code}',
  logoUrl: DEFAULT_LOGO_URL,
} as const

async function upsertSettingValue(
  key: string,
  value: unknown,
  userId: string,
  description?: string
) {
  const stringified = JSON.stringify(value)
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: stringified, updated_by: userId, ...(description ? { description } : {}) },
    create: {
      key,
      value: stringified,
      updated_by: userId,
      description: description ?? key,
    },
  })
}

export async function getCertificateEditableVariables(): Promise<CertificateEditableVariable[]> {
  const [row, legacyRows] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: CERTIFICATE_EDITABLE_VARIABLES_KEY } }),
    prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'platform.course_name',
            'platform.institution',
            'certificate.course_hours',
            'certificate.location',
          ],
        },
      },
    }),
  ])

  const legacy = Object.fromEntries(legacyRows.map((r) => [r.key, r.value]))
  const seeded = createDefaultEditableVariables({
    courseName: parseSettingValue(
      legacy['platform.course_name'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.courseName
    ),
    institutionName: parseSettingValue(
      legacy['platform.institution'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.institutionName
    ),
    courseHours: parseSettingNumber(
      legacy['certificate.course_hours'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.courseHours
    ),
    location: parseSettingValue(
      legacy['certificate.location'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.location
    ),
  })

  if (!row?.value) return seeded

  try {
    return normalizeEditableVariables(JSON.parse(row.value), seeded)
  } catch {
    return seeded
  }
}

export async function saveCertificateEditableVariables(
  userId: string,
  variables: CertificateEditableVariable[]
): Promise<CertificateEditableVariable[]> {
  const normalized = normalizeEditableVariables(variables, [], { allowEmpty: true })
  await upsertSettingValue(
    CERTIFICATE_EDITABLE_VARIABLES_KEY,
    normalized,
    userId,
    'Variáveis editáveis do certificado (chave/valor)'
  )

  // Mantém settings legados em sync quando as chaves padrão ainda existem
  for (const [varKey, settingKey] of Object.entries(LEGACY_VARIABLE_SETTING_KEYS)) {
    const found = normalized.find((v) => v.key === varKey)
    if (!found) continue
    const value =
      settingKey === 'certificate.course_hours'
        ? Math.max(1, Math.floor(Number(found.value) || CERTIFICATE_SETTING_DEFAULTS.courseHours))
        : found.value
    await upsertSettingValue(settingKey, value, userId)
  }

  return normalized
}

export async function getCertificateLayout(): Promise<CertificateLayout> {
  const [layoutRow, bgRow, legacyRows] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: CERTIFICATE_LAYOUT_KEY } }),
    prisma.systemSetting.findUnique({ where: { key: CERTIFICATE_BACKGROUND_KEY } }),
    prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'certificate.title',
            'certificate.subtitle',
            'certificate.intro_text',
            'certificate.middle_text',
            'certificate.course_description',
            'certificate.date_line',
            'certificate.date_label',
            'certificate.code_label',
            'certificate.signature_title',
            'certificate.signature_subtitle',
            'platform.course_name',
          ],
        },
      },
    }),
  ])

  const legacy = Object.fromEntries(legacyRows.map((r) => [r.key, r.value]))
  const fromLegacy = createDefaultCertificateLayout({
    title: parseSettingValue(legacy['certificate.title'] ?? '', CERTIFICATE_SETTING_DEFAULTS.title),
    subtitle: parseSettingValue(
      legacy['certificate.subtitle'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.subtitle
    ),
    introText: parseSettingValue(
      legacy['certificate.intro_text'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.introText
    ),
    middleText: parseSettingValue(
      legacy['certificate.middle_text'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.middleText
    ),
    courseDescription: parseSettingValue(
      legacy['certificate.course_description'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.courseDescription
    ),
    dateLine: parseSettingValue(
      legacy['certificate.date_line'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.dateLine
    ),
    dateLabel: parseSettingValue(
      legacy['certificate.date_label'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.dateLabel
    ),
    codeLabel: parseSettingValue(
      legacy['certificate.code_label'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.codeLabel
    ),
    signatureTitle: parseSettingValue(
      legacy['certificate.signature_title'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.signatureTitle
    ),
    signatureSubtitle: parseSettingValue(
      legacy['certificate.signature_subtitle'] ?? '',
      CERTIFICATE_SETTING_DEFAULTS.signatureSubtitle
    ),
  })

  // course_name element always shows the key in editor; PDF substitutes from platform setting
  const courseEl = fromLegacy.elements.find((e) => e.id === 'course_name')
  if (courseEl) courseEl.text = '{course_name}'

  const saved = parseLayoutSettingValue(layoutRow?.value)
  const layout = saved ? normalizeCertificateLayout(saved) : fromLegacy

  if (bgRow?.value) {
    const bg = parseSettingValue(bgRow.value, DEFAULT_CERTIFICATE_BACKGROUND)
    if (bg.startsWith('/')) layout.backgroundUrl = bg
  }

  return layout
}

export async function getCertificateSettings() {
  const [rows, layout, editableVariables] = await Promise.all([
    prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'platform.course_name',
            'platform.institution',
            'platform.logo_url',
            'certificate.course_hours',
            'certificate.location',
          ],
        },
      },
    }),
    getCertificateLayout(),
    getCertificateEditableVariables(),
  ])

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const varMap = editableVariablesToMap(editableVariables)

  return {
    courseName:
      varMap['{course_name}'] ??
      parseSettingValue(map['platform.course_name'] ?? '', CERTIFICATE_SETTING_DEFAULTS.courseName),
    institutionName:
      varMap['{institution}'] ??
      parseSettingValue(
        map['platform.institution'] ?? '',
        CERTIFICATE_SETTING_DEFAULTS.institutionName
      ),
    courseHours: (() => {
      if (varMap['{course_hours}'] != null && varMap['{course_hours}'] !== '') {
        const n = Number(varMap['{course_hours}'])
        if (Number.isFinite(n) && n > 0) return Math.floor(n)
      }
      return parseSettingNumber(
        map['certificate.course_hours'] ?? '',
        CERTIFICATE_SETTING_DEFAULTS.courseHours
      )
    })(),
    location:
      varMap['{location}'] ??
      parseSettingValue(map['certificate.location'] ?? '', CERTIFICATE_SETTING_DEFAULTS.location),
    logoUrl: normalizeLogoUrl(
      parseSettingValue(map['platform.logo_url'] ?? '', CERTIFICATE_SETTING_DEFAULTS.logoUrl)
    ),
    editableVariables,
    layout,
  }
}

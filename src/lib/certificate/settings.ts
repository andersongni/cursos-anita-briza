import { prisma } from '@/lib/db'

function parseSettingValue(raw: string, fallback: string): string {
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed : String(parsed)
  } catch {
    return raw.replace(/^"|"$/g, '') || fallback
  }
}

export async function getCertificateSettings() {
  const rows = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          'platform.course_name',
          'platform.institution',
          'certificate.template_text',
        ],
      },
    },
  })

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  return {
    courseName: parseSettingValue(
      map['platform.course_name'] ?? '',
      'Informática para Iniciantes'
    ),
    institutionName: parseSettingValue(
      map['platform.institution'] ?? '',
      'Núcleo Assistencial Anita Briza'
    ),
    templateText: parseSettingValue(
      map['certificate.template_text'] ?? '',
      'Certificamos que {student_name} concluiu com êxito o curso de {course_name}, realizado pelo {institution}, obtendo aprovação na avaliação final.'
    ),
  }
}

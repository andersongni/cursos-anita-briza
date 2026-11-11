import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  systemSetting: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  course: {
    findFirst: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma }))

import {
  CERTIFICATE_SETTING_DEFAULTS,
  getCertificateEditableVariables,
  getCertificateLayout,
  getCertificateSettings,
  saveCertificateEditableVariables,
} from './settings'
import { CERTIFICATE_EDITABLE_VARIABLES_KEY } from './variables'
import { CERTIFICATE_BACKGROUND_KEY, CERTIFICATE_LAYOUT_KEY } from './layout'

describe('certificate settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.systemSetting.upsert.mockResolvedValue({})
  })

  it('getCertificateEditableVariables com legado e JSON inválido', async () => {
    prisma.systemSetting.findUnique.mockResolvedValueOnce(null)
    prisma.systemSetting.findMany.mockResolvedValueOnce([
      { key: 'platform.course_name', value: '"Curso X"' },
      { key: 'platform.institution', value: 'Inst' },
      { key: 'certificate.course_hours', value: '50' },
      { key: 'certificate.location', value: '"RJ"' },
    ])
    const seeded = await getCertificateEditableVariables()
    expect(seeded.find((v) => v.key === '{course_name}')?.value).toBe('Curso X')

    prisma.systemSetting.findUnique.mockResolvedValueOnce({ value: 'not-json' })
    prisma.systemSetting.findMany.mockResolvedValueOnce([])
    const fallback = await getCertificateEditableVariables()
    expect(fallback[0].value).toBe(CERTIFICATE_SETTING_DEFAULTS.institutionName)

    prisma.systemSetting.findUnique.mockResolvedValueOnce({
      value: JSON.stringify([{ key: '{location}', value: 'BH', id: 'loc' }]),
    })
    prisma.systemSetting.findMany.mockResolvedValueOnce([])
    const fromRow = await getCertificateEditableVariables()
    expect(fromRow).toEqual([{ id: 'loc', key: '{location}', value: 'BH' }])
  })

  it('saveCertificateEditableVariables sincroniza legado', async () => {
    const saved = await saveCertificateEditableVariables('u1', [
      { id: '1', key: '{course_hours}', value: '12' },
      { id: '2', key: '{institution}', value: 'Org' },
    ])
    expect(saved).toHaveLength(2)
    expect(prisma.systemSetting.upsert).toHaveBeenCalled()
    const keys = prisma.systemSetting.upsert.mock.calls.map(
      (c: unknown[]) => (c[0] as { where: { key: string } }).where.key
    )
    expect(keys).toContain(CERTIFICATE_EDITABLE_VARIABLES_KEY)
    expect(keys).toContain('certificate.course_hours')
    expect(keys).toContain('platform.institution')
  })

  it('getCertificateLayout mescla legado e fundo', async () => {
    prisma.systemSetting.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === CERTIFICATE_LAYOUT_KEY) return null
      if (where.key === CERTIFICATE_BACKGROUND_KEY) return { value: '"/custom-bg.jpg"' }
      return null
    })
    prisma.systemSetting.findMany.mockResolvedValueOnce([
      { key: 'certificate.title', value: '"TITULO"' },
    ])
    const layout = await getCertificateLayout()
    expect(layout.backgroundUrl).toBe('/custom-bg.jpg')
    expect(layout.elements.find((e) => e.id === 'title')?.text).toBe('TITULO')
    expect(layout.elements.find((e) => e.id === 'course_name')?.text).toBe(
      '{course_name}'
    )
  })

  it('getCertificateSettings prioriza curso ativo', async () => {
    prisma.systemSetting.findMany.mockResolvedValue([
      { key: 'platform.logo_url', value: '"/logo.png"' },
      { key: 'platform.institution', value: '"Inst"' },
      { key: 'certificate.location', value: '"SP"' },
      { key: 'certificate.course_hours', value: '40' },
      { key: 'platform.course_name', value: '"Global"' },
    ])
    prisma.systemSetting.findUnique.mockResolvedValue(null)
    prisma.course.findFirst.mockResolvedValueOnce({
      name: 'Elétrica',
      hours: 30,
      description: 'Desc',
    })

    const settings = await getCertificateSettings({ courseId: 'c1' })
    expect(settings.courseName).toBe('Elétrica')
    expect(settings.courseHours).toBe(30)
    expect(settings.courseDescription).toBe('Desc')
    expect(settings.logoUrl).toBe('/logo.png')

    prisma.course.findFirst.mockResolvedValueOnce(null)
    const withoutCourse = await getCertificateSettings()
    expect(withoutCourse.courseName).toBe('Global')

    prisma.systemSetting.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === CERTIFICATE_EDITABLE_VARIABLES_KEY) {
        return {
          value: JSON.stringify([
            { id: '1', key: '{course_hours}', value: '22' },
            { id: '2', key: '{course_name}', value: 'VarCurso' },
            { id: '3', key: '{institution}', value: 'VarInst' },
            { id: '4', key: '{location}', value: 'VarLoc' },
          ]),
        }
      }
      return null
    })
    prisma.systemSetting.findMany.mockResolvedValue([])
    prisma.course.findFirst.mockResolvedValueOnce(null)
    const fromVars = await getCertificateSettings({ courseId: 'c2' })
    expect(fromVars.courseName).toBe('VarCurso')
    expect(fromVars.courseHours).toBe(22)
    expect(fromVars.institutionName).toBe('VarInst')
    expect(fromVars.location).toBe('VarLoc')

    prisma.systemSetting.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === CERTIFICATE_EDITABLE_VARIABLES_KEY) {
        return {
          value: JSON.stringify([
            { id: '1', key: '{course_hours}', value: '0' },
            { id: '2', key: '{other}', value: 'x' },
          ]),
        }
      }
      return null
    })
    prisma.systemSetting.findMany.mockResolvedValue([
      { key: 'platform.institution', value: '' },
      { key: 'certificate.location', value: 'not-json' },
      { key: 'certificate.course_hours', value: 'abc' },
      { key: 'platform.logo_url', value: '42' },
    ])
    prisma.course.findFirst.mockResolvedValueOnce(null)
    const fallbacks = await getCertificateSettings()
    expect(fallbacks.courseHours).toBe(CERTIFICATE_SETTING_DEFAULTS.courseHours)
    expect(fallbacks.institutionName).toBe(
      CERTIFICATE_SETTING_DEFAULTS.institutionName
    )
    expect(fallbacks.location).toBe('not-json')
  })
})



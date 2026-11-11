import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cookieStore, prisma } = vi.hoisted(() => {
  const cookieStore = {
    get: vi.fn(),
    set: vi.fn(),
  }
  const prisma = {
    course: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    courseEnrollment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  }
  return { cookieStore, prisma }
})

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}))
vi.mock('@/lib/courses/ensure-courses', () => ({
  ensureCourses: vi.fn(async () => ({ informaticaId: 'inf-1', eletricaId: 'ele-1' })),
}))

import {
  allocateUniqueCourseSlug,
  assertAdminTypingExerciseAccess,
  assertStudentEnrolled,
  assertTypingExerciseAccess,
  COURSE_COOKIE,
  getCourseById,
  getDefaultCourse,
  isStudentEnrolledInCourseSlug,
  listActiveCourses,
  listCoursesForAdmin,
  listStudentCourseIds,
  listStudentCourses,
  requestCourseEnrollment,
  resolveAdminCourse,
  resolveAdminCourseId,
  resolveStudentCourseId,
  setStudentCourseCookie,
  slugifyCourseName,
  STUDENT_COURSE_COOKIE,
} from './index'

const course = {
  id: 'inf-1',
  slug: 'informatica-basica',
  name: 'Informática Básica',
  description: null,
  hours: 40,
  active: true,
}

describe('slugifyCourseName', () => {
  it('gera slug seguro', () => {
    expect(slugifyCourseName('Informática Básica!!!')).toBe('informatica-basica')
    expect(slugifyCourseName('---')).toBe('')
    expect(slugifyCourseName('a'.repeat(80)).length).toBeLessThanOrEqual(64)
    // atinge o break após hífen no limite de 64
    expect(slugifyCourseName(`${'a'.repeat(63)}!!b`).length).toBeLessThanOrEqual(64)
  })
})


describe('course queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista cursos ativos e admin', async () => {
    prisma.course.findMany.mockResolvedValue([course])
    expect(await listActiveCourses()).toEqual([course])
    await listCoursesForAdmin('only')
    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: false } })
    )
    await listCoursesForAdmin('include')
    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
    await listCoursesForAdmin()
    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } })
    )
  })

  it('getCourseById / getDefaultCourse', async () => {
    prisma.course.findFirst.mockResolvedValueOnce(course)
    expect(await getCourseById('inf-1')).toEqual(course)

    prisma.course.findFirst.mockResolvedValueOnce({ ...course, active: false })
    expect(await getCourseById('inf-1', { includeInactive: true })).toBeTruthy()

    prisma.course.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(course)
    expect(await getDefaultCourse()).toEqual(course)

    prisma.course.findFirst.mockResolvedValueOnce(course)
    expect(await getDefaultCourse()).toEqual(course)

    prisma.course.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    await expect(getDefaultCourse()).rejects.toThrow(/Nenhum curso ativo/)
  })

  it('allocateUniqueCourseSlug', async () => {
    prisma.course.findUnique
      .mockResolvedValueOnce({ id: '1' })
      .mockResolvedValueOnce(null)
    expect(await allocateUniqueCourseSlug('Curso')).toBe('curso-2')

    prisma.course.findUnique.mockResolvedValueOnce(null)
    expect(await allocateUniqueCourseSlug('!!!')).toBe('curso')

    prisma.course.findUnique.mockImplementation(async () => ({ id: 'x' }))
    const forced = await allocateUniqueCourseSlug('Curso')
    expect(forced.startsWith('curso-')).toBe(true)
  })
})


describe('resolve admin/student course', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieStore.get.mockReturnValue(undefined)
  })

  it('resolveAdminCourse usa explicit, cookie e default', async () => {
    prisma.course.findFirst.mockResolvedValueOnce(course)
    expect(await resolveAdminCourseId('inf-1')).toBe('inf-1')

    prisma.course.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(course)
    cookieStore.get.mockReturnValueOnce({ value: 'inf-1' })
    expect((await resolveAdminCourse()).id).toBe('inf-1')

    prisma.course.findFirst.mockResolvedValue(course)
    expect((await resolveAdminCourse('missing')).slug).toBe('informatica-basica')
  })

  it('resolveAdminCourse ignora cookies fora de request', async () => {
    const { cookies } = await import('next/headers')
    vi.mocked(cookies).mockRejectedValueOnce(new Error('no request'))
    prisma.course.findFirst.mockResolvedValue(course)
    expect((await resolveAdminCourse()).id).toBe('inf-1')

    vi.mocked(cookies).mockResolvedValueOnce(cookieStore as never)
    cookieStore.get.mockReturnValueOnce({ value: 'ghost' })
    prisma.course.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(course)
    expect((await resolveAdminCourse()).id).toBe('inf-1')
  })


  it('listas e asserts de matrícula', async () => {
    prisma.courseEnrollment.findMany.mockResolvedValueOnce([
      { course_id: 'inf-1' },
    ])
    expect(await listStudentCourseIds('s1')).toEqual(['inf-1'])

    prisma.course.findMany.mockResolvedValueOnce([course])
    expect(await listStudentCourses('s1')).toEqual([course])

    prisma.courseEnrollment.findUnique.mockResolvedValueOnce({ status: 'ACTIVE' })
    await assertStudentEnrolled('s1', 'inf-1')

    prisma.courseEnrollment.findUnique.mockResolvedValueOnce({ status: 'PENDING' })
    await expect(assertStudentEnrolled('s1', 'inf-1')).rejects.toMatchObject({
      status: 403,
    })

    prisma.courseEnrollment.findFirst.mockResolvedValueOnce({ id: 'e1' })
    expect(await isStudentEnrolledInCourseSlug('s1', 'informatica-basica')).toBe(true)

    prisma.courseEnrollment.findFirst.mockResolvedValueOnce(null)
    await expect(assertTypingExerciseAccess('s1')).rejects.toMatchObject({
      status: 403,
    })

    prisma.course.findFirst.mockResolvedValueOnce({
      ...course,
      slug: 'eletrica-basica',
      name: 'Elétrica',
    })
    await expect(assertAdminTypingExerciseAccess()).rejects.toMatchObject({
      status: 403,
    })

    prisma.course.findFirst.mockResolvedValueOnce(course)
    await assertAdminTypingExerciseAccess()
  })

  it('resolveStudentCourseId', async () => {
    prisma.courseEnrollment.findMany.mockResolvedValueOnce([])
    await expect(resolveStudentCourseId('s1')).rejects.toMatchObject({ status: 403 })

    prisma.courseEnrollment.findMany.mockResolvedValue([
      { course_id: 'inf-1' },
      { course_id: 'ele-1' },
    ])
    expect(await resolveStudentCourseId('s1', 'ele-1')).toBe('ele-1')

    cookieStore.get.mockReturnValueOnce({ value: 'inf-1' })
    expect(await resolveStudentCourseId('s1')).toBe('inf-1')

    const { cookies } = await import('next/headers')
    vi.mocked(cookies).mockRejectedValueOnce(new Error('no request'))
    expect(await resolveStudentCourseId('s1')).toBe('inf-1')
  })

  it('requestCourseEnrollment', async () => {
    prisma.course.findFirst.mockResolvedValueOnce(null)
    await expect(requestCourseEnrollment('s1', 'x')).rejects.toMatchObject({
      status: 400,
    })

    prisma.course.findFirst.mockResolvedValue({ id: 'inf-1' })
    prisma.courseEnrollment.findUnique.mockResolvedValueOnce({
      id: 'e1',
      status: 'ACTIVE',
    })
    expect(await requestCourseEnrollment('s1', 'inf-1')).toEqual({
      status: 'ACTIVE',
      created: false,
    })

    prisma.courseEnrollment.findUnique.mockResolvedValueOnce({
      id: 'e1',
      status: 'PENDING',
    })
    expect(await requestCourseEnrollment('s1', 'inf-1')).toEqual({
      status: 'PENDING',
      created: false,
    })

    prisma.courseEnrollment.findUnique.mockResolvedValueOnce({
      id: 'e1',
      status: 'REJECTED',
    })
    expect(await requestCourseEnrollment('s1', 'inf-1')).toEqual({
      status: 'PENDING',
      created: false,
    })
    expect(prisma.courseEnrollment.update).toHaveBeenCalled()

    prisma.courseEnrollment.findUnique.mockResolvedValueOnce(null)
    expect(await requestCourseEnrollment('s1', 'inf-1')).toEqual({
      status: 'PENDING',
      created: true,
    })
    expect(prisma.courseEnrollment.create).toHaveBeenCalled()
  })

  it('setStudentCourseCookie', async () => {
    await setStudentCourseCookie('inf-1')
    expect(cookieStore.set).toHaveBeenCalledWith(
      STUDENT_COURSE_COOKIE,
      'inf-1',
      expect.objectContaining({ path: '/' })
    )
    expect(COURSE_COOKIE).toBeTruthy()
  })
})

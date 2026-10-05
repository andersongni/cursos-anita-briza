import { INFORMATICA_COURSE_SLUG } from '@/lib/courses/constants'

/**
 * Fonte única de features por curso.
 * Nav, hubs e APIs devem consultar daqui — nunca hardcodar por página.
 */
export const COURSE_FEATURES = {
  typing_exercise: {
    id: 'typing_exercise',
    label: 'Prática de digitação',
    /** Slugs que oferecem este exercício (aluno e admin). */
    courseSlugs: [INFORMATICA_COURSE_SLUG] as readonly string[],
  },
} as const

export type CourseFeatureId = keyof typeof COURSE_FEATURES

/** Features que compõem o menu/hub "Exercícios". */
export const EXERCISE_FEATURE_IDS: readonly CourseFeatureId[] = ['typing_exercise']

export function courseHasFeature(
  slug: string | null | undefined,
  feature: CourseFeatureId
): boolean {
  if (!slug) return false
  return COURSE_FEATURES[feature].courseSlugs.includes(slug)
}

export function listCourseFeatures(slug: string | null | undefined): CourseFeatureId[] {
  if (!slug) return []
  return (Object.keys(COURSE_FEATURES) as CourseFeatureId[]).filter((id) =>
    courseHasFeature(slug, id)
  )
}

/** Há algum exercício prático (digitação etc.) neste curso. */
export function courseHasStudentExercises(slug: string | null | undefined): boolean {
  return EXERCISE_FEATURE_IDS.some((id) => courseHasFeature(slug, id))
}

export function courseHasTypingExercise(slug: string | null | undefined): boolean {
  return courseHasFeature(slug, 'typing_exercise')
}

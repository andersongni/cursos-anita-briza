import { describe, expect, it } from 'vitest'
import {
  courseHasFeature,
  courseHasStudentExercises,
  courseHasTypingExercise,
  listCourseFeatures,
} from './capabilities'
import { DEFAULT_COURSES, ELETRICA_DIMENSIONS, INFORMATICA_COURSE_SLUG } from './constants'

describe('course capabilities', () => {
  it('detecta digitação só em informática', () => {
    expect(courseHasTypingExercise(INFORMATICA_COURSE_SLUG)).toBe(true)
    expect(courseHasTypingExercise('eletrica-basica')).toBe(false)
    expect(courseHasTypingExercise('')).toBe(false)
    expect(courseHasFeature('eletrica-basica', 'typing_exercise')).toBe(false)
    expect(courseHasFeature(null, 'typing_exercise')).toBe(false)
    expect(courseHasFeature(undefined, 'typing_exercise')).toBe(false)
    expect(courseHasStudentExercises(INFORMATICA_COURSE_SLUG)).toBe(true)
    expect(courseHasStudentExercises('eletrica-basica')).toBe(false)
    expect(courseHasStudentExercises(undefined)).toBe(false)
    expect(courseHasStudentExercises('')).toBe(false)
    expect(listCourseFeatures(INFORMATICA_COURSE_SLUG)).toEqual(['typing_exercise'])
    expect(listCourseFeatures('eletrica-basica')).toEqual([])
    expect(listCourseFeatures(null)).toEqual([])
    expect(listCourseFeatures(undefined)).toEqual([])
  })


  it('exporta constantes de cursos', () => {
    expect(DEFAULT_COURSES.length).toBe(2)
    expect(ELETRICA_DIMENSIONS.length).toBe(5)
  })
})

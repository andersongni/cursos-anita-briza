/** Filtro Prisma: alunos não excluídos logicamente. */
export const notDeleted = { deleted_at: null } as const

/** Avaliações/certificados só de alunos ativos (não soft-deleted). */
export const ofActiveStudent = { student: notDeleted } as const

export function isProfileDeleted(profile: { deleted_at?: Date | string | null }): boolean {
  return profile.deleted_at != null
}

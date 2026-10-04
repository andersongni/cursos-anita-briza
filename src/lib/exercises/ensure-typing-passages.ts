import { prisma } from '@/lib/db'
import { DEFAULT_TYPING_PASSAGES } from '@/lib/exercises/default-typing-passages'

export type TypingSeedResult = {
  created: number
  reactivated: number
  skipped: number
  total: number
}

/**
 * Garante os textos padrão no banco.
 * - `force`: também reativa textos padrão inativos (não sobrescreve conteúdo editado).
 */
export async function ensureTypingPassagesSeeded(
  options: { force?: boolean } = {}
): Promise<TypingSeedResult> {
  let created = 0
  let reactivated = 0
  let skipped = 0

  for (const passage of DEFAULT_TYPING_PASSAGES) {
    const existing = await prisma.typingPassage.findFirst({
      where: { title: passage.title },
      select: { id: true, active: true },
    })

    if (!existing) {
      await prisma.typingPassage.create({
        data: {
          title: passage.title,
          content: passage.content,
          active: true,
        },
      })
      created++
      continue
    }

    if (options.force && !existing.active) {
      await prisma.typingPassage.update({
        where: { id: existing.id },
        data: { active: true },
      })
      reactivated++
      continue
    }

    skipped++
  }

  const total = await prisma.typingPassage.count()
  return { created, reactivated, skipped, total }
}

/**
 * Migrações aditivas aplicadas automaticamente no deploy (Vercel build)
 * e no boot do servidor (instrumentation / ensure-schema).
 *
 * REGRA: sempre que alterar `prisma/schema.prisma` com coluna/tabela nova,
 * adicione aqui o SQL equivalente (idempotente — “already exists” é ok).
 *
 * Só use ALTER/CREATE aditivos. Nunca DROP aqui.
 */
export type SchemaMigration = {
  /** Identificador estável para logs */
  id: string
  sql: string
}

export const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  {
    id: '2026-04-03_profile_deleted_at',
    sql: 'ALTER TABLE Profile ADD COLUMN deleted_at DATETIME',
  },
]

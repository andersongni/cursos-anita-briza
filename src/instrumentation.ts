export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { ensureSchemaColumns } = await import('@/lib/ensure-schema')
    const result = await ensureSchemaColumns()
    if (result.applied.length > 0) {
      console.info('[schema] applied:', result.applied.join(' | '))
    }
  } catch (err) {
    console.error('[schema] ensure failed:', err instanceof Error ? err.message : err)
  }
}

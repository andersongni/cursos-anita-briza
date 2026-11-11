import { promises as fs } from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/db'

export const UPLOAD_SETTING_PREFIX = 'platform.upload.'

export type StoredUpload = {
  mime: string
  dataBase64: string
}

function uploadsDir() {
  return path.join(process.cwd(), 'public', 'uploads')
}

export function uploadSettingKey(filename: string): string {
  return `${UPLOAD_SETTING_PREFIX}${filename}`
}

export function sanitizeUploadFilename(filename: string): string | null {
  const base = path.basename(filename).trim()
  if (!base || base !== filename.replace(/^.*[/\\]/, '')) return null
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null
  if (base.includes('..')) return null
  return base
}

export function publicUploadUrl(filename: string, opts?: { api?: boolean }): string {
  const bust = `?v=${Date.now()}`
  if (opts?.api) return `/api/uploads/${filename}${bust}`
  return `/uploads/${filename}${bust}`
}

export function filenameFromUploadUrl(url: string): string | null {
  const cleaned = url.split('?')[0].split('#')[0]
  const match = cleaned.match(/\/(?:api\/)?uploads\/([^/]+)$/)
  return match?.[1] ? sanitizeUploadFilename(match[1]) : null
}

let writeProbe: boolean | null = null

/** Em Vercel/serverless o FS de deploy é somente leitura. */
export async function canWriteUploadsDir(): Promise<boolean> {
  if (process.env.VERCEL === '1') return false
  if (writeProbe != null) return writeProbe
  try {
    const dir = uploadsDir()
    await fs.mkdir(dir, { recursive: true })
    const probe = path.join(dir, `.write-probe-${process.pid}`)
    await fs.writeFile(probe, 'ok')
    await fs.unlink(probe)
    writeProbe = true
  } catch {
    writeProbe = false
  }
  return writeProbe
}

export async function saveUploadToDb(
  filename: string,
  buffer: Buffer,
  mime: string
): Promise<void> {
  const safe = sanitizeUploadFilename(filename)
  if (!safe) throw new Error('Nome de arquivo inválido')
  const payload: StoredUpload = {
    mime: mime || 'application/octet-stream',
    dataBase64: buffer.toString('base64'),
  }
  const key = uploadSettingKey(safe)
  await prisma.systemSetting.upsert({
    where: { key },
    update: {
      value: JSON.stringify(payload),
      description: `Upload persistido (serverless): ${safe}`,
    },
    create: {
      key,
      value: JSON.stringify(payload),
      description: `Upload persistido (serverless): ${safe}`,
    },
  })
}

export async function deleteUploadFromDb(filename: string): Promise<void> {
  const safe = sanitizeUploadFilename(filename)
  if (!safe) return
  await prisma.systemSetting.deleteMany({ where: { key: uploadSettingKey(safe) } })
}

export async function readUploadFromDb(filename: string): Promise<StoredUpload | null> {
  const safe = sanitizeUploadFilename(filename)
  if (!safe) return null
  const row = await prisma.systemSetting.findUnique({
    where: { key: uploadSettingKey(safe) },
    select: { value: true },
  })
  if (!row?.value) return null
  try {
    const parsed = JSON.parse(row.value) as Partial<StoredUpload>
    if (typeof parsed.dataBase64 !== 'string' || !parsed.dataBase64) return null
    return {
      mime: typeof parsed.mime === 'string' ? parsed.mime : 'application/octet-stream',
      dataBase64: parsed.dataBase64,
    }
  } catch {
    return null
  }
}

/**
 * Grava em `public/uploads` quando possível; no Vercel persiste no banco
 * e devolve URL `/api/uploads/...`.
 */
export async function persistUpload(input: {
  filename: string
  buffer: Buffer
  mime: string
}): Promise<{ url: string; storage: 'disk' | 'database' }> {
  const safe = sanitizeUploadFilename(input.filename)
  if (!safe) throw new Error('Nome de arquivo inválido')
  if (input.buffer.byteLength <= 0) throw new Error('Arquivo vazio')

  if (await canWriteUploadsDir()) {
    const absolute = path.join(uploadsDir(), safe)
    await fs.writeFile(absolute, input.buffer)
    // Espelha no DB para export em qualquer ambiente
    await saveUploadToDb(safe, input.buffer, input.mime).catch(() => undefined)
    return { url: publicUploadUrl(safe), storage: 'disk' }
  }

  await saveUploadToDb(safe, input.buffer, input.mime)
  return { url: publicUploadUrl(safe, { api: true }), storage: 'database' }
}

export async function clearUploadsByPrefix(prefix: string): Promise<void> {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9._-]/g, '')
  if (!safePrefix) return

  if (await canWriteUploadsDir()) {
    try {
      const dir = uploadsDir()
      const files = await fs.readdir(dir)
      await Promise.all(
        files
          .filter((f) => f.startsWith(safePrefix))
          .map((f) => fs.unlink(path.join(dir, f)).catch(() => undefined))
      )
    } catch {
      // pasta inexistente
    }
  }

  const rows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: UPLOAD_SETTING_PREFIX + safePrefix } },
    select: { key: true },
  })
  if (rows.length > 0) {
    await prisma.systemSetting.deleteMany({
      where: { key: { in: rows.map((r) => r.key) } },
    })
  }
}

export async function loadUploadBytes(
  urlOrPath: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  const raw = urlOrPath.trim()
  if (!raw) return null

  if (raw.startsWith('data:image/')) {
    const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
    if (!match) return null
    return { buffer: Buffer.from(match[2], 'base64'), mime: match[1] }
  }

  const filename = filenameFromUploadUrl(raw)
  if (filename) {
    const absolute = path.join(uploadsDir(), filename)
    try {
      const buffer = await fs.readFile(absolute)
      const ext = path.extname(filename).toLowerCase()
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
              ? 'image/gif'
              : 'image/jpeg'
      return { buffer, mime }
    } catch {
      const fromDb = await readUploadFromDb(filename)
      if (!fromDb) return null
      return {
        buffer: Buffer.from(fromDb.dataBase64, 'base64'),
        mime: fromDb.mime,
      }
    }
  }

  // Arquivo estático em /public (ex.: /certificate-template.jpg, /logo.png)
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    const cleaned = raw.split('?')[0].replace(/^\//, '')
    if (!cleaned || cleaned.includes('..')) return null
    const absolute = path.join(process.cwd(), 'public', cleaned)
    try {
      const buffer = await fs.readFile(absolute)
      const ext = path.extname(absolute).toLowerCase()
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
              ? 'image/gif'
              : 'image/jpeg'
      return { buffer, mime }
    } catch {
      return null
    }
  }

  if (raw.startsWith('https://') || raw.startsWith('http://')) {
    try {
      const res = await fetch(raw, { cache: 'no-store' })
      if (!res.ok) return null
      const mime = res.headers.get('content-type') || 'image/jpeg'
      const buffer = Buffer.from(await res.arrayBuffer())
      return { buffer, mime }
    } catch {
      return null
    }
  }

  return null
}

export async function loadUploadAsDataUrl(
  urlOrPath: string
): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG' } | null> {
  const loaded = await loadUploadBytes(urlOrPath)
  if (!loaded) return null
  const format: 'JPEG' | 'PNG' = loaded.mime.includes('png') ? 'PNG' : 'JPEG'
  const mime = format === 'PNG' ? 'image/png' : loaded.mime.startsWith('image/') ? loaded.mime : 'image/jpeg'
  return {
    dataUrl: `data:${mime};base64,${loaded.buffer.toString('base64')}`,
    format,
  }
}

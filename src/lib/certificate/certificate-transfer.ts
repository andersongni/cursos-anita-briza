import {
  normalizeCertificateLayout,
  type CertificateLayout,
} from '@/lib/certificate/layout'
import {
  normalizeEditableVariables,
  type CertificateEditableVariable,
} from '@/lib/certificate/variables'

export const CERTIFICATE_TRANSFER_KIND = 'cursos-anita-briza.certificate-template' as const
export const CERTIFICATE_TRANSFER_VERSION = 1 as const

export type CertificateTransferAsset = {
  mime: string
  dataBase64: string
}

export type CertificateTransferFile = {
  kind: typeof CERTIFICATE_TRANSFER_KIND
  version: typeof CERTIFICATE_TRANSFER_VERSION
  exportedAt: string
  layout: CertificateLayout
  editableVariables: CertificateEditableVariable[]
  /** Imagens locais (`/uploads/...`) embutidas para portabilidade. */
  assets: Record<string, CertificateTransferAsset>
}

/** Remove query/hash de um caminho de asset. */
export function assetPathOnly(url: string): string {
  const q = url.indexOf('?')
  const h = url.indexOf('#')
  let end = url.length
  if (q >= 0) end = Math.min(end, q)
  if (h >= 0) end = Math.min(end, h)
  return url.slice(0, end)
}

/** Caminhos `/uploads/...` ou `/api/uploads/...` que precisam ser embutidos no export. */
export function isUploadAssetPath(url: string): boolean {
  const path = assetPathOnly(url)
  if (path.includes('..')) return false
  return path.startsWith('/uploads/') || path.startsWith('/api/uploads/')
}

export function collectLayoutAssetPaths(layout: CertificateLayout): string[] {
  const paths = new Set<string>()
  if (isUploadAssetPath(layout.backgroundUrl)) {
    paths.add(assetPathOnly(layout.backgroundUrl))
  }
  for (const el of layout.elements) {
    if (el.type === 'image' && isUploadAssetPath(el.imageUrl)) {
      paths.add(assetPathOnly(el.imageUrl))
    }
  }
  return Array.from(paths)
}

export function stripLayoutAssetQueries(layout: CertificateLayout): CertificateLayout {
  return {
    ...layout,
    backgroundUrl: assetPathOnly(layout.backgroundUrl) || layout.backgroundUrl,
    elements: layout.elements.map((el) =>
      el.type === 'image' && el.imageUrl
        ? { ...el, imageUrl: assetPathOnly(el.imageUrl) || el.imageUrl }
        : el
    ),
  }
}

export function isCertificateTransferFile(
  value: unknown
): value is CertificateTransferFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Record<string, unknown>
  return (
    file.kind === CERTIFICATE_TRANSFER_KIND &&
    file.version === CERTIFICATE_TRANSFER_VERSION &&
    file.layout != null &&
    typeof file.layout === 'object' &&
    Array.isArray(file.editableVariables) &&
    (file.assets == null || typeof file.assets === 'object')
  )
}

export function validateCertificateTransferFile(
  value: unknown
):
  | { ok: true; file: CertificateTransferFile }
  | { ok: false; error: string } {
  if (!isCertificateTransferFile(value)) {
    return {
      ok: false,
      error:
        'Arquivo inválido. Use um JSON exportado por esta plataforma (kind/version corretos).',
    }
  }

  const layout = normalizeCertificateLayout(value.layout)
  const editableVariables = normalizeEditableVariables(
    value.editableVariables,
    [],
    { allowEmpty: true }
  )

  const assets: Record<string, CertificateTransferAsset> = {}
  const rawAssets =
    value.assets && typeof value.assets === 'object'
      ? (value.assets as Record<string, unknown>)
      : {}

  for (const [key, raw] of Object.entries(rawAssets)) {
    const path = assetPathOnly(key)
    if (!isUploadAssetPath(path)) continue
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: `Asset inválido: ${path}` }
    }
    const asset = raw as Partial<CertificateTransferAsset>
    if (typeof asset.mime !== 'string' || !asset.mime.startsWith('image/')) {
      return { ok: false, error: `MIME inválido no asset ${path}` }
    }
    if (typeof asset.dataBase64 !== 'string' || !asset.dataBase64.trim()) {
      return { ok: false, error: `Dados ausentes no asset ${path}` }
    }
    // Limite prático (~12 MB em base64) para evitar payloads abusivos
    if (asset.dataBase64.length > 16_000_000) {
      return { ok: false, error: `Asset muito grande: ${path}` }
    }
    assets[path] = {
      mime: asset.mime.trim(),
      dataBase64: asset.dataBase64.trim(),
    }
  }

  return {
    ok: true,
    file: {
      kind: CERTIFICATE_TRANSFER_KIND,
      version: CERTIFICATE_TRANSFER_VERSION,
      exportedAt:
        typeof value.exportedAt === 'string' && value.exportedAt
          ? value.exportedAt
          : new Date().toISOString(),
      layout: stripLayoutAssetQueries(layout),
      editableVariables,
      assets,
    },
  }
}

export function mimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.jpg':
    case '.jpeg':
    default:
      return 'image/jpeg'
  }
}

export function extFromMime(mime: string): '.jpg' | '.png' | '.webp' | '.gif' {
  if (mime.includes('png')) return '.png'
  if (mime.includes('webp')) return '.webp'
  if (mime.includes('gif')) return '.gif'
  return '.jpg'
}

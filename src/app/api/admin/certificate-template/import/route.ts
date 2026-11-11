import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  assetPathOnly,
  collectLayoutAssetPaths,
  extFromMime,
  isUploadAssetPath,
  validateCertificateTransferFile,
} from '@/lib/certificate/certificate-transfer'
import {
  CERTIFICATE_BACKGROUND_KEY,
  CERTIFICATE_LAYOUT_KEY,
  type CertificateLayout,
} from '@/lib/certificate/layout'
import { saveCertificateEditableVariables } from '@/lib/certificate/settings'
import {
  clearUploadsByPrefix,
  persistUpload,
} from '@/lib/platform/persist-upload'

export const runtime = 'nodejs'

async function upsertSetting(
  key: string,
  value: unknown,
  userId: string,
  description?: string
) {
  const stringified = JSON.stringify(value)
  await prisma.systemSetting.upsert({
    where: { key },
    update: {
      value: stringified,
      updated_by: userId,
      ...(description ? { description } : {}),
    },
    create: {
      key,
      value: stringified,
      updated_by: userId,
      description: description ?? key,
    },
  })
}

function safeUploadBasename(assetPath: string, mime: string): string {
  const base = assetPathOnly(assetPath).split('/').pop() || 'asset'
  const dot = base.lastIndexOf('.')
  const nameRaw = dot > 0 ? base.slice(0, dot) : base
  const extRaw = dot > 0 ? base.slice(dot) : ''
  const name = nameRaw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'asset'
  const ext = /^\.(jpe?g|png|webp|gif)$/i.test(extRaw)
    ? extRaw.toLowerCase().replace('.jpeg', '.jpg')
    : extFromMime(mime)
  if (name.startsWith('certificate-background')) {
    return `certificate-background${ext}`
  }
  if (name.startsWith('certificate-element')) {
    return `certificate-element-${Date.now()}${ext}`
  }
  return `certificate-import-${Date.now()}-${name}${ext}`
}

export async function POST(req: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 })
    }

    const raw = (body as { file?: unknown }).file ?? body
    const validated = validateCertificateTransferFile(raw)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const { file } = validated
    const remapped = new Map<string, string>()
    const written: string[] = []
    const skippedAssets: string[] = []

    const needed = collectLayoutAssetPaths(file.layout)
    for (const assetPath of needed) {
      const asset = file.assets[assetPath]
      if (!asset) {
        skippedAssets.push(assetPath)
        continue
      }
      let buffer: Buffer
      try {
        buffer = Buffer.from(asset.dataBase64, 'base64')
      } catch {
        return NextResponse.json(
          { error: `Não foi possível decodificar o asset ${assetPath}` },
          { status: 400 }
        )
      }
      if (buffer.byteLength <= 0) {
        skippedAssets.push(assetPath)
        continue
      }

      if (assetPath.includes('certificate-background')) {
        await clearUploadsByPrefix('certificate-background')
      }

      const filename = safeUploadBasename(assetPath, asset.mime)
      const saved = await persistUpload({
        filename,
        buffer,
        mime: asset.mime,
      })
      remapped.set(assetPath, saved.url)
      // Também mapeia variantes /api/uploads/... se o export veio de produção
      const bare = assetPathOnly(assetPath)
      remapped.set(bare, saved.url)
      written.push(saved.url)
    }

    const applyUrl = (url: string) => {
      if (!isUploadAssetPath(url)) return url
      const key = assetPathOnly(url)
      return remapped.get(key) ?? url
    }

    const layout: CertificateLayout = {
      ...file.layout,
      backgroundUrl: applyUrl(file.layout.backgroundUrl),
      elements: file.layout.elements.map((el) =>
        el.type === 'image' ? { ...el, imageUrl: applyUrl(el.imageUrl) } : el
      ),
    }

    await upsertSetting(
      CERTIFICATE_LAYOUT_KEY,
      layout,
      user.id,
      'Layout visual do certificado (posições e textos)'
    )
    await upsertSetting(
      CERTIFICATE_BACKGROUND_KEY,
      layout.backgroundUrl,
      user.id,
      'Imagem de fundo do certificado'
    )

    const variables = await saveCertificateEditableVariables(
      user.id,
      file.editableVariables
    )

    return NextResponse.json({
      success: true,
      layout,
      editableVariables: variables,
      writtenAssets: written.length,
      skippedAssets,
    })
  } catch (error: unknown) {
    console.error('Error importing certificate template:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao importar modelo do certificado' },
      { status: err.status || 500 }
    )
  }
}

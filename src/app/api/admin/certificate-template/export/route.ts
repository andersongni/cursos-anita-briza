import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  CERTIFICATE_TRANSFER_KIND,
  CERTIFICATE_TRANSFER_VERSION,
  assetPathOnly,
  collectLayoutAssetPaths,
  stripLayoutAssetQueries,
  type CertificateTransferAsset,
  type CertificateTransferFile,
} from '@/lib/certificate/certificate-transfer'
import {
  getCertificateEditableVariables,
  getCertificateLayout,
} from '@/lib/certificate/settings'
import { loadUploadBytes } from '@/lib/platform/persist-upload'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await verifyAdmin()
    const [layout, editableVariables] = await Promise.all([
      getCertificateLayout(),
      getCertificateEditableVariables(),
    ])

    const cleaned = stripLayoutAssetQueries(layout)
    const assetPaths = collectLayoutAssetPaths(cleaned)
    const assets: Record<string, CertificateTransferAsset> = {}
    const missingAssets: string[] = []

    for (const assetPath of assetPaths) {
      const loaded = await loadUploadBytes(assetPath)
      if (!loaded) {
        missingAssets.push(assetPath)
        continue
      }
      // Canonicaliza a chave sem /api para portabilidade entre ambientes
      const key = assetPathOnly(assetPath).replace(/^\/api\/uploads\//, '/uploads/')
      assets[key] = {
        mime: loaded.mime,
        dataBase64: loaded.buffer.toString('base64'),
      }
    }

    // Também reescreve o layout para /uploads/... (import remapeia de qualquer forma)
    const portableLayout = {
      ...cleaned,
      backgroundUrl: cleaned.backgroundUrl.replace(/^\/api\/uploads\//, '/uploads/'),
      elements: cleaned.elements.map((el) =>
        el.type === 'image'
          ? {
              ...el,
              imageUrl: el.imageUrl.replace(/^\/api\/uploads\//, '/uploads/'),
            }
          : el
      ),
    }

    const file: CertificateTransferFile = {
      kind: CERTIFICATE_TRANSFER_KIND,
      version: CERTIFICATE_TRANSFER_VERSION,
      exportedAt: new Date().toISOString(),
      layout: portableLayout,
      editableVariables,
      assets,
    }

    return NextResponse.json({
      file,
      missingAssets,
    })
  } catch (error: unknown) {
    console.error('Error exporting certificate template:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao exportar modelo do certificado' },
      { status: err.status || 500 }
    )
  }
}

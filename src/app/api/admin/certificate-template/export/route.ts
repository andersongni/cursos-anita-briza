import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  CERTIFICATE_TRANSFER_KIND,
  CERTIFICATE_TRANSFER_VERSION,
  collectLayoutAssetPaths,
  mimeFromExt,
  stripLayoutAssetQueries,
  type CertificateTransferAsset,
  type CertificateTransferFile,
} from '@/lib/certificate/certificate-transfer'
import {
  getCertificateEditableVariables,
  getCertificateLayout,
} from '@/lib/certificate/settings'

export const runtime = 'nodejs'

function publicRoot() {
  return path.join(process.cwd(), 'public')
}

async function readUploadAsset(
  assetPath: string
): Promise<CertificateTransferAsset | null> {
  const relative = assetPath.replace(/^\//, '').replace(/\//g, path.sep)
  const root = path.resolve(publicRoot())
  const absolute = path.resolve(root, relative)
  // Garante que o arquivo fica sob public/
  if (absolute !== root && !absolute.startsWith(root + path.sep)) return null
  try {
    const buffer = await fs.readFile(absolute)
    const ext = path.extname(absolute)
    return {
      mime: mimeFromExt(ext),
      dataBase64: buffer.toString('base64'),
    }
  } catch {
    return null
  }
}


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
      const asset = await readUploadAsset(assetPath)
      if (!asset) {
        missingAssets.push(assetPath)
        continue
      }
      assets[assetPath] = asset
    }

    const file: CertificateTransferFile = {
      kind: CERTIFICATE_TRANSFER_KIND,
      version: CERTIFICATE_TRANSFER_VERSION,
      exportedAt: new Date().toISOString(),
      layout: cleaned,
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

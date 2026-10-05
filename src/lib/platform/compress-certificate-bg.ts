import sharp from 'sharp'

export const CERT_BG_TARGET_BYTES = 4 * 1024 * 1024
export const CERT_BG_MAX_UPLOAD_BYTES = 25 * 1024 * 1024
/** A4 paisagem em boa qualidade para impressão/PDF */
export const CERT_BG_MAX_EDGE = 3508

export type CompressedCertBg = {
  buffer: Buffer
  ext: '.jpg' | '.png' | '.webp'
  mime: string
  compressed: boolean
  originalBytes: number
  finalBytes: number
}

export async function compressCertificateBackground(input: Buffer): Promise<CompressedCertBg> {
  const originalBytes = input.byteLength
  const image = sharp(input, { failOn: 'none', animated: false }).rotate()
  const meta = await image.metadata()
  const hasAlpha = Boolean(meta.hasAlpha)

  let width = meta.width ?? CERT_BG_MAX_EDGE
  let height = meta.height ?? CERT_BG_MAX_EDGE

  if (width > CERT_BG_MAX_EDGE || height > CERT_BG_MAX_EDGE) {
    if (width >= height) {
      height = Math.round((height * CERT_BG_MAX_EDGE) / width)
      width = CERT_BG_MAX_EDGE
    } else {
      width = Math.round((width * CERT_BG_MAX_EDGE) / height)
      height = CERT_BG_MAX_EDGE
    }
  }

  const resize = { width, height, fit: 'inside' as const, withoutEnlargement: true }

  if (hasAlpha) {
    let quality = 90
    let buffer = await sharp(input, { failOn: 'none', animated: false })
      .rotate()
      .resize(resize)
      .png({ compressionLevel: 9 })
      .toBuffer()

    if (buffer.byteLength > CERT_BG_TARGET_BYTES) {
      buffer = await sharp(input, { failOn: 'none', animated: false })
        .rotate()
        .resize(resize)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer()
      while (buffer.byteLength > CERT_BG_TARGET_BYTES && quality > 45) {
        quality -= 10
        buffer = await sharp(input, { failOn: 'none', animated: false })
          .rotate()
          .resize(resize)
          .jpeg({ quality, mozjpeg: true })
          .toBuffer()
      }
      return {
        buffer,
        ext: '.jpg',
        mime: 'image/jpeg',
        compressed: true,
        originalBytes,
        finalBytes: buffer.byteLength,
      }
    }

    return {
      buffer,
      ext: '.png',
      mime: 'image/png',
      compressed: buffer.byteLength < originalBytes,
      originalBytes,
      finalBytes: buffer.byteLength,
    }
  }

  let quality = 88
  let buffer = await sharp(input, { failOn: 'none', animated: false })
    .rotate()
    .resize(resize)
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()

  while (buffer.byteLength > CERT_BG_TARGET_BYTES && quality > 45) {
    quality -= 8
    buffer = await sharp(input, { failOn: 'none', animated: false })
      .rotate()
      .resize(resize)
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()
  }

  return {
    buffer,
    ext: '.jpg',
    mime: 'image/jpeg',
    compressed: buffer.byteLength < originalBytes || quality < 88,
    originalBytes,
    finalBytes: buffer.byteLength,
  }
}

import sharp from 'sharp'

export const LOGO_TARGET_BYTES = 2 * 1024 * 1024
/** Limite absoluto do arquivo original (antes da compressão) */
export const LOGO_MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const LOGO_MAX_EDGE = 1024

export type CompressedLogo = {
  buffer: Buffer
  ext: '.jpg' | '.png' | '.webp'
  mime: string
  compressed: boolean
  originalBytes: number
  finalBytes: number
}

/**
 * Redimensiona e reduz qualidade até caber em LOGO_TARGET_BYTES.
 * Saída preferencial: JPEG (menor); PNG se precisar de transparência e couber.
 */
export async function compressLogoImage(input: Buffer): Promise<CompressedLogo> {
  const originalBytes = input.byteLength
  const image = sharp(input, { failOn: 'none', animated: false }).rotate()
  const meta = await image.metadata()

  const hasAlpha = Boolean(meta.hasAlpha)
  let width = meta.width ?? LOGO_MAX_EDGE
  let height = meta.height ?? LOGO_MAX_EDGE

  if (width > LOGO_MAX_EDGE || height > LOGO_MAX_EDGE) {
    if (width >= height) {
      height = Math.round((height * LOGO_MAX_EDGE) / width)
      width = LOGO_MAX_EDGE
    } else {
      width = Math.round((width * LOGO_MAX_EDGE) / height)
      height = LOGO_MAX_EDGE
    }
  }

  // Se já cabe e não precisa redimensionar, mantém (reencode leve só se > target)
  if (originalBytes <= LOGO_TARGET_BYTES && (meta.width ?? 0) <= LOGO_MAX_EDGE && (meta.height ?? 0) <= LOGO_MAX_EDGE) {
    const format = meta.format
    if (format === 'jpeg' || format === 'jpg') {
      return {
        buffer: input,
        ext: '.jpg',
        mime: 'image/jpeg',
        compressed: false,
        originalBytes,
        finalBytes: originalBytes,
      }
    }
    if (format === 'png') {
      return {
        buffer: input,
        ext: '.png',
        mime: 'image/png',
        compressed: false,
        originalBytes,
        finalBytes: originalBytes,
      }
    }
    if (format === 'webp') {
      return {
        buffer: input,
        ext: '.webp',
        mime: 'image/webp',
        compressed: false,
        originalBytes,
        finalBytes: originalBytes,
      }
    }
  }

  const tryEncode = async (
    edge: number,
    quality: number,
    preferPng: boolean
  ): Promise<{ buffer: Buffer; ext: CompressedLogo['ext']; mime: string } | null> => {
    let pipeline = sharp(input, { failOn: 'none', animated: false }).rotate()
    pipeline = pipeline.resize({
      width: edge,
      height: edge,
      fit: 'inside',
      withoutEnlargement: true,
    })

    if (preferPng && hasAlpha) {
      const buffer = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
      return { buffer, ext: '.png', mime: 'image/png' }
    }

    const buffer = await pipeline
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
      .toBuffer()
    return { buffer, ext: '.jpg', mime: 'image/jpeg' }
  }

  let edge = Math.max(width, height, 256)
  edge = Math.min(edge, LOGO_MAX_EDGE)
  let quality = 85
  let best: CompressedLogo | null = null

  // Primeiro tenta PNG com transparência se couber
  if (hasAlpha) {
    const pngTry = await tryEncode(edge, quality, true)
    if (pngTry && pngTry.buffer.byteLength <= LOGO_TARGET_BYTES) {
      return {
        ...pngTry,
        compressed: true,
        originalBytes,
        finalBytes: pngTry.buffer.byteLength,
      }
    }
  }

  for (let round = 0; round < 12; round++) {
    const encoded = await tryEncode(edge, quality, false)
    if (!encoded) break

    best = {
      ...encoded,
      compressed: true,
      originalBytes,
      finalBytes: encoded.buffer.byteLength,
    }

    if (encoded.buffer.byteLength <= LOGO_TARGET_BYTES) {
      return best
    }

    if (quality > 45) {
      quality -= 10
    } else {
      edge = Math.max(256, Math.round(edge * 0.75))
      quality = 75
    }
  }

  if (best && best.buffer.byteLength <= LOGO_TARGET_BYTES) {
    return best
  }

  // Última tentativa bem agressiva
  const last = await tryEncode(256, 40, false)
  if (!last) {
    throw new Error('Não foi possível comprimir a imagem.')
  }

  if (last.buffer.byteLength > LOGO_TARGET_BYTES) {
    throw new Error(
      'Não foi possível reduzir a imagem para menos de 2 MB. Tente outra imagem.'
    )
  }

  return {
    ...last,
    compressed: true,
    originalBytes,
    finalBytes: last.buffer.byteLength,
  }
}

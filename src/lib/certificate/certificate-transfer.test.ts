import { describe, expect, it } from 'vitest'
import { createDefaultCertificateLayout } from './layout'
import { createDefaultEditableVariables } from './variables'
import {
  CERTIFICATE_TRANSFER_KIND,
  CERTIFICATE_TRANSFER_VERSION,
  assetPathOnly,
  collectLayoutAssetPaths,
  extFromMime,
  isCertificateTransferFile,
  isUploadAssetPath,
  mimeFromExt,
  stripLayoutAssetQueries,
  validateCertificateTransferFile,
} from './certificate-transfer'

describe('certificate-transfer', () => {
  it('detecta paths de upload', () => {
    expect(assetPathOnly('/uploads/a.png?v=1#x')).toBe('/uploads/a.png')
    expect(isUploadAssetPath('/uploads/a.png?v=1')).toBe(true)
    expect(isUploadAssetPath('/certificate-template.jpg')).toBe(false)
    expect(isUploadAssetPath('/uploads/../etc/passwd')).toBe(false)
  })

  it('coleta e limpa assets do layout', () => {
    const layout = createDefaultCertificateLayout()
    layout.backgroundUrl = '/uploads/certificate-background.jpg?v=9'
    layout.elements.push({
      ...layout.elements[0],
      id: 'img_x',
      type: 'image',
      imageUrl: '/uploads/certificate-element-1.png?v=2',
    })
    expect(collectLayoutAssetPaths(layout)).toEqual([
      '/uploads/certificate-background.jpg',
      '/uploads/certificate-element-1.png',
    ])
    const stripped = stripLayoutAssetQueries(layout)
    expect(stripped.backgroundUrl).toBe('/uploads/certificate-background.jpg')
  })

  it('valida arquivo de transferência', () => {
    expect(isCertificateTransferFile(null)).toBe(false)
    const withAssets = validateCertificateTransferFile({
      kind: CERTIFICATE_TRANSFER_KIND,
      version: CERTIFICATE_TRANSFER_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      layout: createDefaultCertificateLayout(),
      editableVariables: createDefaultEditableVariables(),
      assets: {
        '/uploads/bg.jpg': {
          mime: 'image/jpeg',
          dataBase64: Buffer.from('x').toString('base64'),
        },
      },
    })
    expect(withAssets.ok).toBe(true)
    if (withAssets.ok) {
      expect(withAssets.file.exportedAt).toBe('2026-01-01T00:00:00.000Z')
    }

    expect(
      validateCertificateTransferFile({
        kind: CERTIFICATE_TRANSFER_KIND,
        version: CERTIFICATE_TRANSFER_VERSION,
        layout: createDefaultCertificateLayout(),
        editableVariables: createDefaultEditableVariables(),
        assets: null,
      }).ok
    ).toBe(true)


    expect(
      validateCertificateTransferFile({
        kind: 'other',
        version: 1,
        layout: {},
        editableVariables: [],
      }).ok
    ).toBe(false)

    expect(
      validateCertificateTransferFile({
        kind: CERTIFICATE_TRANSFER_KIND,
        version: CERTIFICATE_TRANSFER_VERSION,
        layout: createDefaultCertificateLayout(),
        editableVariables: [],
        assets: {
          '/uploads/bg.jpg': { mime: 'text/plain', dataBase64: 'YQ==' },
        },
      }).ok
    ).toBe(false)

    expect(
      validateCertificateTransferFile({
        kind: CERTIFICATE_TRANSFER_KIND,
        version: CERTIFICATE_TRANSFER_VERSION,
        layout: createDefaultCertificateLayout(),
        editableVariables: [],
        assets: {
          '/uploads/bg.jpg': null,
        },
      }).ok
    ).toBe(false)

    expect(
      validateCertificateTransferFile({
        kind: CERTIFICATE_TRANSFER_KIND,
        version: CERTIFICATE_TRANSFER_VERSION,
        layout: createDefaultCertificateLayout(),
        editableVariables: [],
        assets: {
          '/uploads/bg.jpg': { mime: 'image/jpeg', dataBase64: '   ' },
        },
      }).ok
    ).toBe(false)

    expect(
      validateCertificateTransferFile({
        kind: CERTIFICATE_TRANSFER_KIND,
        version: CERTIFICATE_TRANSFER_VERSION,
        layout: createDefaultCertificateLayout(),
        editableVariables: [],
        assets: {
          '/uploads/bg.jpg': {
            mime: 'image/jpeg',
            dataBase64: 'a'.repeat(16_000_001),
          },
        },
      }).ok
    ).toBe(false)

    // assets fora de /uploads são ignorados; exportedAt ausente gera ISO
    const withoutStamp = validateCertificateTransferFile({
      kind: CERTIFICATE_TRANSFER_KIND,
      version: CERTIFICATE_TRANSFER_VERSION,
      layout: createDefaultCertificateLayout(),
      editableVariables: createDefaultEditableVariables(),
      assets: {
        '/logo.png': { mime: 'image/png', dataBase64: 'YQ==' },
      },
    })
    expect(withoutStamp.ok).toBe(true)
    if (withoutStamp.ok) {
      expect(withoutStamp.file.exportedAt).toMatch(/^\d{4}-/)
      expect(Object.keys(withoutStamp.file.assets)).toHaveLength(0)
    }

    const strippedBg = stripLayoutAssetQueries({
      ...createDefaultCertificateLayout(),
      backgroundUrl: '',
    })
    expect(strippedBg.backgroundUrl).toBe('')
  })


  it('mapeia mime/ext', () => {
    expect(mimeFromExt('.png')).toBe('image/png')
    expect(mimeFromExt('.webp')).toBe('image/webp')
    expect(mimeFromExt('.gif')).toBe('image/gif')
    expect(mimeFromExt('.jpg')).toBe('image/jpeg')
    expect(extFromMime('image/png')).toBe('.png')
    expect(extFromMime('image/webp')).toBe('.webp')
    expect(extFromMime('image/gif')).toBe('.gif')
    expect(extFromMime('image/jpeg')).toBe('.jpg')
  })
})

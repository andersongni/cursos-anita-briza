import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto'

const ALGO = 'aes-256-gcm'
const VERSION = 'v1'
const SCRYPT_SALT = 'anita-briza-settings-v1'

function getEncryptionKey(): Buffer {
  const raw =
    process.env.SETTINGS_ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim()
  if (!raw) {
    throw new Error(
      'Defina JWT_SECRET (ou SETTINGS_ENCRYPTION_KEY) para criptografar segredos.'
    )
  }
  return scryptSync(raw, SCRYPT_SALT, 32)
}

/** Criptografa texto sensível (AES-256-GCM). Formato: v1.iv.tag.ciphertext (base64url). */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Formato de segredo criptografado inválido')
  }
  const [, ivB64, tagB64, dataB64] = parts
  const key = getEncryptionKey()
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(ivB64, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

/** Máscara para UI: mostra só os últimos 4 caracteres. */
export function maskSecret(secret: string): string {
  const trimmed = secret.trim()
  if (trimmed.length <= 4) return '••••'
  return `••••${trimmed.slice(-4)}`
}

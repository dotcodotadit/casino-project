import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { config } from './config.js'

/**
 * AES-256-GCM encryption for provider credentials at rest.
 *
 * Provider API keys/secrets are NEVER stored in plaintext. The master key is
 * derived from CREDENTIAL_ENC_KEY (env). Output format (base64):
 *   iv(12) | authTag(16) | ciphertext
 *
 * GCM gives us confidentiality + integrity (tampering with the blob fails decrypt).
 */
const KEY = createHash('sha256').update(config.credentialEncKey).digest() // 32 bytes

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decrypt(blob: string): string {
  const buf = Buffer.from(blob, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ct = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

/** Encrypt a JSON-serializable credentials object. */
export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value))
}

/** Decrypt back into a typed object (throws if tampered / wrong key). */
export function decryptJson<T>(blob: string): T {
  return JSON.parse(decrypt(blob)) as T
}

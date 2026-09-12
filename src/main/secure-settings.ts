import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Secret fields that are persisted encrypted (Electron safeStorage) instead
 * of in plaintext localStorage. Lives in the main process only, under
 * `app.getPath('userData')/secure-settings.json` with 0600 permissions.
 */

const SECRET_FIELDS = ['apiKey'] as const
export type SecretField = (typeof SECRET_FIELDS)[number]
export const SECRET_FIELDS_LIST: readonly SecretField[] = SECRET_FIELDS

interface SecureStore {
  encrypted: Record<string, string> // field -> base64 of safeStorage.encryptString
}

function getSecurePath(): string {
  return join(app.getPath('userData'), 'secure-settings.json')
}

function loadStore(): SecureStore {
  try {
    const raw = readFileSync(getSecurePath(), 'utf-8')
    const parsed = JSON.parse(raw) as SecureStore
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.encrypted &&
      typeof parsed.encrypted === 'object'
    ) {
      return parsed
    }
  } catch {
    // Missing or corrupt store — start fresh
  }
  return { encrypted: {} }
}

function saveStore(store: SecureStore): void {
  try {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    writeFileSync(getSecurePath(), JSON.stringify(store), { mode: 0o600 })
  } catch (error) {
    console.error('Failed to write secure settings:', error)
  }
}

export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function getSecret(field: SecretField): string {
  if (!isEncryptionAvailable()) return ''
  const store = loadStore()
  const encrypted = store.encrypted[field]
  if (!encrypted) return ''
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch (error) {
    console.error(`Failed to decrypt ${field}:`, error)
    return ''
  }
}

export function setSecret(field: SecretField, value: string): void {
  if (!value) {
    deleteSecret(field)
    return
  }
  if (!isEncryptionAvailable()) return
  try {
    const store = loadStore()
    store.encrypted[field] = safeStorage.encryptString(value).toString('base64')
    saveStore(store)
  } catch (error) {
    console.error(`Failed to encrypt ${field}:`, error)
  }
}

export function deleteSecret(field: SecretField): void {
  const store = loadStore()
  if (delete store.encrypted[field]) saveStore(store)
}

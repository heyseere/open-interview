import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, chmodSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Secret fields that are persisted encrypted (Electron safeStorage) instead
 * of in plaintext localStorage. Lives in the main process only, under
 * `app.getPath('userData')/secure-settings.json` with 0600 permissions.
 */

/**
 * Encrypted JSON map of provider id → API key (the only secret this app
 * stores). Kept as one sealed field so the settings sync only carries the
 * ACTIVE provider's key, while switching providers still restores each one's
 * saved credential.
 */
export const PROVIDER_API_KEYS_FIELD = 'providerApiKeys'

export type SecretField = typeof PROVIDER_API_KEYS_FIELD | typeof LEGACY_API_KEY_FIELD

/** Legacy single-key field, read once to migrate into the provider map. */
export const LEGACY_API_KEY_FIELD = 'apiKey'

interface SecureStore {
  encrypted: Record<string, string> // field -> base64 of safeStorage.encryptString
}

function getSecurePath(): string {
  return join(app.getPath('userData'), 'secure-settings.json')
}

/** Parsed store cached in memory. Every settings-sync keystroke used to
 * re-read and re-parse this file from disk on the main-process event loop;
 * writes refresh the cache, so disk and memory stay in lockstep (the file is
 * owned exclusively by this process). */
let cachedStore: SecureStore | null = null

function loadStore(): SecureStore {
  if (cachedStore) return cachedStore
  try {
    const raw = readFileSync(getSecurePath(), 'utf-8')
    const parsed = JSON.parse(raw) as SecureStore
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.encrypted &&
      typeof parsed.encrypted === 'object'
    ) {
      cachedStore = parsed
      return cachedStore
    }
  } catch {
    // Missing or corrupt store — start fresh
  }
  cachedStore = { encrypted: {} }
  return cachedStore
}

function saveStore(store: SecureStore): void {
  cachedStore = store
  try {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    // Atomic tmp+rename replace (same pattern as conversation-history): a
    // crash mid-write must never destroy the existing encrypted store. The
    // 0600 mode only applies at file creation, so re-assert it explicitly.
    const target = getSecurePath()
    const tmp = `${target}.tmp`
    writeFileSync(tmp, JSON.stringify(store), { mode: 0o600 })
    chmodSync(tmp, 0o600)
    renameSync(tmp, target)
  } catch (error) {
    try {
      unlinkSync(`${getSecurePath()}.tmp`)
    } catch {
      // tmp may not exist yet
    }
    console.error('Failed to write secure settings:', error)
  }
}

// encryptString/decryptString use the async variants: the synchronous ones
// are deprecated in Electron 45 and removed in 46. isEncryptionAvailable has
// no async variant on 44 — revisit when upgrading to 45+.
export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/** Decrypted values cached per field: reads run on the settings-sync path
 * (per keystroke) and safeStorage decryption is real CPU work. The cache is
 * refreshed on write/delete so it can never go stale within the session. */
const decryptedCache = new Map<SecretField, string>()

export async function getSecret(field: SecretField): Promise<string> {
  if (!isEncryptionAvailable()) return ''
  const cached = decryptedCache.get(field)
  if (cached !== undefined) return cached
  const store = loadStore()
  const encrypted = store.encrypted[field]
  if (!encrypted) return ''
  try {
    const decrypted = await safeStorage.decryptStringAsync(Buffer.from(encrypted, 'base64'))
    // The key can be rotated by the OS (e.g. a Linux keyring migration);
    // persist the re-encrypted form so later reads skip the round trip.
    if (decrypted.shouldReEncrypt) {
      store.encrypted[field] = (await safeStorage.encryptStringAsync(decrypted.result)).toString(
        'base64'
      )
      saveStore(store)
    }
    decryptedCache.set(field, decrypted.result)
    return decrypted.result
  } catch (error) {
    console.error(`Failed to decrypt ${field}:`, error)
    return ''
  }
}

export async function setSecret(field: SecretField, value: string): Promise<void> {
  if (!value) {
    deleteSecret(field)
    return
  }
  if (!isEncryptionAvailable()) return
  try {
    const store = loadStore()
    store.encrypted[field] = (await safeStorage.encryptStringAsync(value)).toString('base64')
    saveStore(store)
    decryptedCache.set(field, value)
  } catch (error) {
    console.error(`Failed to encrypt ${field}:`, error)
  }
}

export function deleteSecret(field: SecretField): void {
  const store = loadStore()
  if (delete store.encrypted[field]) saveStore(store)
  decryptedCache.delete(field)
}

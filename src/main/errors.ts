/**
 * Extract a user-facing error message from API errors (AI SDK or generic).
 *
 * The result is compacted for the single-line error banner: whitespace is
 * collapsed and long text is capped at ~180 chars.
 */
const MAX_LENGTH = 180

function compact(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  if (line.length <= MAX_LENGTH) return line
  return `${line.slice(0, MAX_LENGTH)}…`
}

/** Pull the first meaningful message out of a JSON error body, if any. */
function messageFromBody(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: { message?: unknown } }
    const message = parsed.message ?? parsed.error?.message
    if (typeof message === 'string' && message.trim()) return message.trim()
  } catch {
    // Not JSON — the caller falls back to the raw body or error.message
  }
  return null
}

/**
 * Extract a user-facing error message. `fallback` is REQUIRED and localized
 * by the caller (`tMain('err.unknown')`) — this module stays dependency-free
 * and never hardcodes one UI language.
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error == null) {
    return fallback
  }
  if (!(error instanceof Error)) {
    return compact(String(error)) || fallback
  }

  // Try to extract responseBody from AI SDK errors
  const apiError = error as Error & {
    responseBody?: string
    statusCode?: number
    data?: unknown
  }

  // Prefer a structured message from the JSON response body
  if (apiError.responseBody) {
    const fromBody = messageFromBody(apiError.responseBody)
    if (fromBody) return compact(fromBody)
    if (apiError.responseBody.length < 200) {
      return compact(apiError.responseBody)
    }
  }

  // Fallback to error message
  return compact(error.message || '') || fallback
}

/**
 * Coarse failure classes for API-stream errors, driving the localized message
 * and the repair affordance on the error row. Deliberately i18n-free: the
 * caller maps the kind to a localized string. `unknown` keeps the provider's
 * own message — for anything not listed below (404 model missing, invalid
 * request…) the provider's text is the most actionable thing we have.
 */
export type ApiErrorKind = 'auth' | 'rate-limit' | 'server' | 'network' | 'timeout' | 'unknown'

export function classifyApiError(error: unknown): ApiErrorKind {
  if (!(error instanceof Error)) return 'unknown'

  // AI SDK errors carry the HTTP status; status wins over message heuristics
  // so a 429 with "timeout" in the body still classifies as rate-limit.
  const status = (error as Error & { statusCode?: number }).statusCode
  if (status === 401 || status === 402 || status === 403) return 'auth'
  if (status === 429) return 'rate-limit'
  if (status === 408) return 'timeout'
  if (status != null && status >= 500) return 'server'

  const name = error.name.toLowerCase()
  const message = error.message.toLowerCase()
  if (name.includes('abort') || message.includes('timed out') || message.includes('timeout')) {
    return 'timeout'
  }
  if (
    message.includes('fetch failed') ||
    message.includes('fetch_error') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('eai_again') ||
    message.includes('network')
  ) {
    return 'network'
  }
  return 'unknown'
}

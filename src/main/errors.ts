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

export function extractErrorMessage(error: unknown, fallback = '未知错误'): string {
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

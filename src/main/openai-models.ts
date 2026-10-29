import { tMain } from './i18n'

/** One entry of a parsed /v1/models response. */
export interface OpenAIModelInfo {
  id: string
  /** The model exposes a thinking/reasoning mode (drives the settings toggle). */
  reasoning: boolean
}

interface RawModelItem {
  id?: unknown
  // OpenRouter-style capability list
  supported_parameters?: unknown
  supportedParameters?: unknown
  // providers that expose a capabilities object (e.g. reasoning: true)
  capabilities?: unknown
}

/**
 * Conservative reasoning-model detection from the model id alone. Used when
 * the endpoint publishes no capability metadata. False negatives merely hide
 * the settings toggle; keep the pattern free of guesses that could false-positive.
 */
const REASONING_ID_PATTERN =
  /thinking|deepseek-r1|-r1|qwq|gpt-oss|gpt-5|(^|\/)(o1|o3|o4-mini)(-|$)/i

/** `gpt-5-chat-latest` is the non-reasoning chat variant of the gpt-5 family. */
const NON_REASONING_ID_PATTERN = /gpt-5-chat/i

function idLooksReasoning(id: string): boolean {
  if (NON_REASONING_ID_PATTERN.test(id)) return false
  return REASONING_ID_PATTERN.test(id)
}

function supportedParametersIncludeReasoning(value: unknown): boolean {
  return Array.isArray(value) && value.some((entry) => entry === 'reasoning')
}

function metadataLooksReasoning(item: RawModelItem): boolean {
  if (
    supportedParametersIncludeReasoning(item.supported_parameters) ||
    supportedParametersIncludeReasoning(item.supportedParameters)
  ) {
    return true
  }
  const capabilities = item.capabilities
  return (
    typeof capabilities === 'object' &&
    capabilities !== null &&
    (capabilities as { reasoning?: unknown }).reasoning === true
  )
}

/**
 * Parse a /v1/models response body into deduplicated, id-sorted model info.
 * Reasoning support comes from model detail metadata when the endpoint
 * provides it (OpenRouter `supported_parameters`, `capabilities.reasoning`),
 * with a conservative id-pattern fallback — models with neither signal
 * report `reasoning: false` ("off when unknown").
 */
export function parseModelList(body: unknown): OpenAIModelInfo[] {
  if (typeof body !== 'object' || body === null) return []
  const data = (body as { data?: unknown }).data
  if (!Array.isArray(data)) return []

  const byId = new Map<string, OpenAIModelInfo>()
  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as RawModelItem
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    if (!id || byId.has(id)) continue
    byId.set(id, {
      id,
      reasoning: metadataLooksReasoning(record) || idLooksReasoning(id)
    })
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id))
}

function getModelsURL(baseURL: string): URL {
  let url: URL
  try {
    url = new URL(baseURL.trim())
  } catch {
    throw new Error(tMain('err.apiUrlInvalid'))
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(tMain('err.apiUrlProtocol'))
  }

  url.pathname = `${url.pathname.replace(/\/+$/, '')}/models`
  url.search = ''
  url.hash = ''
  return url
}

export async function listOpenAIModels(
  baseURL: string,
  apiKey = '',
  request: typeof fetch = fetch
): Promise<OpenAIModelInfo[]> {
  if (!baseURL.trim()) throw new Error(tMain('err.apiUrlEmpty'))

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    // Some endpoints (e.g. local whisper servers) allow anonymous listing
    const headers: Record<string, string> = {}
    if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`

    const response = await request(getModelsURL(baseURL), {
      headers,
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(tMain('err.modelListHttp', { status: response.status }))
    }

    const models = parseModelList(await response.json())
    if (models.length === 0) {
      throw new Error(tMain('err.modelListInvalid'))
    }
    return models
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(tMain('err.modelListTimeout'))
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

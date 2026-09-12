import { tMain } from './i18n'

export interface OpenAIModel {
  id: string
}

export interface OpenAIModelsResponse {
  data?: OpenAIModel[]
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
): Promise<string[]> {
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

    const body = (await response.json()) as OpenAIModelsResponse
    if (!Array.isArray(body.data)) {
      throw new Error(tMain('err.modelListInvalid'))
    }

    const models = body.data
      .map((model) => model?.id?.trim())
      .filter((id): id is string => Boolean(id))

    return [...new Set(models)].sort((left, right) => left.localeCompare(right))
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(tMain('err.modelListTimeout'))
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

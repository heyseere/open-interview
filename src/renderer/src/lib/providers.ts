/**
 * Model-provider presets.
 *
 * The app talks to every provider through the OpenAI-compatible chat
 * completions API, so a "provider" is just a base URL + key + model set plus
 * a `kind` that decides which native thinking field (if any) is injected into
 * the request body by the main process (see src/main/reasoning-body.ts).
 *
 * Presets exist because `/models` is not reliable everywhere (Anthropic's
 * compatibility layer does not document it, some gateways return an empty
 * list) and because users should not have to memorize base URLs.
 */

import type { TranslationKey } from '@/lib/i18n'

export type ProviderKind = 'openai' | 'generic' | 'deepseek' | 'zhipu' | 'qwen'

export interface ProviderPreset {
  id: string
  name: string
  /** Translated label for names that are not plain Latin (see presetDisplayName). */
  nameKey?: TranslationKey
  kind: ProviderKind
  baseURL: string
  /** Suggested models shown before (or instead of) a fetched model list. */
  models: string[]
  /** Local servers (Ollama, LM Studio) run without an API key. */
}

export const CUSTOM_PRESET_ID = 'custom'

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-5-mini', 'gpt-5', 'gpt-4.1', 'gpt-4o']
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    nameKey: 'provider.siliconflow',
    kind: 'generic',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: ['Qwen/Qwen3-VL-32B-Instruct', 'deepseek-ai/DeepSeek-V3.2', 'zai-org/GLM-4.6']
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    nameKey: 'provider.moonshot',
    kind: 'generic',
    baseURL: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2-0905-preview', 'moonshot-v1-128k']
  },
  {
    id: 'zhipu',
    name: 'Zhipu GLM',
    nameKey: 'provider.zhipu',
    kind: 'zhipu',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4.6', 'glm-4.5v', 'glm-4.5-air']
  },
  {
    id: 'qwen',
    name: 'Alibaba Bailian Qwen',
    nameKey: 'provider.qwen',
    kind: 'qwen',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3-vl-plus', 'qwen3-max', 'qwen-plus']
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'generic',
    baseURL: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-sonnet-4.5', 'openai/gpt-5', 'google/gemini-2.5-pro']
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'generic',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash']
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    kind: 'generic',
    baseURL: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-5', 'claude-opus-4-1']
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    nameKey: 'provider.ollama',
    kind: 'generic',
    baseURL: 'http://localhost:11434/v1',
    models: ['qwen3-vl:8b', 'llama3.2-vision']
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (local)',
    nameKey: 'provider.lmstudio',
    kind: 'generic',
    baseURL: 'http://localhost:1234/v1',
    models: []
  },
  {
    id: CUSTOM_PRESET_ID,
    name: 'Custom',
    nameKey: 'provider.custom',
    kind: 'generic',
    baseURL: '',
    models: []
  }
]

export function findPreset(presetId: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((preset) => preset.id === presetId)
}

/** Preset display name: translated when a nameKey exists, else the name. */
export function presetDisplayName(
  preset: ProviderPreset,
  t: (key: TranslationKey) => string
): string {
  return preset.nameKey ? t(preset.nameKey) : preset.name
}

/**
 * Stored provider display name: older saved settings carry the preset's raw
 * name (possibly Chinese), so resolve the translated label through the
 * preset when one exists. User-typed (custom) names pass through.
 */
export function providerDisplayName(
  provider: { name: string; presetId?: string },
  t: (key: TranslationKey) => string
): string {
  const preset = provider.presetId ? findPreset(provider.presetId) : undefined
  return preset?.nameKey ? t(preset.nameKey) : provider.name
}

/**
 * Best-effort preset detection for migrated settings (the legacy store had a
 * single flat base URL). Matches on the host so `.../v1` vs `.../v1/` and
 * regional hosts still resolve.
 */
export function detectPreset(baseURL: string): ProviderPreset | undefined {
  let host: string
  try {
    host = new URL(baseURL.trim()).host.toLowerCase()
  } catch {
    return undefined
  }
  if (!host) return undefined
  return PROVIDER_PRESETS.find((preset) => {
    if (!preset.baseURL) return false
    try {
      const presetHost = new URL(preset.baseURL).host.toLowerCase()
      return presetHost === host
    } catch {
      return false
    }
  })
}

import type { Settings } from './store/settings'
import { activeProviderOf, type ProviderConfig } from './store/settings'

/** Payload shape of the settings sync, derived from the preload contract. */
type AppSettingsPayload = Parameters<typeof window.api.updateAppSettings>[0]

/**
 * The renderer → main settings projection.
 *
 * Only fields the MAIN process actually reads belong here (see
 * `src/main/settings.ts` `AppSettings`); renderer-only state (scenes, opacity,
 * layout, provider lists…) would be dead weight on every sync — and the old
 * "send the whole store" approach had to JSON-probe each field for
 * cloneability, serializing the entire prompt markdown per keystroke.
 *
 * The active provider is flattened back into the single-provider fields main
 * understands: main never needs to know the provider list, only the target it
 * must talk to (plus `providerKind` for the native thinking fields).
 *
 * The return type is `Partial<AppSettingsPayload>` so a field that main does
 * not know about cannot silently join the payload.
 */
export function toAppSettings(
  settings: Pick<
    Settings,
    | 'providers'
    | 'activeProviderId'
    | 'reasoningEffort'
    | 'customPrompt'
    | 'screenshotAutoSave'
    | 'screenshotDir'
    | 'localAsrModelSize'
    | 'localAsrLanguage'
    | 'language'
    | 'privacyMode'
    | 'audioInputDeviceId'
  >
): AppSettingsPayload {
  const provider: ProviderConfig | undefined = activeProviderOf(settings)
  return {
    providerId: provider?.id ?? '',
    providerKind: provider?.kind ?? 'generic',
    apiBaseURL: provider?.baseURL ?? '',
    apiKey: provider?.apiKey ?? '',
    model: provider?.model ?? '',
    customPrompt: settings.customPrompt,
    // The user's own choice — never masked by model-list detection, which is
    // only a hint (most providers publish no reasoning metadata at all).
    reasoningEffort: settings.reasoningEffort,
    screenshotAutoSave: settings.screenshotAutoSave,
    screenshotDir: settings.screenshotDir,
    localAsrModelSize: settings.localAsrModelSize,
    localAsrLanguage: settings.localAsrLanguage,
    language: settings.language,
    privacyMode: settings.privacyMode,
    audioInputDeviceId: settings.audioInputDeviceId
  }
}

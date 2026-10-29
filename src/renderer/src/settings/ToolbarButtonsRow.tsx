import { Checkbox } from '@/components/ui/checkbox'
import { useI18n } from '@/lib/i18n'
import { useSettingsStore } from '@/lib/store/settings'
import {
  TOOLBAR_BUTTON_IDS,
  TOOLBAR_BUTTON_META,
  TOOLBAR_SECTION_LABEL_KEYS,
  TOOLBAR_SECTIONS,
  type ToolbarButtonId
} from '@/lib/toolbar-buttons'
import { SettingsRow } from './components'

/**
 * Toolbar button picker: one checkbox per button, grouped by section.
 *
 * The toolbar is the only mouse surface in compact layout, so which buttons it
 * carries is a per-user decision. Order follows the registry, so the pill
 * always reads transcription → capture → generation.
 */
export function ToolbarButtonsRow() {
  const { t } = useI18n()
  const toolbarButtons = useSettingsStore((state) => state.toolbarButtons)
  const updateSetting = useSettingsStore((state) => state.updateSetting)

  const toggle = (id: ToolbarButtonId, enabled: boolean) => {
    const next = enabled
      ? TOOLBAR_BUTTON_IDS.filter((button) => button === id || toolbarButtons.includes(button))
      : toolbarButtons.filter((button) => button !== id)
    // Never persist an empty pill: the toolbar would vanish with no way back
    if (next.length === 0) return
    updateSetting('toolbarButtons', next)
  }

  return (
    <SettingsRow label={t('settings.toolbarButtonsLabel')} hint={t('settings.toolbarButtonsHint')}>
      <div className="flex w-60 flex-col gap-1.5">
        {TOOLBAR_SECTIONS.map((section) => (
          <div key={section} className="flex flex-col gap-1">
            <span className="text-micro uppercase tracking-wide text-muted-foreground">
              {t(TOOLBAR_SECTION_LABEL_KEYS[section])}
            </span>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {TOOLBAR_BUTTON_IDS.filter((id) => TOOLBAR_BUTTON_META[id].section === section).map(
                (id) => (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground"
                  >
                    <Checkbox
                      checked={toolbarButtons.includes(id)}
                      onCheckedChange={(checked) => toggle(id, checked === true)}
                    />
                    {t(TOOLBAR_BUTTON_META[id].labelKey)}
                  </label>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </SettingsRow>
  )
}

import {
  BookOpen,
  Camera,
  Chrome,
  EyeOff,
  History,
  Info,
  Layers,
  Lightbulb,
  MessageCircle,
  Mic,
  MonitorSmartphone,
  Sparkles,
  Wrench
} from 'lucide-react'
import { PageShell } from '@/components/PageHeader'
import { SectionCard } from '@/components/SectionCard'
import { Well } from '@/components/Well'
import { ActionShortcut } from '@/components/ActionShortcut'
import { useI18n } from '@/lib/i18n'
import { ShortcutReference } from './ShortcutReference'
import { FAQ } from './FAQ'

/**
 * Help center — DOCUMENTATION ONLY.
 *
 * Every block here is static prose: no buttons, no toggles, no links, no
 * in-page navigation. Actions the user can actually perform live in the app
 * (header icons, hover toolbar, Settings → Shortcuts), and this page describes
 * them in words plus live keycaps. Shortcut keycaps are spans fed by
 * ActionShortcut / ShortcutRow, so they always show the current binding
 * without becoming clickable. `#app-content button, #app-content a` must stay
 * empty — that is the acceptance check for this page.
 */
export default function HelpPage() {
  const { t } = useI18n()

  return (
    <PageShell title={t('help.title')}>
      {/* What the app is for */}
      <SectionCard icon={Info} title={t('help.introTitle')}>
        <p className="text-sm text-foreground">{t('help.introBody')}</p>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.featuresTitle')}</h3>
          <ul className="space-y-1.5 text-sm text-foreground">
            <li className="flex items-start gap-2">
              <Camera className="mt-0.5 size-4 shrink-0 text-ink-faint" />
              <span>{t('help.featureScreenshot')}</span>
            </li>
            <li className="flex items-start gap-2">
              <Mic className="mt-0.5 size-4 shrink-0 text-ink-faint" />
              <span>{t('help.featureTranscription')}</span>
            </li>
            <li className="flex items-start gap-2">
              <EyeOff className="mt-0.5 size-4 shrink-0 text-ink-faint" />
              <span>{t('help.featureStealth')}</span>
            </li>
            <li className="flex items-start gap-2">
              <Layers className="mt-0.5 size-4 shrink-0 text-ink-faint" />
              <span>{t('help.featureOverlay')}</span>
            </li>
          </ul>
        </Well>
      </SectionCard>

      {/* Three steps */}
      <SectionCard icon={Lightbulb} title={t('help.quickStartTitle')}>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.step1Title')}</h3>
          <p className="text-sm text-foreground">{t('help.step1Body')}</p>
        </Well>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.step2Title')}</h3>
          <p className="text-sm text-foreground">
            {t('help.step2Body')}{' '}
            <ActionShortcut action="takeScreenshot" size="sm" className="mx-1" />
          </p>
        </Well>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.step3Title')}</h3>
          <p className="text-sm text-foreground">{t('help.step3Body')}</p>
        </Well>
      </SectionCard>

      {/* Every binding, read live from the shortcut store */}
      <ShortcutReference />

      {/* Prompt scenes */}
      <SectionCard icon={Sparkles} title={t('help.scenesTitle')}>
        <p className="text-sm text-foreground">{t('help.scenesBody')}</p>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.scenesPresetsTitle')}</h3>
          <ul className="space-y-1.5 text-sm text-foreground">
            <li>{t('help.scenesPresetCoding')}</li>
            <li>{t('help.scenesPresetEnglish')}</li>
            <li>{t('help.scenesPresetGeneral')}</li>
          </ul>
        </Well>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.scenesCustomTitle')}</h3>
          <p className="text-sm text-foreground">{t('help.scenesCustomBody')}</p>
        </Well>
      </SectionCard>

      {/* Speech recognition */}
      <SectionCard icon={Mic} title={t('help.asrTitle')}>
        <p className="text-sm text-foreground">{t('help.asrBody')}</p>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.asrStepsTitle')}</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
            <li>{t('help.asrStep1')}</li>
            <li>
              {t('help.asrStep2')}{' '}
              <ActionShortcut action="toggleTranscription" size="sm" className="mx-1" />
              {t('help.asrStep3')}
            </li>
          </ol>
        </Well>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.asrSourceTitle')}</h3>
          <ul className="space-y-1.5 text-sm text-foreground">
            <li>{t('help.asrSourceSystem')}</li>
            <li>{t('help.asrSourceMic')}</li>
            <li>{t('help.asrSourceLanguage')}</li>
          </ul>
        </Well>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.asrToolsTitle')}</h3>
          <ul className="space-y-1.5 text-sm text-foreground">
            <li>
              {t('help.asrToolSubmit')}{' '}
              <ActionShortcut action="toggleTranscription" size="sm" className="mx-1" />
              {t('help.asrToolSubmitTail')}
            </li>
            <li>
              {t('help.asrToolClear')}{' '}
              <ActionShortcut action="clearTranscription" size="sm" className="mx-1" />
              {t('help.asrToolClearTail')}
            </li>
            <li>{t('help.asrToolAutoSubmit')}</li>
          </ul>
        </Well>
      </SectionCard>

      {/* Full-page capture */}
      <SectionCard icon={Chrome} title={t('help.fullPageTitle')}>
        <p className="text-sm text-foreground">{t('help.fullPageBody')}</p>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.fullPageStepsTitle')}</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
            <li>{t('help.fullPageStep1')}</li>
            <li>{t('help.fullPageStep2')}</li>
            <li>
              {t('help.fullPageStep3')}{' '}
              <ActionShortcut action="captureFullPage" size="sm" className="mx-1" />
            </li>
          </ol>
        </Well>
        <p className="text-xs text-ink-faint">{t('help.fullPageNote')}</p>
      </SectionCard>

      {/* Privacy mode */}
      <SectionCard icon={EyeOff} title={t('help.privacyTitle')}>
        <p className="text-sm text-foreground">{t('help.privacyBody')}</p>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.privacyPointsTitle')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            <li>{t('help.privacyPoint1')}</li>
            <li>{t('help.privacyPoint2')}</li>
            <li>{t('help.privacyPoint3')}</li>
            <li>{t('help.privacyPoint4')}</li>
          </ul>
        </Well>
        <p className="text-xs text-ink-faint">{t('help.privacyNote')}</p>
      </SectionCard>

      {/* Window, layout, passthrough */}
      <SectionCard icon={MonitorSmartphone} title={t('help.windowTitle')}>
        <p className="text-sm text-foreground">{t('help.windowBody')}</p>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.windowLayoutTitle')}</h3>
          <p className="text-sm text-foreground">{t('help.windowLayoutBody')}</p>
        </Well>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.windowPassthroughTitle')}</h3>
          <p className="text-sm text-foreground">
            {t('help.windowPassthroughBody')}{' '}
            <ActionShortcut action="ignoreOrEnableMouse" size="sm" className="mx-1" />
          </p>
        </Well>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.windowTransparencyTitle')}</h3>
          <p className="text-sm text-foreground">{t('help.windowTransparencyBody')}</p>
        </Well>
      </SectionCard>

      {/* History */}
      <SectionCard icon={History} title={t('help.historyTitle')}>
        <p className="text-sm text-foreground">{t('help.historyBody')}</p>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.historyRulesTitle')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            <li>{t('help.historyRule1')}</li>
            <li>{t('help.historyRule2')}</li>
            <li>{t('help.historyRule3')}</li>
          </ul>
        </Well>
      </SectionCard>

      {/* FAQ */}
      <FAQ />

      {/* Troubleshooting — symptom → fix pairs, pure prose */}
      <SectionCard icon={Wrench} title={t('help.troubleTitle')}>
        <p className="text-sm text-foreground">{t('help.troubleIntro')}</p>
        <Well>
          <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
            <li>{t('help.troubleCapture')}</li>
            <li>{t('help.troubleBrew')}</li>
            <li>{t('help.troubleModel')}</li>
            <li>{t('help.troubleApi')}</li>
            <li>{t('help.troubleAsr')}</li>
            <li>{t('help.troubleShortcuts')}</li>
          </ul>
        </Well>
      </SectionCard>

      {/* Support — plain text, no links: this page stays non-interactive */}
      <SectionCard icon={MessageCircle} title={t('help.supportTitle')}>
        <p className="text-sm text-foreground">{t('help.supportBody')}</p>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.supportIssuesTitle')}</h3>
          <p className="text-sm text-foreground">{t('help.supportIssuesBody')}</p>
          <p className="mt-2 select-text font-mono text-xs text-live-soft">
            {t('help.supportIssuesAddress')}
          </p>
        </Well>
        <Well>
          <h3 className="mb-2 font-semibold">{t('help.supportRepoTitle')}</h3>
          <p className="text-sm text-foreground">{t('help.supportRepoBody')}</p>
          <p className="mt-2 select-text font-mono text-xs text-live-soft">
            {t('help.supportRepoAddress')}
          </p>
        </Well>
      </SectionCard>

      {/* Reading hint, not an action */}
      <p className="flex items-center gap-1.5 px-1 text-xs text-ink-faint">
        <BookOpen className="size-3.5" />
        {t('help.readOnlyNote')}
      </p>
    </PageShell>
  )
}

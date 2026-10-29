import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { DwellIconButton } from '@/components/DwellIconButton'
import { useI18n } from '@/lib/i18n'
import { useDwellMs } from '@/lib/use-dwell-ms'
import { usePassthroughLift } from '@/lib/passthrough-lift'
import { useSettingsStore } from '@/lib/store/settings'
import { CANVAS, CANVAS_ID } from '@/lib/glass'

/**
 * Shared secondary-page header (settings / help / permissions): drag-region
 * bar with the back button inside `.actions` (no-drag, see main.css) and the
 * page title. The back target is a router path.
 *
 * The back button follows the main window's icon language: the same round
 * dark-glass dwell button as the coder header icons (hover-trigger fires it
 * when the hover-trigger setting is on, plain click otherwise).
 */
export function PageHeader({ title, backTo = '/' }: { title: string; backTo?: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const dwell = useDwellMs()
  return (
    <div id="app-header" className="flex items-center">
      <div className="actions">
        <DwellIconButton
          durationMs={dwell()}
          title={t('common.back')}
          icon={ArrowLeft}
          className="mr-2"
          onTrigger={() => navigate(backTo)}
        />
      </div>
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
    </div>
  )
}

/**
 * Full secondary-page shell: the glass canvas wrapping the header bar and
 * the #app-content scroll container (main.css gives it the calc height; the
 * id is load-bearing for scrollIntoView deep links). Wrap every secondary
 * page.
 *
 * The window opacity rides on this root, exactly like the compact layout and
 * the coder page: the whole frosted sheet fades as one, so settings/help/
 * permissions are as see-through as the main window. Without it the canvas
 * stayed at full 82% alpha and the pages looked denser than compact mode.
 *
 * The page registers as a whole-window `hold` lift surface: with passthrough
 * on, hovering anywhere on a secondary page must stay interactive — there are
 * no per-control lift refs here, and leaving the coder page must never strand
 * the user in a click-through UI. Unmounting (navigating back) automatically
 * restores the previous passthrough state.
 *
 * Secondary pages scroll with the quiet system-free scrollbar that
 * #app-content carries (main.css: 4px, only visible on hover) and deliberately
 * carry NO right-edge rail: the rail is coder chrome (it belongs to the answer
 * surface you read mid-exam), and a floating pill on a settings form read as a
 * stray control. pr-8 is plain breathing room for the scrollbar.
 */
export function PageShell({
  title,
  backTo,
  children
}: {
  title: string
  backTo?: string
  children: ReactNode
}) {
  const lift = usePassthroughLift({ hold: true, pad: 0 })
  const opacity = useSettingsStore((state) => state.opacity)
  return (
    <div
      id={CANVAS_ID}
      ref={lift.ref}
      className={`relative flex h-screen flex-col ${CANVAS}`}
      style={{ opacity }}
    >
      <PageHeader title={title} backTo={backTo} />
      <div id="app-content" className="flex flex-col gap-4 py-8 pl-8 pr-8">
        {children}
      </div>
    </div>
  )
}

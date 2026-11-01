import { useEffect, useMemo } from 'react'
import { useSolutionStore } from '@/lib/store/solution'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { screenshotDataUrl } from '@/lib/utils/image'
import { scrollByPage } from '@/lib/utils/scroll-state'
import { useI18n } from '@/lib/i18n'
import { useKeepTopScroll } from './use-keep-top-scroll'

/** Shared screenshot-thumbnail look; gallery adds the hover shadow on top. */
const THUMB_CLASS =
  'max-h-56 w-40 object-cover object-top border border-hairline-2 rounded-lg shadow-card'

export function AppContent() {
  const { t } = useI18n()
  // Per-field subscriptions: data fields change at very different rates (a
  // chunk flush must not re-render for error/loading). The streaming IPC
  // listeners live in the resident App component — they must survive route
  // changes — this component only renders their store state.
  const screenshotData = useSolutionStore((state) => state.screenshotData)
  const solutionChunks = useSolutionStore((state) => state.solutionChunks)
  const recentScreenshots = useSolutionStore((state) => state.recentScreenshots)
  const solutionText = useMemo(() => solutionChunks.join(''), [solutionChunks])
  // Scroll only on a deliberate reset (new session / new answer), never per
  // chunk: the reader keeps their place while the answer grows below.
  const resetEpoch = useSolutionStore((state) => state.resetEpoch)
  const { ref: contentRef } = useKeepTopScroll<HTMLDivElement>(resetEpoch)

  useEffect(() => {
    window.api.onScrollPageUp(() => {
      const container = document.getElementById('app-content')
      if (!container) return
      scrollByPage(container, -1)
    })
    return () => {
      window.api.removeScrollPageUpListener()
    }
  }, [])

  useEffect(() => {
    window.api.onScrollPageDown(() => {
      const container = document.getElementById('app-content')
      if (!container) return
      scrollByPage(container, 1)
    })
    return () => {
      window.api.removeScrollPageDownListener()
    }
  }, [])

  // Starting a new generation must not yank the view: the answer grows from
  // the top and the reader keeps their position (see use-keep-top-scroll).

  return (
    // flex-1 + min-h-0 make the content absorb the status bar's height inside
    // the coder page's flex column (overriding main.css's fixed calc height);
    // the wider right/bottom paddings keep text clear of the floating scroll
    // rail and hover toolbar
    <div id="app-content" ref={contentRef} className="min-h-0 flex-1 pb-20 pr-14 pl-6 pt-4">
      {/* Screenshot Gallery — shown in every mode, privacy included: the
          preview is the user's own working surface, while privacy mode hides
          the WINDOW from screen sharing and blocks on-disk copies */}
      {recentScreenshots.length > 0 ? (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {recentScreenshots.map((data, index) => (
            <img
              key={index}
              src={screenshotDataUrl(data)}
              alt={t('coder.screenshotAlt', { n: index + 1 })}
              className={`${THUMB_CLASS} flex-shrink-0 transition-shadow`}
              title={t('coder.screenshotTitle', { n: index + 1 })}
            />
          ))}
        </div>
      ) : screenshotData ? (
        <div className="mb-4">
          <img
            src={screenshotDataUrl(screenshotData)}
            alt={t('coder.screenshotAlt', { n: 1 })}
            className={THUMB_CLASS}
          />
        </div>
      ) : null}

      {/* Solution Display */}
      <MarkdownRenderer>{solutionText}</MarkdownRenderer>
    </div>
  )
}

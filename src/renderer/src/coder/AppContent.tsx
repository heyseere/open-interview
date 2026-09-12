import { useEffect, useState } from 'react'
import { useSolutionStore } from '@/lib/store/solution'
import { useSettingsStore } from '@/lib/store/settings'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { screenshotDataUrl } from '@/lib/utils/image'
import { useI18n } from '@/lib/i18n'

const SCROLL_OFFSET = 120

export function AppContent() {
  const { t } = useI18n()
  const {
    screenshotData,
    solutionChunks,
    errorMessage,
    setScreenshotData,
    setIsLoading,
    addSolutionChunk,
    setErrorMessage,
    clearSolution
  } = useSolutionStore()
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const [recentScreenshots, setRecentScreenshots] = useState<string[]>([])
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    // Listen for screenshot events (latest)
    window.api.onScreenshotTaken((data: string) => {
      setScreenshotData(data)
    })

    // Listen for screenshots-updated events (gallery)
    window.api.onScreenshotsUpdated((screenshots: string[]) => {
      setRecentScreenshots(screenshots)
    })

    // New session clear (pictures + answers)
    window.api.onSolutionClear(() => {
      clearSolution()
      setRecentScreenshots([])
      setScreenshotData(null)
      setErrorMessage(null)
    })

    // Listen for solution chunks
    window.api.onSolutionChunk((chunk: string) => {
      addSolutionChunk(chunk)
    })

    // AI loading
    window.api.onAiLoadingStart(() => {
      setIsLoading(true)
      setErrorMessage(null) // Clear error when new request starts
    })
    window.api.onAiLoadingEnd(() => {
      setIsLoading(false)
    })

    // Cleanup listeners on unmount
    return () => {
      window.api.removeScreenshotListener()
      window.api.removeScreenshotsUpdatedListener()
      window.api.removeSolutionChunkListener()
      window.api.removeAiLoadingStartListener()
      window.api.removeAiLoadingEndListener()
      window.api.removeSolutionClearListener()
    }
  }, [setScreenshotData, clearSolution, setIsLoading, addSolutionChunk, setErrorMessage])

  useEffect(() => {
    window.api.onSolutionComplete(() => {
      setIsLoading(false)
    })
    window.api.onSolutionStopped(() => {
      setIsLoading(false)
    })
    window.api.onSolutionError((message: string) => {
      setIsLoading(false)
      setErrorMessage(message)
    })
    return () => {
      window.api.removeSolutionCompleteListener()
      window.api.removeSolutionStoppedListener()
      window.api.removeSolutionErrorListener()
    }
  }, [setIsLoading, setErrorMessage])

  useEffect(() => {
    window.api.onScrollPageUp(() => {
      const container = document.getElementById('app-content')
      if (!container) return
      container.scrollTo({
        top: container.scrollTop - window.innerHeight + SCROLL_OFFSET,
        behavior: 'smooth'
      })
    })
    return () => {
      window.api.removeScrollPageUpListener()
    }
  }, [])

  useEffect(() => {
    window.api.onScrollPageDown(() => {
      const container = document.getElementById('app-content')
      if (!container) return
      container.scrollTo({
        top: container.scrollTop + window.innerHeight - SCROLL_OFFSET,
        behavior: 'smooth'
      })
    })
    return () => {
      window.api.removeScrollPageDownListener()
    }
  }, [])

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    try {
      const result = await window.api.retrySolutionStream()
      if (!result.success && result.error) setErrorMessage(result.error)
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div id="app-content" className="px-6 py-4">
      {/* Error banner — single compact line: truncated message (full text in
          the tooltip), inline retry and close */}
      {errorMessage && (
        <div className="mb-3 px-2.5 py-1.5 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2">
          <svg
            className="w-4 h-4 text-red-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="flex-1 min-w-0 text-xs text-red-300/90 truncate" title={errorMessage}>
            {errorMessage}
          </p>
          <button
            onClick={() => void handleRetry()}
            disabled={isRetrying}
            className="px-2 py-0.5 text-xs rounded-md bg-red-500/30 hover:bg-red-500/50 text-red-200 transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            {t('common.retry')}
          </button>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400/80 hover:text-red-300 flex-shrink-0 cursor-pointer"
            title={t('common.close')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Screenshot Gallery — hidden in privacy mode */}
      {!privacyMode && recentScreenshots.length > 0 ? (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {recentScreenshots.map((data, index) => (
            <img
              key={index}
              src={screenshotDataUrl(data)}
              alt={t('coder.screenshotAlt', { n: index + 1 })}
              className="w-40 h-auto flex-shrink-0 border border-gray-600 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
              title={t('coder.screenshotTitle', { n: index + 1 })}
            />
          ))}
        </div>
      ) : !privacyMode && screenshotData ? (
        <div className="mb-4">
          <img
            src={screenshotDataUrl(screenshotData)}
            alt={t('coder.screenshotAlt', { n: 1 })}
            className="w-40 h-auto border border-gray-600 rounded-lg shadow-lg"
          />
        </div>
      ) : null}

      {/* Solution Display */}
      <MarkdownRenderer>{solutionChunks.join('')}</MarkdownRenderer>
    </div>
  )
}

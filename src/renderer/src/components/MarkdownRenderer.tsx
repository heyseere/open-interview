import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  isValidElement,
  type ComponentProps,
  type ReactNode
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { Check, Copy, X } from 'lucide-react'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'
import { useI18n } from '@/lib/i18n'
import { GLASS_OVERLAY } from '@/lib/glass'
import { ICON_DIM_SOFT } from '@/lib/icon-state'
import { splitMarkdownBlocks } from '@/lib/utils/markdown-blocks'

/** Flatten rendered markdown children (the `pre > code` tree) into plain text. */
function toPlainText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(toPlainText).join('')
  if (isValidElement(node)) {
    return toPlainText((node.props as { children?: ReactNode }).children)
  }
  return ''
}

type CopyState = 'idle' | 'done' | 'failed'

/**
 * A fenced code block with a persistent copy button — pasting the generated
 * code into an editor is the most frequent in-exam action, so it must not
 * require text selection.
 */
function CodeBlock({ children, node, ...preProps }: ComponentProps<'pre'> & { node?: unknown }) {
  void node
  const { t } = useI18n()
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const resetTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    }
  }, [])

  const handleCopy = async () => {
    const text = toPlainText(children).replace(/\n$/, '')
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('done')
    } catch {
      setCopyState('failed')
    }
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setCopyState('idle'), 1500)
  }

  return (
    <div className="group relative">
      <pre {...preProps}>{children}</pre>
      <button
        onClick={() => void handleCopy()}
        title={
          copyState === 'done'
            ? t('coder.copied')
            : copyState === 'failed'
              ? t('coder.copyFailed')
              : t('coder.copyCode')
        }
        className={`absolute right-2 top-2 flex items-center rounded-md border border-hairline p-1.5 ${GLASS_OVERLAY} ${ICON_DIM_SOFT} cursor-pointer`}
      >
        {copyState === 'done' ? (
          <Check className="size-3.5 text-good" />
        ) : copyState === 'failed' ? (
          <X className="size-3.5 text-bad" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  )
}

/**
 * Links inside answers open in the system browser: same-window navigation is
 * blocked main-side (will-navigate), so wire the click here — otherwise a
 * link would simply do nothing. The main handler re-validates the scheme.
 */
function AnswerLink({ children, href, node, ...props }: ComponentProps<'a'> & { node?: unknown }) {
  void node
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        if (!href) return
        event.preventDefault()
        void window.api.openExternal(href)
      }}
    >
      {children}
    </a>
  )
}

// Module-level constants: re-creating these arrays/objects per render makes
// ReactMarkdown treat every stream tick as a config change and re-parse.
// Math runs before highlighting (remark side) and after it (rehype side) so
// TeX inside a code fence is still code, while $…$ in prose becomes KaTeX.
const REMARK_PLUGINS = [remarkGfm, remarkMath]
const REHYPE_PLUGINS = [rehypeHighlight, rehypeKatex]
const MARKDOWN_COMPONENTS = { pre: CodeBlock, a: AnswerLink }

/**
 * One top-level markdown block. Memoized: blocks before the last one are
 * byte-stable while the answer streams in, so their parse + highlight work
 * happens exactly once (the outer memo only protected against sibling state
 * updates — during streaming the text itself changes every flush).
 */
const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={MARKDOWN_COMPONENTS}
    >
      {text}
    </ReactMarkdown>
  )
})

/**
 * Ref https://github.com/tailwindlabs/tailwindcss-typography to fine-tune the markdown style.
 * The wrapper font-size follows the answer-size setting via --oi-answer-font
 * (set in App.tsx); typography's em-based heading/code sizes scale with it.
 *
 * Renders block-wise (splitMarkdownBlocks): an O(n²)-per-turn full re-parse +
 * re-highlight on every ~100ms flush becomes O(n) — only the tail block
 * re-parses. Blocks stay direct children of the prose wrapper, so typography
 * sibling spacing (`> * + *`) applies exactly as with one document.
 */
function MarkdownRenderer({ children }: { children: string }) {
  const blocks = useMemo(() => splitMarkdownBlocks(children), [children])
  return (
    <div
      className="oi-answer prose prose-sm prose-invert max-w-none prose-pre:p-0"
      style={{ fontSize: 'var(--oi-answer-font, 0.875rem)' }}
    >
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} text={block} />
      ))}
    </div>
  )
}

export default memo(MarkdownRenderer)

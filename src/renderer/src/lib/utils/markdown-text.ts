import { splitMarkdownBlocks } from './markdown-blocks'

/**
 * Convert accumulated markdown solution chunks into plain text for the
 * compact teleprompter display. Code blocks are kept verbatim (they usually
 * contain the answer), while decorative syntax is stripped.
 *
 * Math gets its own pass BEFORE the markdown regexes run. Two reasons: a
 * `\frac{a}{b}` left in place would be shown to the user as raw TeX (the
 * compact panel is a plain-text teleprompter, there is no KaTeX in it), and
 * the emphasis rules below would happily eat `a_b * c` out of a formula,
 * turning a correct expression into nonsense.
 */

/** Symbols that have an obvious one-character Unicode form. */
const MATH_SYMBOLS: [RegExp, string][] = [
  [/\\times\b/g, '×'],
  [/\\cdot\b/g, '·'],
  [/\\div\b/g, '÷'],
  [/\\pm\b/g, '±'],
  [/\\mp\b/g, '∓'],
  [/\\leq?\b/g, '≤'],
  [/\\geq?\b/g, '≥'],
  [/\\neq?\b/g, '≠'],
  [/\\approx\b/g, '≈'],
  [/\\equiv\b/g, '≡'],
  [/\\infty\b/g, '∞'],
  [/\\to\b/g, '→'],
  [/\\rightarrow\b/g, '→'],
  [/\\Rightarrow\b/g, '⇒'],
  [/\\leftarrow\b/g, '←'],
  [/\\sum\b/g, 'Σ'],
  [/\\prod\b/g, '∏'],
  [/\\int\b/g, '∫'],
  [/\\partial\b/g, '∂'],
  [/\\nabla\b/g, '∇'],
  [/\\alpha\b/g, 'α'],
  [/\\beta\b/g, 'β'],
  [/\\gamma\b/g, 'γ'],
  [/\\delta\b/g, 'δ'],
  [/\\Delta\b/g, 'Δ'],
  [/\\epsilon\b/g, 'ε'],
  [/\\theta\b/g, 'θ'],
  [/\\lambda\b/g, 'λ'],
  [/\\mu\b/g, 'μ'],
  [/\\pi\b/g, 'π'],
  [/\\sigma\b/g, 'σ'],
  [/\\Sigma\b/g, 'Σ'],
  [/\\phi\b/g, 'φ'],
  [/\\omega\b/g, 'ω'],
  [/\\Omega\b/g, 'Ω']
]

/** Function names keep their letters, just lose the backslash. */
const MATH_FUNCTIONS = /\\(sin|cos|tan|cot|sec|csc|log|ln|lg|exp|max|min|lim|det|gcd)\b/g
/** `\frac{a}{b}` → `(a)/(b)`; nesting is resolved by repeating the pass. */
const FRAC_RE = /\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g
/** `\sqrt{x}` → `√(x)`, `\sqrt[3]{x}` → `(x)^(1/3)`. */
const SQRT_RE = /\\sqrt\s*(?:\[([^\]]*)\])?\s*\{([^{}]*)\}/g
/** Commands whose braces only group: drop the command, keep the content. */
const TEXT_CMD_RE = /\\(?:text|mathrm|mathbf|mathit|operatorname|mbox)\s*\{([^{}]*)\}/g

/**
 * Render a LaTeX fragment as readable plain text. Not a parser — a small
 * best-effort transliteration covering what models actually emit in answers.
 */
function mathToPlainText(latex: string): string {
  let out = latex
    // Spacing / alignment commands that carry no meaning in plain text.
    .replace(/\\left\s*|\\right\s*/g, '')
    .replace(/\\[,;:!]/g, ' ')
    .replace(/\\quad\b|\\qquad\b/g, '  ')
    .replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}/g, ' ')
    .replace(/\\\\/g, '; ')
    .replace(/&/g, ' ')

  // Resolve nesting bottom-up; each pass handles one brace level.
  for (let pass = 0; pass < 4; pass += 1) {
    const next = out
      .replace(FRAC_RE, '($1)/($2)')
      .replace(SQRT_RE, (_match, index: string | undefined, body: string) =>
        index ? `(${body})^(1/${index})` : `√(${body})`
      )
    if (next === out) break
    out = next
  }

  out = out.replace(TEXT_CMD_RE, '$1').replace(MATH_FUNCTIONS, '$1')
  for (const [pattern, symbol] of MATH_SYMBOLS) out = out.replace(pattern, symbol)

  return out
    .replace(/\^\{([^{}]*)\}/g, '^$1')
    .replace(/_\{([^{}]*)\}/g, '_$1')
    .replace(/[{}]/g, '')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Apply `transform` to the prose spans only, leaving fenced code untouched: a
 * `$` inside a shell snippet or a regex is code, not math. Fence markers are
 * dropped (the compact panel shows the code, not the ``` lines).
 */
function mapOutsideFences(text: string, transform: (chunk: string) => string): string {
  const parts: string[] = []
  let prose: string[] = []
  let code: string[] = []
  let fence: string | null = null

  const flushProse = () => {
    if (prose.length === 0) return
    parts.push(transform(prose.join('\n')))
    prose = []
  }
  const flushCode = () => {
    if (code.length === 0) return
    parts.push(code.join('\n'))
    code = []
  }

  for (const line of text.split('\n')) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fence) {
      // CommonMark closing rule: same character, at least as long.
      if (marker && marker[1].startsWith(fence)) {
        fence = null
        flushCode()
        continue
      }
      code.push(line)
      continue
    }
    if (marker) {
      flushProse()
      fence = marker[1]
      continue
    }
    prose.push(line)
  }
  flushProse()
  flushCode()
  return parts.join('\n')
}

/** Replace `$$…$$` and `$…$` spans with their plain-text reading. */
function stripMath(text: string): string {
  return (
    text
      // Display math first: a `$$` pair must never be read as two inline spans.
      .replace(/\$\$([\s\S]+?)\$\$/g, (_match, body: string) => mathToPlainText(body))
      .replace(/\$([^$\n]+?)\$/g, (_match, body: string) => mathToPlainText(body))
  )
}

export function markdownToPlainText(markdown: string): string {
  return mapOutsideFences(markdown, (chunk) =>
    stripMath(chunk)
      // Fenced code blocks: keep the code, drop the fence markers and language
      .replace(/```[^\n]*\n?/g, '')
      // Inline code backticks
      .replace(/`([^`]+)`/g, '$1')
      // Images before links
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Links keep their label
      .replace(/\[([^\]]+)\]\(([^)]*)\)/g, '$1')
      // Headings / blockquotes
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      // Bold / italic / strikethrough
      .replace(/(\*\*\*|\*\*|__)([^*_]+)\1/g, '$2')
      .replace(/(\*|_)([^*_]+)\1/g, '$2')
      .replace(/~~([^~]+)~~/g, '$1')
      // List markers (ordered & unordered)
      .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
      // Table decoration rows and pipes
      .replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, '')
      .replace(/\|/g, ' ')
      // Horizontal rules
      .replace(/^\s*(-{3,}|={3,}|\*{3,})\s*$/gm, '')
      // Raw HTML tags
      .replace(/<[^>]+>/g, '')
      // Collapse whitespace runs (keep single newlines)
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/**
 * Stream-friendly variant: converts block-by-block with a content cache, so
 * an appending document re-converts only the growing tail instead of running
 * the whole regex chain over the full text every flush (~100ms).
 */
const plainCache = new Map<string, string>()
const PLAIN_CACHE_MAX = 400

export function markdownToPlainTextCached(markdown: string): string {
  const parts: string[] = []
  for (const block of splitMarkdownBlocks(markdown)) {
    let plain = plainCache.get(block)
    if (plain === undefined) {
      if (plainCache.size >= PLAIN_CACHE_MAX) plainCache.clear()
      plain = markdownToPlainText(block)
      plainCache.set(block, plain)
    }
    parts.push(plain)
  }
  return parts.join('\n\n').trim()
}

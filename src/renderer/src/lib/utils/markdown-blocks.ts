/**
 * Split a markdown document into top-level blocks at blank lines, never
 * inside a fenced code block or a display-math block. Streaming renderers use
 * it to memoize the answer: every block except the last is byte-stable while
 * text appends, so only the growing tail re-parses (and re-highlights).
 *
 * Deliberately line-based and conservative: a blank line inside a list or
 * table splits it (rare in model output; the worst case is loose-vs-tight
 * list spacing). Fences (``` / ~~~, up to 3 spaces of indentation) never
 * split, closed or not — an unclosed fence keeps everything since its opener
 * in one block, which is exactly the part still growing mid-stream.
 *
 * Display math ($$ ... $$) gets the same treatment, and it is load-bearing
 * rather than cosmetic: models routinely emit `aligned` environments with
 * blank lines between rows, and a splitter that cut there would hand each
 * fragment to remark-math separately — every fragment would then be an
 * unpaired `$$` and render as literal dollar signs. Inline math ($x$) is
 * untouched: it never spans lines, so blank lines around it still split
 * normally.
 */
export function splitMarkdownBlocks(text: string): string[] {
  const blocks: string[] = []
  let current: string[] = []
  let fence: string | null = null
  let inMath = false

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join('\n'))
      current = []
    }
  }

  for (const line of text.split('\n')) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fence) {
      // CommonMark closing rule: same character, at least as long.
      if (marker && marker[1].startsWith(fence)) fence = null
    } else if (marker) {
      fence = marker[1]
    } else if (inMath) {
      // A display-math block ends on the line that carries the closing $$,
      // whether that is `$$` alone or `x = 1$$` at the end of the formula.
      if (line.includes('$$')) inMath = false
    } else if (/^\s{0,3}\$\$/.test(line)) {
      // Opening $$ with a second pair on the SAME line is a complete
      // one-line block (`$$x^2$$`), so it must not enter the math state.
      const rest = line.replace(/^\s{0,3}\$\$/, '')
      if (!rest.includes('$$')) inMath = true
    } else if (line.trim() === '') {
      flush()
      continue
    }
    current.push(line)
  }
  flush()
  return blocks
}

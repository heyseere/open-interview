import { useSolutionStore } from '@/lib/store/solution'
import { useFollowUpStore } from '@/lib/store/follow-up'
import { useSettingsStore } from '@/lib/store/settings'

/**
 * Visual-verification seed: open the app on the coder route with `demo=1`
 * in the hash (`#/?demo=1`) and the answer surface fills with sample content
 * instead of calling the AI. scripts/shot.mjs uses it to screenshot realistic
 * states; production flows never match the query and never reach this code.
 */

const DEMO_MARKDOWN = `## 解题思路

这是一段用于视觉验收的示例回答（\`demo=1\` 种子数据，不会调用 AI）。

**关键步骤**

1. 先对题目做变量代换，令 \`t = x² − 1\`；
2. 原式化简为标准二次型，判别式 \`Δ = b² − 4ac\`；
3. 结合定义域舍去负根，得到最小值点。

\`\`\`python
def solve(a, b, c):
    delta = b * b - 4 * a * c
    if delta < 0:
        return []
    root = delta ** 0.5
    return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
\`\`\`

> 注意：结果需代入原式验算，避免定义域遗漏。

| 情形 | 条件 | 结论 |
| --- | --- | --- |
| Δ > 0 | 两不等实根 | 取正根 |
| Δ = 0 | 重根 | 唯一解 |`

const DEMO_SCREENSHOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">
  <rect width="320" height="200" fill="#f7f6f2"/>
  <rect x="12" y="12" width="296" height="176" rx="6" fill="white" stroke="#d9d7d0"/>
  <text x="28" y="46" font-family="sans-serif" font-size="14" fill="#1d1d1f">Q1: Find the min of f(x) = x2 - 2x + 1</text>
  <text x="28" y="70" font-family="sans-serif" font-size="14" fill="#1d1d1f">on the interval [0, 3].</text>
  <text x="28" y="104" font-family="sans-serif" font-size="12" fill="#6e6e73">(1) Differentiate f and set f'(x) = 0;</text>
  <text x="28" y="126" font-family="sans-serif" font-size="12" fill="#6e6e73">(2) Check the stationary point;</text>
  <text x="28" y="148" font-family="sans-serif" font-size="12" fill="#6e6e73">(3) Verify the boundary values.</text>
</svg>`

export function maybeSeedDemoContent(): boolean {
  if (!/[?&]demo=1/.test(window.location.hash)) return false
  const solution = useSolutionStore.getState()
  solution.setSolutionChunks([DEMO_MARKDOWN])
  // ASCII-only SVG → btoa is safe; PNG-style base64 keeps the <img> path
  // identical to real screenshots (data:image/...;base64,)
  const svg = `data:image/svg+xml;base64,${btoa(DEMO_SCREENSHOT_SVG)}`
  solution.setScreenshotData(svg)
  solution.setRecentScreenshots([svg])
  return true
}

// Module-scope verification hooks (run at bundle load, immune to effect
// timing): scripts/shot.mjs drives the answer surface and the follow-up
// dialog deterministically from CDP instead of real AI calls.
if (typeof window !== 'undefined' && /[?&]demo=1/.test(window.location.hash)) {
  ;(window as unknown as Record<string, unknown>).__oiSolution = useSolutionStore
  ;(window as unknown as Record<string, unknown>).__oiFollowUp = useFollowUpStore
  ;(window as unknown as Record<string, unknown>).__oiSettings = useSettingsStore
}

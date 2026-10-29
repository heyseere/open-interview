import { describe, expect, it } from 'vitest'
import { markdownToPlainText } from './markdown-text'

describe('markdownToPlainText', () => {
  it('strips heading markers but keeps the text', () => {
    expect(markdownToPlainText('## 解题思路')).toBe('解题思路')
  })

  it('keeps fenced code content without fence markers', () => {
    const input = '答案如下：\n```python\nprint(42)\n```\n完毕'
    const output = markdownToPlainText(input)
    expect(output).toContain('print(42)')
    expect(output).not.toContain('```')
    expect(output).not.toContain('python\n')
  })

  it('unwraps inline code', () => {
    expect(markdownToPlainText('使用 `two pointers` 技术')).toBe('使用 two pointers 技术')
  })

  it('reduces links to their labels', () => {
    expect(markdownToPlainText('[LeetCode](https://leetcode.cn) 上很常见')).toBe(
      'LeetCode 上很常见'
    )
  })

  it('removes emphasis markers', () => {
    expect(markdownToPlainText('这是**关键**步骤和*次要*步骤')).toBe('这是关键步骤和次要步骤')
  })

  it('strips list markers', () => {
    const input = '- 第一\n- 第二\n1. 第三'
    expect(markdownToPlainText(input)).toBe('第一\n第二\n第三')
  })

  it('drops table decoration and pipes', () => {
    const input = '| a | b |\n|---|---|\n| 1 | 2 |'
    const output = markdownToPlainText(input)
    expect(output).not.toContain('|')
    expect(output).not.toContain('---')
    expect(output).toContain('a')
    expect(output).toContain('2')
  })

  it('removes horizontal rules and html tags', () => {
    expect(markdownToPlainText('前\n---\n后<br/>尾')).toBe('前\n\n后尾')
  })

  it('collapses excessive blank lines', () => {
    expect(markdownToPlainText('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('reads inline math instead of showing raw TeX', () => {
    expect(markdownToPlainText('所以 $x^2 + y^2 = r^2$ 成立')).toBe('所以 x^2 + y^2 = r^2 成立')
  })

  it('turns fractions and roots into readable text', () => {
    expect(markdownToPlainText('$\\frac{a}{b} + \\sqrt{c}$')).toBe('(a)/(b) + √(c)')
    expect(markdownToPlainText('$\\sqrt[3]{x}$')).toBe('(x)^(1/3)')
  })

  it('translates operators and greek letters', () => {
    expect(markdownToPlainText('$a \\times b \\leq \\pi$')).toBe('a × b ≤ π')
  })

  it('collapses a multi-line display block onto one readable line', () => {
    const input = '$$\n\\begin{aligned}\nx &= \\frac{1}{2} \\\\\ny &= 3\n\\end{aligned}\n$$'
    const output = markdownToPlainText(input)
    expect(output).not.toContain('$')
    expect(output).not.toContain('\\')
    expect(output).toContain('(1)/(2)')
    expect(output).toContain('x =')
  })

  it('keeps math inside a code fence literal', () => {
    const input = '```bash\necho $HOME\n```'
    expect(markdownToPlainText(input)).toBe('echo $HOME')
  })

  it('does not let emphasis rules eat underscores inside math', () => {
    expect(markdownToPlainText('$a_b * c_d$')).toBe('a_b * c_d')
  })
})

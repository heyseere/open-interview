import { describe, expect, it } from 'vitest'
import { splitMarkdownBlocks } from './markdown-blocks'

describe('splitMarkdownBlocks', () => {
  it('splits paragraphs at blank lines', () => {
    expect(splitMarkdownBlocks('para one\n\npara two\n\npara three')).toEqual([
      'para one',
      'para two',
      'para three'
    ])
  })

  it('never splits inside a fenced code block, even at blank lines', () => {
    const text = 'before\n\n```python\ndef a():\n\n    return 1\n\n```\n\nafter'
    expect(splitMarkdownBlocks(text)).toEqual([
      'before',
      '```python\ndef a():\n\n    return 1\n\n```',
      'after'
    ])
  })

  it('keeps an unclosed fence (mid-stream) as one growing tail block', () => {
    const text = 'intro\n\n```js\nconst a = 1;'
    expect(splitMarkdownBlocks(text)).toEqual(['intro', '```js\nconst a = 1;'])
  })

  it('supports tilde fences and indented fences', () => {
    const text = '~~~\n\nstill code\n~~~\n\n  ```\n  indented fence\n\n  more\n  ```\n\ndone'
    expect(splitMarkdownBlocks(text)).toEqual([
      '~~~\n\nstill code\n~~~',
      '  ```\n  indented fence\n\n  more\n  ```',
      'done'
    ])
  })

  it('a longer closing marker closes a shorter fence', () => {
    expect(splitMarkdownBlocks('````\n\nx\n````')).toEqual(['````\n\nx\n````'])
  })

  it('ignores blank lines around and between content', () => {
    expect(splitMarkdownBlocks('\n\n\na\n\n\n\nb\n\n')).toEqual(['a', 'b'])
  })

  it('returns [] for empty input', () => {
    expect(splitMarkdownBlocks('')).toEqual([])
    expect(splitMarkdownBlocks('\n \n')).toEqual([])
  })

  it('keeps lists and tables without blank lines as one block', () => {
    const list = '- one\n- two\n- three'
    const table = '| a | b |\n|---|---|\n| 1 | 2 |'
    expect(splitMarkdownBlocks(`${list}\n\n${table}`)).toEqual([list, table])
  })

  it('blocks rejoin to the original text modulo blank separators', () => {
    const text = '# Head\n\nsome **bold** text\n\n```ts\n\nconst x = 1\n\n```\n\n> quote'
    const rejoined = splitMarkdownBlocks(text).join('\n\n')
    expect(rejoined.replace(/\n{3,}/g, '\n\n')).toBe(text)
  })

  it('never splits a display-math block, even at blank lines', () => {
    const math = '$$\n\\begin{aligned}\na &= b \\\\\n\nc &= d\n\\end{aligned}\n$$'
    expect(splitMarkdownBlocks(`before\n\n${math}\n\nafter`)).toEqual(['before', math, 'after'])
  })

  it('treats a one-line $$x$$ as a complete block', () => {
    expect(splitMarkdownBlocks('a\n\n$$x^2$$\n\nb')).toEqual(['a', '$$x^2$$', 'b'])
  })

  it('leaves inline math to the paragraph it belongs to', () => {
    expect(splitMarkdownBlocks('cost is $x^2$ here\n\nnext')).toEqual([
      'cost is $x^2$ here',
      'next'
    ])
  })

  it('keeps an unclosed $$ (mid-stream) as one growing tail block', () => {
    expect(splitMarkdownBlocks('intro\n\n$$\nx = 1\n\ny = 2')).toEqual([
      'intro',
      '$$\nx = 1\n\ny = 2'
    ])
  })

  it('still splits after a closed display-math block', () => {
    expect(splitMarkdownBlocks('$$\nx = 1\n$$\n\nplain')).toEqual(['$$\nx = 1\n$$', 'plain'])
  })

  it('does not enter math state for $$ inside a code fence', () => {
    const code = '```tex\n$$\nx = 1\n\n$$\n```'
    expect(splitMarkdownBlocks(`${code}\n\nafter`)).toEqual([code, 'after'])
  })
})

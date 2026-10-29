import { describe, expect, it } from 'vitest'
import { toSimplifiedChinese } from './t2s'

describe('toSimplifiedChinese', () => {
  it('converts traditional characters to simplified', () => {
    // Char-level script normalization only: vocabulary stays as whispered
    // (軟體 is Taiwan vocabulary; the mainland term 软件 is phrase-level)
    expect(toSimplifiedChinese('這是一個軟體的測試，為後續做準備')).toBe(
      '这是一个软体的测试，为后续做准备'
    )
  })

  it('leaves simplified Chinese and English text untouched', () => {
    expect(toSimplifiedChinese('今天天气怎么样，这个功能很简单')).toBe(
      '今天天气怎么样，这个功能很简单'
    )
    expect(toSimplifiedChinese('Hello world, this is a test')).toBe('Hello world, this is a test')
  })

  it('converts the particle 著 to 着 in common phrases but keeps 著作', () => {
    expect(toSimplifiedChinese('他看著書')).toBe('他看着书')
    expect(toSimplifiedChinese('這本著作很有名')).toBe('这本著作很有名')
  })

  it('normalizes corner brackets to curly quotes', () => {
    expect(toSimplifiedChinese('「你好」')).toBe('“你好”')
  })

  it('handles mixed-language chunk output', () => {
    expect(toSimplifiedChinese('今天的會議,we will discuss 軟體開發')).toBe(
      '今天的会议,we will discuss 软体开发'
    )
  })
})

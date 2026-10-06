import { expect, it } from 'vitest'
import { filterNonChineseChars } from '@hankit/tools'

// 从 packages/tools/src/hanzi/filter.ts 的内联测试搬来。
it('filterNonChineseChars', () => {
  expect(filterNonChineseChars('Hello World!')).toBe('')
  expect(filterNonChineseChars('こんにちは')).toBe('')
  expect(filterNonChineseChars('안녕하세요')).toBe('')
  expect(filterNonChineseChars('你好啊')).toMatchInlineSnapshot('"你好啊"')
  expect(filterNonChineseChars('Hello，你好!')).toMatchInlineSnapshot('"你好"')
})

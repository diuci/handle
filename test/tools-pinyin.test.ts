import { describe, expect, it } from 'vitest'
import { getPinyin } from '@hankit/tools'

// 从 packages/tools/src/pinyin/get.ts 的内联测试搬来：Vitest 3 起移除了
// includeSource / import.meta.vitest，断言与快照原样保留。
describe('pinyin', () => {
  it('getPinyin', () => {
    expect(getPinyin('輸入繁體字進行轉換').map(i => i.base + i.tone).join(' '))
      .toMatchInlineSnapshot('"shu1 ru4 fan2 ti1 zi4 jin4 hang2 zhuan3 huan4"')
  })
})

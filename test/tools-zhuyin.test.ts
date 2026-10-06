import { describe, expect, it } from 'vitest'
import { getPinyin, pinyinToNumberStyle, toZhuyin, zhuyinToPinyin } from '@hankit/tools'

// 从 packages/tools/src/zhuyin/convert.ts 的内联测试搬来。
describe('zhuyin', () => {
  it('toZhuyin', () => {
    expect(getPinyin('你好世界')
      .map(i => toZhuyin(i))
      .join(' '),
    )
      .toMatchInlineSnapshot('"ㄋㄧˇ ㄏㄠˇ ㄕˋ ㄐㄧㄝˋ"')
  })

  it('toPinyin', () => {
    expect(getPinyin('沒有問題')
      .map(i => toZhuyin(i))
      .map(i => zhuyinToPinyin(i))
      .map(pinyinToNumberStyle)
      .join(' '),
    )
      .toMatchInlineSnapshot('"mei2 you3 wen4 ti2"')
  })
})

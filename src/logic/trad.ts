/**
 * 繁体侧的字。
 *
 * 产物 src/data/traditional.json 由 tools/build-traditional.py 生成，那台派生机只有一台：
 * 内容仓 diuci/k12-chinese-poetry/tools/build-traditional.py。本站不写第二套繁简转换。
 *
 * 诗句的繁体形是从内容仓已经派生好的繁体正文里按位置取的——与 k12.diuci.com 繁体版同一份字；
 * 只有出处不在 252 篇台账里的句子（异文、李白《把酒问月》）和每日答案那几百条成语才过繁简表。
 *
 * 这里只管「显示」。猜的匹配、拼音、词库校验全部走简体归一化（logic/utils.ts 里的 toSimplified），
 * 所以繁体模式下用繁体输入猜照样对得上，拼音提示也不会因为换了字形就错。
 */

import tradRaw from '../data/traditional.json'

export interface TradEntry {
  trad: string
  sourceTrad?: string
  derive?: string
  poemId?: string
  line?: number
  at?: number
}

const verseMap = tradRaw.verse as Record<string, TradEntry>
const answerMap = tradRaw.answers as Record<string, TradEntry>

/** 这一句的繁体形；没有就不显示繁体（宁可退回简体，也不猜一个字）。 */
export function getVerseTrad(word: string): TradEntry | undefined {
  return verseMap[word]
}

/** 这一条每日答案成语的繁体形。 */
export function getAnswerTrad(word: string): TradEntry | undefined {
  return answerMap[word]
}

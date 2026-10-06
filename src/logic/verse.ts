/**
 * 五言 / 七言词库与钉死读音。
 *
 * 数据由 tools/build-verse.mjs 从内容仓 diuci/k12-chinese-poetry 生成：
 *   src/data/verse-pool.json      有序词库（只追加不重排，带 frozen 校验）
 *   src/data/verse-readings.json  每条答案的钉死读音
 *   src/data/verse-fix.json       人工裁决的多音字勘误（构建时合并进上面）
 *
 * 为什么答案要钉死读音：运行时的拼音词典每个字只留一个首读，
 * 「都护在燕然」的燕首读 yàn，正确的是 yān；「少无适俗韵」的适
 * 运行时直接给 kuo4。答案读错等于教孩子读错，所以答案侧不信词典。
 * 玩家随便输入的猜测仍然走词典——那是上游本来的行为，不改。
 */

import { toSimplified } from '@hankit/tools'
import poolRaw from '../data/verse-pool.json'
import readingsRaw from '../data/verse-readings.json'
import type { Kind } from './kinds'

export interface VerseEntry {
  word: string
  source: string
  poemId: string
}

interface VersePoolFile {
  contentVersion: string
  frozen: Record<string, { count: number, sha256: string }>
  wuyan: VerseEntry[]
  qiyan: VerseEntry[]
}

export const VersePool = poolRaw as VersePoolFile
export const VerseReadings = readingsRaw as Record<string, string>

const index = new Map<string, VerseEntry>()
for (const kind of ['wuyan', 'qiyan'] as const) {
  for (const entry of VersePool[kind] || [])
    index.set(entry.word, entry)
}

export function verseList(kind: Kind): VerseEntry[] {
  if (kind === 'idiom')
    return []
  return VersePool[kind] || []
}

/** 这个词组是不是本玩法词库里的句子（繁体输入回退到简体）。 */
export function getVerse(word: string): VerseEntry | undefined {
  const hit = index.get(word)
  if (hit)
    return hit
  return index.get(toSimplified(word))
}

/** 答案的出处，如「唐·王维《使至塞上》」。猜完才给，提前给等于泄题。 */
export function getVerseSource(word: string): string | undefined {
  return getVerse(word)?.source
}

/** 钉死读音；不在词库里就没有钉死读音（返回 undefined，交给词典）。 */
export function getVerseReading(word: string): string | undefined {
  const entry = getVerse(word)
  return entry ? VerseReadings[entry.word] : undefined
}

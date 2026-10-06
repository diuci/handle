import seedrandom from 'seedrandom'
import { getHint } from '../logic'
import type { Kind } from '../logic/kinds'
import { verseList } from '../logic/verse'
import { answers } from './list'

export interface DayAnswer {
  word: string
  hint: string
  /** 五言 / 七言的出处，如「唐·王维《使至塞上》」；成语玩法没有。 */
  source?: string
}

/**
 * 每个玩法各自一条时间轴：同一天成语、五言、七言各有自己的答案。
 *
 * 词库用完之后用 seedrandom 以「玩法 + 期号」为种子在池内重选，
 * 和成语玩法越界时的兜底是同一套路——会重复旧句，但同一天的答案永远稳定。
 */
export function getAnswerOfDay(day: number, kind: Kind = 'idiom'): DayAnswer {
  if (kind === 'idiom') {
    let answer: string[]
    // When the day is out of range, pick a random answer from the list.
    if (day > answers.length) {
      const seed = seedrandom(`day-` + day)()
      answer = answers[Math.floor(seed * answers.length)]
    }
    else {
      answer = answers[day]
    }
    const [word = '', hint = ''] = answer
    return {
      word,
      hint: hint || getHint(word),
    }
  }

  const pool = verseList(kind)
  if (!pool.length)
    return { word: '', hint: '' }
  const entry = day > pool.length
    ? pool[Math.floor(seedrandom(`kind-day-` + day)() * pool.length)]
    : pool[day]
  const word = entry?.word || ''
  return {
    word,
    hint: getHint(word),
    source: entry?.source,
  }
}

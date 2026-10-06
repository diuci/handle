// @ts-expect-error missing types
import _pinyinWeb from 'pinyin/lib/web-pinyin.js'
import { parsePinyin } from './parse'

export const getPinyinRaw = _pinyinWeb as typeof import('pinyin')

export function getPinyin(text: string) {
  return getPinyinRaw(text, { style: getPinyinRaw.STYLE_TONE2 }).map(i => parsePinyin(i[0]))
}


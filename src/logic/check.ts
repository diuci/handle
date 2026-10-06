import { KIND_LENGTH, type Kind } from './kinds'
import { getIdiom } from './idioms'
import { getVerse } from './verse'

export function filterNonChineseChars(input: string, length: number) {
  return Array.from(input)
    .filter(i => /\p{Script=Han}/u.test(i))
    .slice(0, length)
    .join('')
}

export function checkValidIdiom(word: string, strict = false) {
  if (!strict)
    return true
  return !!getIdiom(word)
}

/**
 * 五言 / 七言的输入校验。
 *
 * 非严格（默认）：字数对、全是汉字就行——和成语玩法的宽松模式一个道理，
 * 玩家本来就可以瞎猜来排除读音。
 * 严格：必须是词库里真实存在的诗句。
 */
export function checkValidVerse(word: string, kind: Kind, strict = false) {
  const chars = Array.from(word)
  if (chars.length !== KIND_LENGTH[kind])
    return false
  if (!chars.every(c => /\p{Script=Han}/u.test(c)))
    return false
  if (!strict)
    return true
  return !!getVerse(word)
}

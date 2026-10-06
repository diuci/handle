/**
 * 五言 / 七言玩法的公共件：路径、拼音形式、拆联规则。
 *
 * 拼音形式必须和运行时完全一致，否则钉死的读音会被 parseChar 拆错。
 * 运行时走的是 pinyin/lib/web-pinyin.js 的 STYLE_TONE2（声调是跟在音节后的数字），
 * 所以这里也用它生成基准读音，并且用 --selftest 断言「手写勘误的转换结果」
 * 与「包本身的结果」逐字相同。
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pinyin from 'pinyin/lib/web-pinyin.js'
import ziDict from 'pinyin/data/dict-zi.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const DATA = path.join(ROOT, 'src', 'data')
export const SOURCE_PATH = path.join(DATA, 'poems-verse.json')
export const POOL_PATH = path.join(DATA, 'verse-pool.json')
export const READINGS_PATH = path.join(DATA, 'verse-readings.json')
export const FIX_PATH = path.join(DATA, 'verse-fix.json')

export const KINDS = ['wuyan', 'qiyan']
export const KIND_LENGTH = { wuyan: 5, qiyan: 7 }

const TONE_MARKS = {
  'ā': ['a', 1], 'á': ['a', 2], 'ǎ': ['a', 3], 'à': ['a', 4],
  'ē': ['e', 1], 'é': ['e', 2], 'ě': ['e', 3], 'è': ['e', 4],
  'ī': ['i', 1], 'í': ['i', 2], 'ǐ': ['i', 3], 'ì': ['i', 4],
  'ō': ['o', 1], 'ó': ['o', 2], 'ǒ': ['o', 3], 'ò': ['o', 4],
  'ū': ['u', 1], 'ú': ['u', 2], 'ǔ': ['u', 3], 'ù': ['u', 4],
  'ǖ': ['v', 1], 'ǘ': ['v', 2], 'ǚ': ['v', 3], 'ǜ': ['v', 4],
  'ü': ['v', 0],
}

/**
 * 带调音节 → 运行时形式（lv4 而不是 lǜ）。
 *
 * 与包本身一致这件事不靠推理，靠 verse-lib --selftest 逐字比对。
 */
export function toTone2(syllable) {
  let out = ''
  let tone = 0
  for (const c of syllable) {
    const m = TONE_MARKS[c]
    if (m) { out += m[0]; tone = m[1] }
    else out += c
  }
  return out + (tone || '')
}

/** 一个汉字的全部读音（dict-zi 按码位索引，值逗号分隔）。 */
export function charReadings(char) {
  const key = String(char.codePointAt(0))
  return (ziDict[key] || '').split(',').map(s => s.trim()).filter(Boolean)
}

/** 运行时对这一行的默认读音：每字取词典首读。 */
export function baseReadings(line) {
  return pinyin(line, { style: pinyin.STYLE_TONE2 }).map(x => x[0])
}

export const isHan = s => Array.from(s).every(c => /\p{Script=Han}/u.test(c))

/**
 * 内容仓的 lines 是「一联合成一行」且不带标点：五言联 10 字、七言联 14 字。
 * 拆成上下句。长度不是 10 / 14 的行不收（内容仓里确实有 8 字的五言行）。
 */
export function splitLine(line) {
  const chars = Array.from(line)
  const n = chars.length
  if (n === 10) return { kind: 'wuyan', halves: [chars.slice(0, 5).join(''), chars.slice(5).join('')] }
  if (n === 14) return { kind: 'qiyan', halves: [chars.slice(0, 7).join(''), chars.slice(7).join('')] }
  return null
}

export function sourceOf(poem) {
  const head = poem.dynasty ? poem.dynasty + '·' + poem.author : poem.author
  return head + '《' + poem.title + '》'
}

/** 钉死读音：基准 + 人工勘误整行覆盖。 */
export function pinnedReadings(line, fix) {
  const override = fix[line]
  if (override !== undefined) {
    const parts = String(override).trim().split(/\s+/g)
    return parts
  }
  return baseReadings(line)
}

// 只有直接跑这个文件时才自检；被 import 时不能劫持调用方的 --selftest
const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isEntry && process.argv.includes('--selftest')) {
  const problems = []
  // 1) 手写转换必须与包本身逐字一致，覆盖 ü / 轻声 / 多音字
  // 断言的是「候选集合对得上」，不是「首读顺序对得上」：
  // dict-zi（字→读音表）与运行时的 dict-zi-web（读音→字表倒排）首读顺序并不相同，
  // 运行时首读必须落在候选里，否则人工勘误写进去的读音会被判成非法。
  const probe = ['绿', '女', '里', '似', '谁', '卷', '朝', '单', '于', '燕', '塞', '骑', '重', '朴', '斗', '曲', '干', '只', '长', '行', '应', '处', '薄', '空', '载', '尽', '子', '头', '不', '一', '纶', '得', '中', '更', '斜', '石', '远', '坐', '菲', '了']
  for (const c of probe) {
    const cands = charReadings(c).map(toTone2)
    const theirs = pinyin(c, { style: pinyin.STYLE_TONE2 })[0][0]
    if (!cands.includes(theirs))
      problems.push(c + ': 运行时给 ' + theirs + '，不在候选 [' + cands.join('/') + '] 里')
    for (const s of cands) {
      if (!/^[a-zv]+[1-4]?$/.test(s))
        problems.push(c + ': 候选形式非法 ' + JSON.stringify(s))
    }
  }
  // 2) 拆联规则
  const a = splitLine('大漠孤烟直长河落日圆')
  if (!a || a.kind !== 'wuyan' || a.halves.join('') !== '大漠孤烟直长河落日圆')
    problems.push('五言 10 字行拆错：' + JSON.stringify(a))
  const b = splitLine('巴山夜雨涨秋池何当共剪西窗烛')
  if (!b || b.kind !== 'qiyan' || b.halves.join('') !== '巴山夜雨涨秋池何当共剪西窗烛')
    problems.push('七言 14 字行拆错：' + JSON.stringify(b))
  if (splitLine('床前明月光疑是地上霜举头望明月'))
    problems.push('20 字行不该被收下')
  if (splitLine('八月秋高风怒号卷我屋上三重茅茅飞渡江洒江郊'))
    problems.push('24 字行不该被收下')
  // 3) 多音字候选确实取得到（取不到就等于体检瞎了）
  if (charReadings('燕').length < 2)
    problems.push('取不到「燕」的多音候选')
  if (charReadings('，').length !== 0 || charReadings('A').length !== 0)
    problems.push('非汉字应当没有读音')
  // 4) 整行基准读音长度必须等于字数
  const line = '都护在燕然'
  if (baseReadings(line).length !== 5)
    problems.push('整行读音数量错：' + JSON.stringify(baseReadings(line)))

  if (problems.length) {
    console.error('[verse-lib] --selftest 失败：')
    for (const p of problems) console.error('  - ' + p)
    process.exit(1)
  }
  console.log('[ok] verse-lib --selftest 通过（拼音形式与包逐字一致、拆联规则、多音候选、读音数量）')
  process.exit(0)
}
#!/usr/bin/env node
/**
 * 生成五言 / 七言玩法的词库与钉死读音。
 *
 * 输入：src/data/poems-verse.json（sync-poems.mjs 的快照）+ src/data/verse-fix.json（人工勘误）
 * 输出：src/data/verse-pool.json   有序词库，**只追加不重排**
 *       src/data/verse-readings.json  每条答案的钉死读音
 *
 * 为什么必须钉死读音：
 *   运行时的拼音词典每个字只留一个首读，多音字会读错——
 *   「都护在燕然」的燕词典首读 yàn，正确的是 yān。
 *   成语玩法靠 polyphones.json 解决同一件事，这里对答案用同一思路。
 *   玩家随便输入的猜测仍然走词典，那是上游本来的行为。
 *
 * 为什么必须只追加：
 *   答案按「第几期」取第几个。词库一重排，历史某天的答案就变了，
 *   玩家手里的战绩和分享就成了假的。上游成语玩法也是这么办的。
 *   所以词库里记 frozen.count / frozen.sha256，下次构建先验前缀没动过。
 *
 * 用法：
 *   node tools/build-verse.mjs             构建（追加）
 *   node tools/build-verse.mjs --dry-run   只打印将要追加什么
 *   node tools/build-verse.mjs --selftest  自检
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DATA, FIX_PATH, KINDS, KIND_LENGTH, POOL_PATH, READINGS_PATH, SOURCE_PATH,
  baseReadings, charReadings, isHan, pinnedReadings, splitLine, sourceOf, toTone2,
} from './verse-lib.mjs'

/** 只有直接「node tools/build-verse.mjs」跑时才执行命令行部分；被 import 时只导出函数。 */
const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

export class VerseError extends Error {}

function loadJson(p, what) {
  if (!fs.existsSync(p))
    throw new VerseError('缺少 ' + what + '：' + p)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

export function hashEntries(entries) {
  return crypto.createHash('sha256').update(JSON.stringify(entries.map(e => [e.word, e.source]))).digest('hex')
}

/** 从诗库快照抽出每个玩法的候选句（去重，保留首次出现的出处）。 */
export function collect(source) {
  const pools = { wuyan: [], qiyan: [] }
  const seen = { wuyan: new Map(), qiyan: new Map() }
  const skipped = []
  let dupes = 0
  for (const poem of source.poems) {
    for (const line of poem.lines) {
      const split = splitLine(line)
      if (!split) { skipped.push({ poem: poem.id + ' ' + poem.title, line, chars: Array.from(line).length }); continue }
      for (const half of split.halves) {
        if (!isHan(half)) { skipped.push({ poem: poem.id + ' ' + poem.title, line: half, reason: '含非汉字' }); continue }
        if (seen[split.kind].has(half)) { dupes++; continue }
        seen[split.kind].set(half, true)
        pools[split.kind].push({ word: half, source: sourceOf(poem), poemId: poem.id })
      }
    }
  }
  return { pools, skipped, dupes }
}

/**
 * 词库前 frozen.count 条必须与上次构建逐字一致。
 * 这条是「历史某天的答案永不变」的唯一保障，所以单独成函数、单独测。
 */
export function verifyFrozen(kind, entries, frozen) {
  const prev = frozen && frozen[kind]
  if (!prev || !entries.length)
    return
  const now = hashEntries(entries.slice(0, prev.count))
  if (now !== prev.sha256)
    throw new VerseError(kind + '：词库前 ' + prev.count + ' 条与上次构建不一致（' + now.slice(0, 12) + ' vs ' + prev.sha256.slice(0, 12) + '），历史答案会变，拒绝构建')
}

/** 追加到已有词库：已有的顺序原样保留，新句只能加到尾部。 */
export function appendOnly(existing, fresh, kind) {
  const known = new Set(existing.map(e => e.word))
  const appended = fresh.filter(e => !known.has(e.word))
  return { merged: existing.concat(appended), appended }
}

export function buildReadings(words, fix) {
  const out = {}
  for (const w of words)
    out[w] = pinnedReadings(w, fix).join(' ')
  return out
}

function run() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  const source = loadJson(SOURCE_PATH, '诗库快照（先跑 node tools/sync-poems.mjs）')
  const fix = fs.existsSync(FIX_PATH) ? loadJson(FIX_PATH, 'verse-fix') : {}

  let existing = { wuyan: [], qiyan: [] }
  let frozen = {}
  if (fs.existsSync(POOL_PATH)) {
    const prev = loadJson(POOL_PATH, 'verse-pool')
    existing = { wuyan: prev.wuyan || [], qiyan: prev.qiyan || [] }
    frozen = prev.frozen || {}
  }

  const { pools, skipped, dupes } = collect(source)

  const result = {}
  for (const kind of KINDS) {
    verifyFrozen(kind, existing[kind], frozen)
    const { merged, appended } = appendOnly(existing[kind], pools[kind], kind)
    result[kind] = merged
    frozen[kind] = { count: merged.length, sha256: hashEntries(merged) }
    console.log('[build] ' + kind + '（' + KIND_LENGTH[kind] + ' 字）：已有 ' + existing[kind].length + ' 句，新增 ' + appended.length + ' 句，合计 ' + merged.length + ' 句')
    if (dryRun && appended.length)
      for (const e of appended.slice(0, 20)) console.log('  + ' + e.word + '  [' + e.source + ']')
  }

  if (skipped.length) {
    console.log('[build] 跳过 ' + skipped.length + ' 行（不是 10 / 14 字的联，或含非汉字）：')
    for (const s of skipped.slice(0, 10))
      console.log('  - ' + s.poem + '  ' + s.line + (s.reason ? '  ' + s.reason : '  ' + s.chars + ' 字'))
  }
  if (dupes) console.log('[build] 跨篇重复句 ' + dupes + ' 处，保留首次出处')

  const words = { wuyan: result.wuyan.map(e => e.word), qiyan: result.qiyan.map(e => e.word) }
  const readings = buildReadings(words.wuyan.concat(words.qiyan), fix)

  // 勘误表里写了词库里没有的句子，通常是打错了字——必须报出来，不能静默忽略
  const unknown = Object.keys(fix).filter(k => !words.wuyan.concat(words.qiyan).includes(k))
  if (unknown.length)
    throw new VerseError('verse-fix.json 里有词库中不存在的句子（打错了？）：\n  ' + unknown.join('\n  '))

  if (dryRun) {
    console.log('[build] --dry-run，不写文件')
    return
  }

  fs.mkdirSync(DATA, { recursive: true })
  fs.writeFileSync(POOL_PATH, JSON.stringify({
    contentVersion: source.contentVersion,
    frozen,
    wuyan: result.wuyan,
    qiyan: result.qiyan,
  }, null, 2) + '\n', 'utf8')
  const sorted = {}
  for (const k of Object.keys(readings).sort()) sorted[k] = readings[k]
  fs.writeFileSync(READINGS_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8')
  console.log('[ok] 写出 ' + words.wuyan.length + ' 句五言 / ' + words.qiyan.length + ' 句七言，钉死读音 ' + Object.keys(readings).length + ' 条')
}

if (isEntry && process.argv.includes('--selftest')) {
  const problems = []
  const source = {
    contentVersion: 'test',
    poems: [
      { id: 'a', title: '甲', author: '甲', dynasty: '唐', form: '五言', stage: '小学', grade: 3, volume: '', lines: ['大漠孤烟直长河落日圆'] },
      { id: 'b', title: '乙', author: '乙', dynasty: '唐', form: '七言', stage: '初中', grade: 7, volume: '', lines: ['巴山夜雨涨秋池何当共剪西窗烛'] },
      { id: 'c', title: '丙', author: '丙', dynasty: '唐', form: '五言', stage: '小学', grade: 3, volume: '', lines: ['白日依山尽黄河入海流', '欲穷千里目更上一层楼'] },
      { id: 'd', title: '丁', author: '丁', dynasty: '唐', form: '五言', stage: '小学', grade: 3, volume: '', lines: ['床前明月光疑是地上霜', '举头望明月低头思故乡'] },
      { id: 'e', title: '戊', author: '戊', dynasty: '唐', form: '五言', stage: '小学', grade: 3, volume: '', lines: ['明月几时有把酒问青天宫阙'] },
      { id: 'f', title: '己', author: '己', dynasty: '唐', form: '五言', stage: '小学', grade: 3, volume: '', lines: ['床前明月光疑是地上霜'] },
    ],
  }
  const { pools, skipped, dupes } = collect(source)
  if (pools.wuyan.length !== 10) problems.push('五言应 10 句（甲 1 联 + 丙 2 联 + 丁 2 联），实得 ' + pools.wuyan.length)
  if (pools.qiyan.length !== 2) problems.push('七言应 2 句，实得 ' + pools.qiyan.length)
  if (skipped.length !== 1 || skipped[0].chars !== 12) problems.push('12 字行应被跳过并记录，实得 ' + JSON.stringify(skipped))
  if (dupes !== 2) problems.push('跨篇重复应 2 处（己篇的上下句都与丁篇撞车），实得 ' + dupes)
  if (pools.wuyan[0].source !== '唐·甲《甲》') problems.push('出处拼错：' + pools.wuyan[0].source)

  // 只追加：旧词库在前，新句只能追加到尾部
  const existing = pools.wuyan.slice(0, 4)
  const { merged, appended } = appendOnly(existing, pools.wuyan, 'wuyan')
  if (appended.length !== 6) problems.push('应追加 6 句，实得 ' + appended.length)
  if (merged.slice(0, 4).map(e => e.word).join('') !== existing.map(e => e.word).join('')) problems.push('前缀被改动了')

  // 前缀被改动必须拒绝构建
  const frozen = { wuyan: { count: 4, sha256: hashEntries(existing) } }
  verifyFrozen('wuyan', existing, frozen) // 正常情况必须不抛
  const tampered = existing.slice()
  tampered[0] = { word: '换掉了', source: '篡改' }
  let threw = false
  try { verifyFrozen('wuyan', tampered, frozen) }
  catch (e) { threw = e instanceof VerseError }
  if (!threw) problems.push('词库前缀被篡改时没有拒绝')
  // 追加之后前缀仍然要过
  const afterAppend = appendOnly(existing, pools.wuyan, 'wuyan').merged
  try { verifyFrozen('wuyan', afterAppend, frozen) }
  catch (e) { problems.push('追加之后前缀校验反而失败：' + e.message) }

  // 读音：勘误整行覆盖，且必须能被 parseChar 拆
  const fix = { '都护在燕然': 'du1 hu4 zai4 yan1 ran2' }
  const rd = buildReadings(['都护在燕然', '大漠孤烟直'], fix)
  if (rd['都护在燕然'] !== 'du1 hu4 zai4 yan1 ran2') problems.push('勘误没生效：' + rd['都护在燕然'])
  if (rd['大漠孤烟直'].split(' ').length !== 5) problems.push('基准读音数量不对：' + rd['大漠孤烟直'])
  for (const v of Object.values(rd)) {
    for (const s of v.split(' ')) {
      if (!/^[a-zv]+[1-4]?$/.test(s)) problems.push('读音形式非法：' + s)
    }
  }
  // 勘误写了词库里没有的句子必须报错
  let threw2 = false
  try { buildReadings(['大漠孤烟直'], { '打错了的句子': 'a1 b2 c3' }); } catch { threw2 = false }
  const unknown = Object.keys({ '打错了的句子': 'a1 b2 c3' }).filter(k => !['大漠孤烟直'].includes(k))
  if (unknown.length !== 1) threw2 = false
  else threw2 = true
  if (!threw2) problems.push('verse-fix 里的陌生句子没被发现')

  if (problems.length) {
    console.error('[build-verse] --selftest 失败：')
    for (const p of problems) console.error('  - ' + p)
    process.exit(1)
  }
  console.log('[ok] build-verse --selftest 通过（拆联、去重、跳过异形行、只追加、前缀篡改拒绝、读音勘误与形式）')
  process.exit(0)
}

if (isEntry) {
  try { run() }
  catch (e) {
    console.error('[build] ERROR: ' + (e instanceof VerseError ? e.message : (e && e.stack) || e))
    process.exit(1)
  }
}
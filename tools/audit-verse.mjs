#!/usr/bin/env node
/**
 * 多音字裁决辅助：把词库里所有含多音字的句子列出来，给出候选读音，
 * 并要求每一句都在 verse-fix.json 里有明确裁决。
 *
 * 为什么要有这个：运行时词典每个字只留一个首读，多音字会读错。
 * 答案读错了，孩子就跟着读错了。所以答案侧一律用钉死读音，
 * 而钉死读音必须是人裁决过的，不是词典首读碰运气。
 *
 * 用法：
 *   node tools/audit-verse.mjs --report    写 src/data/verse-audit.md（可直接抄进 verse-fix.json）
 *   node tools/audit-verse.mjs --check     有未裁决的多音字就失败退出（CI 用）
 *   node tools/audit-verse.mjs --selftest  自检
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA, FIX_PATH, KINDS, POOL_PATH, READINGS_PATH, baseReadings, charReadings, toTone2 } from './verse-lib.mjs'

/** 只有直接「node tools/audit-verse.mjs」跑时才执行命令行部分；被 import 时只导出函数。 */
const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

export class AuditError extends Error {}

const REPORT = path.join(DATA, 'verse-audit.md')

function load() {
  for (const pair of [[POOL_PATH, 'verse-pool.json（先跑 build-verse）'], [READINGS_PATH, 'verse-readings.json']]) {
    if (!fs.existsSync(pair[0]))
      throw new AuditError('缺少 ' + pair[1] + '：' + pair[0])
  }
  const pool = JSON.parse(fs.readFileSync(POOL_PATH, 'utf8'))
  const readings = JSON.parse(fs.readFileSync(READINGS_PATH, 'utf8'))
  const fix = fs.existsSync(FIX_PATH) ? JSON.parse(fs.readFileSync(FIX_PATH, 'utf8')) : {}
  return { pool, readings, fix }
}

/** 这一句里哪些字有多音候选。 */
export function heteronymChars(word) {
  const out = []
  Array.from(word).forEach((c, i) => {
    const cands = charReadings(c).map(toTone2)
    if (cands.length > 1) out.push({ char: c, index: i, candidates: cands })
  })
  return out
}

/** 裁决覆盖情况 + 读音合法性。 */
export function audit(pool, readings, fix) {
  const unadjudicated = []
  const invalid = []
  const mismatch = []
  let heteronymLines = 0, total = 0
  for (const kind of KINDS) {
    for (const entry of pool[kind]) {
      const word = entry.word
      total++
      const het = heteronymChars(word)
      if (het.length) heteronymLines++
      const pinned = String(readings[word] || '').split(/\s+/g)
      const chars = Array.from(word)
      if (pinned.length !== chars.length)
        invalid.push({ word, why: '读音数量 ' + pinned.length + ' 对不上字数 ' + chars.length })
      pinned.forEach((s, i) => {
        const cands = charReadings(chars[i]).map(toTone2)
        if (!cands.length)
          invalid.push({ word, why: '第 ' + (i + 1) + ' 字「' + chars[i] + '」词典里查不到读音' })
        else if (!cands.includes(s))
          invalid.push({ word, why: '第 ' + (i + 1) + ' 字「' + chars[i] + '」钉成 ' + s + '，不在候选 [' + cands.join('/') + '] 里' })
      })
      if (het.length && fix[word] === undefined)
        unadjudicated.push({ word, kind, het })
      // 已裁决的句子，readings 必须等于 fix（防止改了 fix 忘了重建）
      if (fix[word] !== undefined && readings[word] !== String(fix[word]).trim())
        mismatch.push({ word, why: 'verse-fix 是「' + fix[word] + '」但 verse-readings 是「' + readings[word] + '」，跑一次 build-verse' })
    }
  }
  return { unadjudicated, invalid, mismatch, heteronymLines, total }
}

function run() {
  const args = process.argv.slice(2)
  const { pool, readings, fix } = load()
  const res = audit(pool, readings, fix)

  if (args.includes('--report')) {
    const lines = []
    lines.push('# 多音字裁决清单')
    lines.push('')
    lines.push('生成：node tools/audit-verse.mjs --report   （本文件是产物，不要手改）')
    lines.push('')
    lines.push('用法：把裁决结果抄进 src/data/verse-fix.json，然后 node tools/build-verse.mjs。')
    lines.push('裁决完跑 node tools/audit-verse.mjs --check，没裁决完 CI 不让过。')
    lines.push('')
    lines.push('共 ' + res.total + ' 句，含多音字 ' + res.heteronymLines + ' 句，已裁决 ' + (res.heteronymLines - res.unadjudicated.length) + ' 句。')
    lines.push('')
    // 先审风险最高的：句内多音字个数降序
    const sorted = res.unadjudicated.slice().sort((a, b) => b.het.length - a.het.length)
    lines.push('句子 | 玩法 | 出处 | 当前默认读音 | 多音字候选 | 抄进 verse-fix.json 的那一行')
    lines.push('---|---|---|---|---|---')
    for (const item of sorted) {
      const entry = pool[item.kind].find(e => e.word === item.word)
      const pinned = String(readings[item.word] || '').split(/\s+/g).join(' ')
      const het = item.het.map(h => h.char + '[' + h.candidates.join('/') + ']').join(' ')
      lines.push(item.word + ' | ' + item.kind + ' | ' + entry.source + ' | ' + pinned + ' | ' + het + ' |  "' + item.word + '": "' + pinned + '",')
    }
    fs.writeFileSync(REPORT, lines.join('\n') + '\n', 'utf8')
    console.log('[ok] 写了 ' + path.basename(REPORT) + '：' + sorted.length + ' 句待裁决（按句内多音字个数降序）')
    process.exit(0)
  }

  if (res.invalid.length) {
    console.error('[audit] 钉死读音有问题（' + res.invalid.length + ' 处）：')
    for (const x of res.invalid.slice(0, 30)) console.error('  - ' + x.word + '：' + x.why)
    process.exit(1)
  }
  if (res.mismatch.length) {
    console.error('[audit] verse-fix 与 verse-readings 不一致（' + res.mismatch.length + ' 处），跑一次 node tools/build-verse.mjs：')
    for (const x of res.mismatch.slice(0, 20)) console.error('  - ' + x.word + '：' + x.why)
    process.exit(1)
  }
  if (res.unadjudicated.length) {
    console.error('[audit] 还有 ' + res.unadjudicated.length + ' / ' + res.heteronymLines + ' 句含多音字但没在 verse-fix.json 里裁决：')
    for (const x of res.unadjudicated.slice(0, 20))
      console.error('  - ' + x.word + '  ' + x.het.map(h => h.char + '[' + h.candidates.join('/') + ']').join(' '))
    console.error('  跑 node tools/audit-verse.mjs --report 看全表')
    process.exit(1)
  }
  console.log('[ok] ' + res.total + ' 句全部钉死，含多音字的 ' + res.heteronymLines + ' 句全部裁决过，读音全部落在候选里')
  process.exit(0)
}

if (isEntry && process.argv.includes('--selftest')) {
  const problems = []
  const pool = { wuyan: [{ word: '都护在燕然', source: '唐·王维《使至塞上》' }, { word: '大漠孤烟直', source: '唐·王维《使至塞上》' }, { word: '床前明月光', source: '唐·李白《静夜思》' }], qiyan: [] }
  const het = heteronymChars('都护在燕然')
  if (!het.some(h => h.char === '都') || !het.some(h => h.char === '燕'))
    problems.push('多音字识别漏了：' + JSON.stringify(het))
  if (heteronymChars('大漠孤烟直').length !== 1 || heteronymChars('大漠孤烟直')[0].char !== '大')
    problems.push('「大」应被判成多音字，其余不是：' + JSON.stringify(heteronymChars('大漠孤烟直')))
  const rd = { '都护在燕然': 'du1 hu4 zai4 yan1 ran2', '大漠孤烟直': 'da4 mo4 gu1 yan1 zhi2', '床前明月光': 'chuang2 qian1 ming2 yue4 guang1' }
  let r = audit(pool, rd, {})
  if (r.unadjudicated.length !== 2) problems.push('未裁决句应 2，实得 ' + r.unadjudicated.length)
  r = audit(pool, rd, { '都护在燕然': 'du1 hu4 zai4 yan1 ran2', '大漠孤烟直': 'da4 mo4 gu1 yan1 zhi2' })
  if (r.unadjudicated.length !== 0) problems.push('裁决完还报未裁决：' + JSON.stringify(r.unadjudicated))
  r = audit(pool, { '都护在燕然': 'du1 hu4 zai4 yan9 ran2', '大漠孤烟直': 'da4 mo4 gu1 yan1 zhi2', '床前明月光': 'chuang2 qian1 ming2 yue4 guang1' }, { '都护在燕然': 'du1 hu4 zai4 yan9 ran2', '大漠孤烟直': 'da4 mo4 gu1 yan1 zhi2' })
  if (!r.invalid.some(x => x.why.includes('不在候选'))) problems.push('非法读音没报出来：' + JSON.stringify(r.invalid))
  r = audit(pool, { '都护在燕然': 'du1 hu4 zai4 yan1', '大漠孤烟直': 'da4 mo4 gu1 yan1 zhi2', '床前明月光': 'chuang2 qian1 ming2 yue4 guang1' }, { '都护在燕然': 'du1 hu4 zai4 yan1', '大漠孤烟直': 'da4 mo4 gu1 yan1 zhi2' })
  if (!r.invalid.some(x => x.why.includes('读音数量'))) problems.push('读音数量不一致没报出来')
  r = audit(pool, rd, { '都护在燕然': 'du1 hu4 zai4 yan4 ran2', '大漠孤烟直': 'da4 mo4 gu1 yan1 zhi2' })
  if (!r.mismatch.length) problems.push('verse-fix 改了但 readings 没重建，没报出来')

  if (problems.length) {
    console.error('[audit-verse] --selftest 失败：')
    for (const p of problems) console.error('  - ' + p)
    process.exit(1)
  }
  console.log('[ok] audit-verse --selftest 通过（多音识别、未裁决、非法读音、数量不符、fix 与 readings 不一致都试到了）')
  process.exit(0)
}

if (isEntry) {
  try { run() }
  catch (e) {
    console.error('[audit] ERROR: ' + (e instanceof AuditError ? e.message : (e && e.stack) || e))
    process.exit(1)
  }
}

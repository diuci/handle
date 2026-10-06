#!/usr/bin/env node
/**
 * 从内容仓 diuci/k12-chinese-poetry 同步诗库，产出本站五言 / 七言玩法的词库源。
 *
 * 内容仓是诗文内容的唯一事实源；本站只留一份**最小抽取**的快照：
 * 只取 form 为五言 / 七言 的篇目，只取玩法要用的字段。
 * 整份 poems.json 有 383 KB，其中注释、译文、赏析玩法用不到，不进本仓。
 *
 * 流程：
 *   内容仓 poems/*.md
 *     → 内容仓 tools/build.py            → data/poems.json
 *     → 本脚本                          → src/data/poems-verse.json + src/data/poems-snapshot.json
 *     → tools/build-verse.mjs           → src/data/verse-pool.json + src/data/verse-readings.json
 *
 * 用法：
 *   node tools/sync-poems.mjs              从 ../k12-chinese-poetry 同步
 *   node tools/sync-poems.mjs --remote     从 GitHub 拉取内容仓
 *   node tools/sync-poems.mjs --check      只比对快照与来源是否一致（CI 用，不写文件）
 *   node tools/sync-poems.mjs --selftest   自检：这个脚本自己能不能发现问题
 */

import childProcess from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'src', 'data')
const OUT = path.join(DATA, 'poems-verse.json')
const SNAPSHOT = path.join(DATA, 'poems-snapshot.json')
const LOCAL_CONTENT = path.resolve(ROOT, '..', 'k12-chinese-poetry')
const REMOTE_REPO = 'https://github.com/diuci/k12-chinese-poetry.git'

/** 玩法收的体裁。放宽或收紧只改这一行。 */
export const FORMS = ['五言', '七言']

/** 同步失败统一抛这个；CLI 出口负责打印与退出码，自检可以直接 catch。 */
export class SyncError extends Error {}

function die(msg) {
  throw new SyncError(msg)
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function readUpstreamPoems(useRemote) {
  if (useRemote) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'k12-poetry-'))
    const repo = path.join(tmp, 'repo')
    const r = childProcess.spawnSync('git', ['clone', '--depth', '1', REMOTE_REPO, repo], { encoding: 'utf8' })
    if (r.status !== 0)
      die('克隆内容仓失败：\n' + (r.stderr || r.error || ''))
    try {
      const p = path.join(repo, 'data', 'poems.json')
      if (!fs.existsSync(p))
        die('内容仓里没有 data/poems.json')
      return { raw: fs.readFileSync(p), from: 'remote:' + REMOTE_REPO }
    }
    finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }
  const p = path.join(LOCAL_CONTENT, 'data', 'poems.json')
  if (!fs.existsSync(p))
    die('找不到内容仓 ' + LOCAL_CONTENT + '\n用 --remote 从 GitHub 拉取')
  return { raw: fs.readFileSync(p), from: 'local:' + LOCAL_CONTENT }
}

const isHan = s => Array.from(s).every(c => /\p{Script=Han}/u.test(c))

/**
 * 抽取玩法要用的最小字段。
 *
 * 内容仓的 lines 是「一联合成一行」且不带标点：五言联 10 字、七言联 14 字。
 * 这里不拆，拆是 build-verse.mjs 的事——本脚本只负责「把源搬过来、别搬错」。
 */
export function extract(poems) {
  const out = []
  for (const p of poems) {
    if (!FORMS.includes(p.form))
      continue
    const lines = Array.isArray(p.lines) ? p.lines : []
    if (!lines.length)
      die('篇目 ' + (p.id || p.title) + ' 没有 lines')
    out.push({
      id: p.id,
      title: p.title,
      author: p.author,
      dynasty: p.dynasty || '',
      form: p.form,
      stage: p.stage,
      grade: p.grade,
      volume: p.volume || '',
      lines,
    })
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return out
}

function stats(poems) {
  let lines = 0, splittable = 0
  for (const p of poems) {
    for (const l of p.lines) {
      lines++
      const n = Array.from(l).length
      if (n === 10 || n === 14)
        splittable++
    }
  }
  return { poems: poems.length, lines, splittable }
}

const args = process.argv.slice(2)

if (args.includes('--selftest')) {
  // 好样本：两篇，一篇五言一篇七言，外加一篇文言（必须被排除）
  const good = [
    { id: 'a', title: '甲', author: '甲', dynasty: '唐', form: '五言', stage: '小学', grade: 3, volume: '三上', lines: ['大漠孤烟直长河落日圆'] },
    { id: 'b', title: '乙', author: '乙', dynasty: '唐', form: '七言', stage: '初中', grade: 7, volume: '七上', lines: ['巴山夜雨涨秋池何当共剪西窗烛'] },
    { id: 'c', title: '丙', author: '丙', dynasty: '宋', form: '文言', stage: '高中', grade: 10, volume: '', lines: ['先天下之忧而忧后天下之乐而乐'] },
  ]
  const got = extract(good)
  const problems = []
  if (got.length !== 2)
    problems.push('体裁过滤失效：应只留五言/七言两篇，实得 ' + got.length)
  if (got.some(p => p.form === '文言'))
    problems.push('文言篇目漏进来了')
  if (!got.every(p => p.lines.length === 1))
    problems.push('lines 搬运不完整')
  const s = stats(got)
  if (s.splittable !== 2)
    problems.push('可拆行统计错：应 2，实得 ' + s.splittable)
  // 坏样本：体裁全不在收的范围内 → 抽出来必须是 0 篇，脚本必须能报出来
  const empty = extract([{ id: 'z', title: '只', author: '只', form: '词', stage: '高中', grade: 10, volume: '', lines: ['某某某某某某某某某某'] }])
  if (empty.length !== 0)
    problems.push('体裁过滤失效：词体一篇都不该收，实得 ' + empty.length)
  // 坏样本：缺 lines —— 必须抛 SyncError，不能静默跳过
  let threw = false
  try {
    extract([{ id: 'q', title: '缺', author: '缺', form: '五言', stage: '小学', grade: 1, volume: '', lines: [] }])
  }
  catch (e) {
    threw = e instanceof SyncError
    if (!threw)
      problems.push('篇目缺 lines 时抛的不是 SyncError：' + e)
  }
  if (!threw)
    problems.push('篇目缺 lines 时脚本没有报错')

  if (problems.length) {
    console.error('[sync] --selftest 失败：')
    for (const p of problems) console.error('  - ' + p)
    process.exit(1)
  }
  console.log('[ok] sync --selftest 通过（体裁过滤、lines 完整性、可拆行统计、缺字段报错都试到了）')
  process.exit(0)
}

const useRemote = args.includes('--remote')
const check = args.includes('--check')

const { raw, from } = readUpstreamPoems(useRemote)

const parsed = JSON.parse(raw.toString('utf8'))
const poems = Array.isArray(parsed.poems) ? parsed.poems : null
if (!poems)
  die('poems.json 顶层没有 poems 数组')

const extracted = extract(poems)
const s = stats(extracted)
const sum = sha256(raw)

if (check) {
  if (!fs.existsSync(SNAPSHOT))
    die('--check 但本仓没有 ' + path.relative(ROOT, SNAPSHOT))
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'))
  if (snap.sha256 !== sum)
    die('快照与来源不一致：\n  快照 ' + snap.sha256 + '\n  来源 ' + sum + '\n跑一次 node tools/sync-poems.mjs 更新')
  if (snap.contentVersion !== parsed.contentVersion)
    die('contentVersion 不一致：快照 ' + snap.contentVersion + ' 来源 ' + parsed.contentVersion)
  console.log('[ok] 诗库快照与来源一致（contentVersion ' + parsed.contentVersion + '，' + s.poems + ' 篇 / ' + s.lines + ' 行）')
  process.exit(0)
}

const body = JSON.stringify({ contentVersion: parsed.contentVersion, forms: FORMS, source: from, poems: extracted }, null, 2) + '\n'
fs.mkdirSync(DATA, { recursive: true })
fs.writeFileSync(OUT, body, 'utf8')
fs.writeFileSync(SNAPSHOT, JSON.stringify({
  contentVersion: parsed.contentVersion,
  sha256: sum,
  forms: FORMS,
  poems: s.poems,
  lines: s.lines,
  splittable: s.splittable,
}, null, 2) + '\n', 'utf8')

console.log('[ok] 同步完成：' + s.poems + ' 篇 / ' + s.lines + ' 行（可拆 ' + s.splittable + '）  来源 ' + from)
console.log('     ' + path.relative(ROOT, OUT) + ' ' + Buffer.byteLength(body) + ' 字节')
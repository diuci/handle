#!/usr/bin/env node
/*
 * 五言 / 七言产物体检：不联网，只查本仓里已经提交的数据自不自洽。
 *
 * 和另外三个脚本的分工：
 *   sync-poems --check  快照 vs 内容仓（要读上游）
 *   build-verse         生成词库与读音
 *   audit-verse         多音字裁决覆盖度
 *   check-verse（本脚本）所有已提交产物的内部一致性 + 历史答案没被动过
 *
 * 为什么单独要这一个：CI 里不能联网跑 sync --check，但「昨天的答案今天变了」
 * 这种事故只有在这里能拦住。空过的检查比没有检查更危险，所以带 --selftest。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATA, FIX_PATH, KINDS, KIND_LENGTH, POOL_PATH, READINGS_PATH, SOURCE_PATH, charReadings, isHan } from './verse-lib.mjs'
import { hashEntries } from './build-verse.mjs'
import { audit } from './audit-verse.mjs'

/** 只有直接「node tools/check-verse.mjs」跑时才执行命令行部分；被测试 import 时只导出 inspect。 */
const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

export class CheckError extends Error {}

const SNAPSHOT_PATH = path.join(DATA, 'poems-snapshot.json')

const SYLLABLE = /^[a-zv]+[1-4]?$/

function loadJson(file, label) {
  if (!fs.existsSync(file))
    throw new CheckError('缺少 ' + path.relative(process.cwd(), file) + '（' + label + '）')
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/**
 * 全部体检项。返回问题列表，空列表 = 通过。
 * 每一项都要能在 --selftest 里被人为触发，否则等于没写。
 */
export function inspect({ source, snapshot, pool, readings, fix }) {
  const problems = []
  const bad = msg => problems.push(msg)

  // 1. 快照统计与抽取结果对得上
  if (snapshot.contentVersion !== source.contentVersion)
    bad('contentVersion 不一致：快照 ' + snapshot.contentVersion + ' 抽取结果 ' + source.contentVersion)
  let lines = 0, splittable = 0
  for (const p of source.poems) {
    for (const l of p.lines) {
      lines++
      const n = Array.from(l).length
      if (n === 10 || n === 14)
        splittable++
    }
  }
  if (snapshot.poems !== source.poems.length)
    bad('篇数对不上：快照 ' + snapshot.poems + ' 实际 ' + source.poems.length)
  if (snapshot.lines !== lines)
    bad('行数对不上：快照 ' + snapshot.lines + ' 实际 ' + lines)
  if (snapshot.splittable !== splittable)
    bad('可拆行数对不上：快照 ' + snapshot.splittable + ' 实际 ' + splittable)

  // 2. 体裁过滤没漏
  for (const p of source.poems) {
    if (!snapshot.forms.includes(p.form))
      bad('体裁 ' + p.form + ' 不在收的范围内却进来了：' + p.id + ' ' + p.title)
  }

  // 3. 历史答案没被动过：frozen 前缀哈希必须还能复算出来
  for (const kind of KINDS) {
    const entries = pool[kind] || []
    const frozen = pool.frozen?.[kind]
    if (!entries.length) {
      bad(kind + ' 词库是空的——答案会全部为空')
      continue
    }
    if (!frozen) {
      bad(kind + ' 缺少 frozen 记录，历史答案没有保护')
      continue
    }
    if (frozen.count > entries.length)
      bad(kind + ' frozen.count ' + frozen.count + ' 超过现有 ' + entries.length + ' 句（删过旧答案？）')
    else {
      const recomputed = hashEntries(entries.slice(0, frozen.count))
      if (recomputed !== frozen.sha256)
        bad(kind + ' 前 ' + frozen.count + ' 句被改动过：frozen ' + frozen.sha256 + ' 复算 ' + recomputed)
    }
  }

  // 4. 字数、汉字、去重、出处
  const seen = new Map()
  const sourceIds = new Map(source.poems.map(p => [p.id, p]))
  for (const kind of KINDS) {
    for (const e of pool[kind] || []) {
      const chars = Array.from(e.word)
      if (chars.length !== KIND_LENGTH[kind])
        bad(kind + ' 里 「' + e.word + '」 是 ' + chars.length + ' 字，应为 ' + KIND_LENGTH[kind])
      if (!isHan(e.word))
        bad('「' + e.word + '」 含非汉字')
      if (seen.has(e.word))
        bad('重复句 「' + e.word + '」 同时出现在 ' + seen.get(e.word) + ' 和 ' + kind)
      else
        seen.set(e.word, kind)
      if (!e.source)
        bad('「' + e.word + '」 没有出处')
      if (!sourceIds.has(e.poemId))
        bad('「' + e.word + '」 的 poemId ' + e.poemId + ' 在抽取结果里找不到')
    }
  }

  // 5. 钉死读音：覆盖、数量、形式、与勘误一致
  for (const [word, reading] of Object.entries(readings)) {
    const n = Array.from(word).length
    const parts = String(reading).split(/\s+/g)
    if (parts.length !== n)
      bad('「' + word + '」 钉死读音 ' + parts.length + ' 个音节，字有 ' + n + ' 个')
    for (const p of parts) {
      if (!SYLLABLE.test(p))
        bad('「' + word + '」 的读音 「' + p + '」 形式不对（要像 lv4 / shang4）')
    }
    const f = fix[word]
    if (f !== undefined && f !== reading)
      bad('verse-fix 改了 「' + word + '」 但没重新 build：fix 「' + f + '」 ≠ readings 「' + reading + '」')
  }
  for (const kind of KINDS) {
    for (const e of pool[kind] || []) {
      if (!readings[e.word])
        bad('词库里的 「' + e.word + '」 没有钉死读音')
    }
  }
  const keys = Object.keys(readings)
  const sortedKeys = [...keys].sort()
  if (keys.join('') !== sortedKeys.join(''))
    bad('verse-readings.json 的键没有排序（每次 build 都会产生无意义的 diff）')

  // 6. 多音字裁决覆盖度 + 读音落在候选里（复用 audit-verse）
  const result = audit(pool, readings, fix)
  for (const item of result.invalid)
    bad('钉死读音不合法：' + item.word + '：' + item.why)
  for (const item of result.unadjudicated)
    bad('含多音字却没裁决：' + item.word + '（多音字 ' + item.het.map(h => h.char).join('') + '）')
  for (const item of result.mismatch)
    bad('勘误与读音表不一致：' + item.word + '：' + item.why)

  return problems
}

// ── --selftest：每一项检查都要被人为触发一次 ──
const args = process.argv.slice(2)
if (isEntry && args.includes('--selftest')) {
  const basePool = {
    contentVersion: 'v1',
    frozen: {},
    wuyan: [{ word: '大漠孤烟直', source: '唐·王维《使至塞上》', poemId: 'a' }],
    qiyan: [{ word: '一行白鹭上青天', source: '唐·杜甫《绝句》', poemId: 'b' }],
  }
  basePool.frozen = {
    wuyan: { count: 1, sha256: hashEntries(basePool.wuyan) },
    qiyan: { count: 1, sha256: hashEntries(basePool.qiyan) },
  }
  const baseSource = {
    contentVersion: 'v1',
    forms: ['五言', '七言'],
    poems: [
      { id: 'a', title: '使至塞上', author: '王维', dynasty: '唐', form: '五言', stage: '小学', grade: 3, volume: '', lines: ['大漠孤烟直长河落日圆'] },
      { id: 'b', title: '绝句', author: '杜甫', dynasty: '唐', form: '七言', stage: '小学', grade: 2, volume: '', lines: ['两个黄鹂鸣翠柳一行白鹭上青天'] },
    ],
  }
  const baseSnapshot = { contentVersion: 'v1', forms: ['五言', '七言'], poems: 2, lines: 2, splittable: 2 }
  // 键序与真实产物一致（按码位排序），且含多音字的句子都带勘误——好样本必须真的干净
  const baseReadings = { '一行白鹭上青天': 'yi1 hang2 bai2 lu4 shang4 qing1 tian1', '大漠孤烟直': 'da4 mo4 gu1 yan1 zhi2' }
  const baseFix = { '一行白鹭上青天': 'yi1 hang2 bai2 lu4 shang4 qing1 tian1', '大漠孤烟直': 'da4 mo4 gu1 yan1 zhi2' }
  const clone = o => JSON.parse(JSON.stringify(o))
  const good = inspect({ source: clone(baseSource), snapshot: clone(baseSnapshot), pool: clone(basePool), readings: clone(baseReadings), fix: clone(baseFix) })
  const cases = []
  const run = (name, mutate, expectFragment) => {
    const s = clone(baseSource); const sn = clone(baseSnapshot); const p = clone(basePool); const rd = clone(baseReadings); const fx = clone(baseFix)
    mutate(s, sn, p, rd, fx)
    const problems = inspect({ source: s, snapshot: sn, pool: p, readings: rd, fix: fx })
    const hit = problems.some(x => x.includes(expectFragment))
    cases.push({ name, fired: problems.length > 0, hit, problems })
  }

  run('contentVersion 不一致', (s, sn) => { sn.contentVersion = 'v2' }, 'contentVersion 不一致')
  run('篇数统计错', (s, sn) => { sn.poems = 5 }, '篇数对不上')
  run('行数统计错', (s, sn) => { sn.lines = 9 }, '行数对不上')
  run('可拆行统计错', (s, sn) => { sn.splittable = 1 }, '可拆行数对不上')
  run('体裁漏进来', (s) => { s.poems[0].form = '词' }, '不在收的范围内')
  run('历史答案被改', (s, sn, p) => { p.wuyan[0].word = '大漠孤烟直改' }, '被改动过')
  run('历史答案被删', (s, sn, p) => { p.wuyan = [] }, '词库是空的')
  run('缺 frozen', (s, sn, p) => { delete p.frozen.wuyan }, '缺少 frozen')
  run('字数不对', (s, sn, p) => { p.wuyan[0].word = '大漠孤烟'; p.frozen.wuyan.sha256 = hashEntries(p.wuyan) }, '应为 5')
  run('含非汉字', (s, sn, p) => { p.wuyan[0].word = '大漠孤烟a'; p.frozen.wuyan.sha256 = hashEntries(p.wuyan) }, '含非汉字')
  run('重复句', (s, sn, p) => { p.wuyan.push(clone(p.wuyan[0])); p.frozen.wuyan.sha256 = hashEntries(p.wuyan.slice(0, 1)) }, '重复句')
  run('缺出处', (s, sn, p) => { p.wuyan[0].source = ''; p.frozen.wuyan.sha256 = hashEntries(p.wuyan) }, '没有出处')
  run('poemId 找不到', (s) => { s.poems = [s.poems[1]] }, '找不到')
  run('读音音节数不对', (s, sn, p, rd) => { rd['大漠孤烟直'] = 'da4 mo4 gu1 yan1' }, '个音节')
  run('读音形式不对', (s, sn, p, rd) => { rd['大漠孤烟直'] = 'da4 mo4 gu1 yan1 zhi22' }, '形式不对')
  run('词库条目缺读音', (s, sn, p, rd) => { delete rd['大漠孤烟直'] }, '没有钉死读音')
  run('勘误没重 build', (s, sn, p, rd, fx) => { fx['大漠孤烟直'] = 'da4 mo4 gu1 yan1 zhi4' }, '没重新 build')
  run('键没排序', (s, sn, p, rd) => { const v = rd['一行白鹭上青天']; delete rd['一行白鹭上青天']; rd['一行白鹭上青天'] = v }, '没有排序')
  run('多音字未裁决', (s, sn, p, rd, fx) => { delete fx['大漠孤烟直'] }, '没裁决')

  const failures = []
  if (good.length)
    failures.push('好样本被判为有问题：\n  ' + good.join('\n  '))
  for (const c of cases) {
    if (!c.fired)
      failures.push('检查没触发：' + c.name)
    else if (!c.hit)
      failures.push('触发了但不是报这件事（' + c.name + '）：' + c.problems[0])
  }
  if (failures.length) {
    console.error('[check] check-verse --selftest 失败：')
    for (const x of failures) console.error('  - ' + x)
    process.exit(1)
  }
  console.log('[ok] check-verse --selftest 通过（' + cases.length + ' 项检查每项都被人为触发过一次）')
  process.exit(0)
}

if (isEntry) {
let source, snapshot, pool, readings, fix
try {
  source = loadJson(SOURCE_PATH, '诗库抽取结果（先跑 node tools/sync-poems.mjs）')
  snapshot = loadJson(SNAPSHOT_PATH, '诗库快照')
  pool = loadJson(POOL_PATH, '诗句词库（先跑 node tools/build-verse.mjs）')
  readings = loadJson(READINGS_PATH, '钉死读音表')
  fix = fs.existsSync(FIX_PATH) ? JSON.parse(fs.readFileSync(FIX_PATH, 'utf8')) : {}
}
catch (e) {
  console.error('[check] ERROR: ' + e.message)
  process.exit(1)
}

const problems = inspect({ source, snapshot, pool, readings, fix })
if (problems.length) {
  console.error('[check] 五言 / 七言产物有问题（' + problems.length + ' 处）：')
  for (const p of problems.slice(0, 40)) console.error('  - ' + p)
  if (problems.length > 40) console.error('  …还有 ' + (problems.length - 40) + ' 处')
  process.exit(1)
}

const heteronym = KINDS.flatMap(k => pool[k] || []).filter(e => Array.from(e.word).some(c => charReadings(c).length > 1)).length
console.log('[ok] 产物自洽：' + pool.wuyan.length + ' 句五言 / ' + pool.qiyan.length + ' 句七言，钉死读音 ' + Object.keys(readings).length + ' 条，其中含多音字 ' + heteronym + ' 句已全部裁决')
console.log('     contentVersion ' + snapshot.contentVersion + '，历史前缀 wuyan ' + pool.frozen.wuyan.count + ' / qiyan ' + pool.frozen.qiyan.count + ' 句未被改动')
}

#!/usr/bin/env node
/*
 * 繁体产物体检：不联网，只查 src/data/traditional.json 这份已提交的产物自不自洽。
 *
 * 分工：
 *   build-traditional.py --selftest  派生机自己的坏例子（要读内容仓那台机器）
 *   build-traditional.py --check     产物与来源逐字一致（要读内容仓）
 *   check-trad.mjs（本脚本）         不联网、不依赖 Python：产物内部自洽 + 覆盖完整
 *
 * 为什么单独要这一个：CI 与本地都能跑，拦住「产物被人手改过」「词库加了句没重派生」
 * 「裁定没写理由」这三类事故。空过的检查比没有检查更危险，所以带 --selftest。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'src', 'data')
const TRAD_PATH = path.join(DATA, 'traditional.json')
const POOL_PATH = path.join(DATA, 'verse-pool.json')
const RULES_PATH = path.join(DATA, 'trad-rules.json')
const PV_PATH = path.join(DATA, 'poems-verse.json')
const HAN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u

class TradCheckError extends Error {}

function loadJson(file, label) {
  if (!fs.existsSync(file))
    throw new TradCheckError('缺少 ' + path.relative(process.cwd(), file) + '（' + label + '）')
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function answerWords() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'answers', 'list.ts'), 'utf8')
  return [...new Set([...src.matchAll(/\['([^'[\]]{2,10})',\s*'([^']*)'\]/g)].map(m => m[1]))]
}

export function inspect({ trad, pool, words, poemIds }) {
  const problems = []
  const bad = m => problems.push(m)

  for (const k of ['engine', 'source', 'rules', 'verse', 'answers', 'counts']) {
    if (!trad || trad[k] == null)
      bad('产物缺字段 ' + k)
  }
  if (problems.length)
    return problems

  // 1. 内容仓那边还有没裁决的字，本站就不许端出繁体
  for (const k of ['tradPending', 'tradPendingApparatus']) {
    if (trad.source[k] !== 0)
      bad('内容仓的繁体派生里 ' + k + ' = ' + trad.source[k] + '，还有字没裁决')
  }

  // 2. 条数当场数，不许写死
  const verseKeys = Object.keys(trad.verse)
  const answerKeys = Object.keys(trad.answers)
  if (trad.counts.verse !== verseKeys.length)
    bad('counts.verse 写的是 ' + trad.counts.verse + '，产物里实际 ' + verseKeys.length + ' 句')
  if (trad.counts.answers !== answerKeys.length)
    bad('counts.answers 写的是 ' + trad.counts.answers + '，产物里实际 ' + answerKeys.length + ' 条')

  // 3. 覆盖：词库里的每一句都要有繁体形，产物里也不许多出没在词库里的句子
  const poolWords = new Set([...(pool.wuyan || []), ...(pool.qiyan || [])].map(e => e.word))
  for (const w of poolWords) {
    if (!trad.verse[w])
      bad('词库里的句子「' + w + '」没有繁体形（词库加了句没重跑派生）')
  }
  for (const w of verseKeys) {
    if (!poolWords.has(w))
      bad('产物里的句子「' + w + '」不在词库里')
  }
  const answerSet = new Set(words)
  for (const w of answerSet) {
    if (!trad.answers[w])
      bad('每日答案「' + w + '」没有繁体形')
  }
  for (const w of answerKeys) {
    if (!answerSet.has(w))
      bad('产物里的成语「' + w + '」不是任何一天的答案')
  }

  // 4. 逐字对齐：繁体形必须与源词一样长、全是汉字
  for (const [w, entry] of Object.entries(trad.verse)) {
    const n = Array.from(w).length
    const t = Array.from(entry.trad || '')
    if (t.length !== n)
      bad('「' + w + '」的繁体形 ' + t.length + ' 字，源词 ' + n + ' 字')
    for (const ch of t) {
      if (!HAN.test(ch))
        bad('「' + w + '」的繁体形里混进了非汉字：' + JSON.stringify(entry.trad))
    }
    if (entry.derive === 'table') {
      if (!(entry.why || '').trim())
        bad('「' + w + '」走繁简表派生却没写凭什么')
      if (!(entry.sourceTrad || '').trim())
        bad('「' + w + '」没有繁体出处')
    }
    else {
      if (!Number.isInteger(entry.line) || entry.line < 0 || !Number.isInteger(entry.at) || entry.at < 0)
        bad('「' + w + '」没有记是从第几行第几字取的')
      if (!poemIds.has(entry.poemId))
        bad('「' + w + '」的出处 ' + entry.poemId + ' 不在诗库快照里')
      if (!(entry.sourceTrad || '').trim())
        bad('「' + w + '」没有繁体出处')
    }
  }
  for (const [w, entry] of Object.entries(trad.answers)) {
    const n = Array.from(w).length
    const t = Array.from(entry.trad || '')
    if (t.length !== n)
      bad('成语「' + w + '」的繁体形 ' + t.length + ' 字，源词 ' + n + ' 字')
    for (const ch of t) {
      if (!HAN.test(ch))
        bad('成语「' + w + '」的繁体形里混进了非汉字：' + JSON.stringify(entry.trad))
    }
  }

  // 5. 每一处分歧都要留痕；凡是自己挑了写法的，必须能在裁定表里找到带理由的同一条
  const rules = new Map((trad.rules || []).map(r => [r.simp, r]))
  for (const r of trad.rules || []) {
    if (!(r.why || '').trim())
      bad('裁定「' + r.simp + ' → ' + r.pick + '」没写凭什么')
  }
  let forks = 0
  let ruled = 0
  const scan = (word, entry, what) => {
    for (const f of entry.forks || []) {
      forks++
      if (!f.simp || !Array.isArray(f.cands))
        bad(what + '「' + word + '」有一处分歧没写清楚')
      if (!f.pick)
        continue
      ruled++
      if (!f.cands.includes(f.pick))
        bad(what + '「' + word + '」挑了「' + f.pick + '」，候选里没有这个字')
      const rule = rules.get(f.simp)
      if (!rule || rule.pick !== f.pick)
        bad(what + '「' + word + '」挑了「' + f.pick + '」，裁定表里却没有这条带理由的记录')
    }
  }
  for (const [w, e] of Object.entries(trad.verse)) scan(w, e, '句子')
  for (const [w, e] of Object.entries(trad.answers)) scan(w, e, '成语')
  if (trad.counts.forks !== forks)
    bad('counts.forks 写的是 ' + trad.counts.forks + '，产物里实际 ' + forks + ' 处')
  if (trad.counts.ruled !== ruled)
    bad('counts.ruled 写的是 ' + trad.counts.ruled + '，产物里实际 ' + ruled + ' 处')

  return problems
}

const args = process.argv.slice(2)
const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isEntry && args.includes('--selftest')) {
  const trad = loadJson(TRAD_PATH, '繁体产物（先跑 python tools/build-traditional.py）')
  const pool = loadJson(POOL_PATH, '诗句词库')
  const pv = loadJson(PV_PATH, '诗库抽取结果')
  const words = answerWords()
  const poemIds = new Set(pv.poems.map(p => p.id))
  const clone = o => JSON.parse(JSON.stringify(o))
  const ctx = () => ({ trad: clone(trad), pool: clone(pool), words, poemIds })

  const good = inspect(ctx())
  const cases = []
  const run = (name, mutate, fragment) => {
    const c = ctx()
    mutate(c)
    const problems = inspect(c)
    cases.push({ name, fired: problems.length > 0, hit: problems.some(x => x.includes(fragment)), problems })
  }

  run('句子没有繁体形', c => { delete c.trad.verse[c.pool.wuyan[0].word] }, '没有繁体形')
  run('产物里多出词库外的句子', c => { c.trad.verse['词库里没有这句'] = { trad: '词库里没有这句', line: 0, at: 0, poemId: 'x', sourceTrad: 'x' } }, '不在词库里')
  run('答案没有繁体形', c => { delete c.trad.answers[words[0]] }, '没有繁体形')
  run('字数不齐', c => { const w = c.pool.wuyan[0].word; c.trad.verse[w].trad = '少一个字' }, '源词')
  run('繁体形混进非汉字', c => { const w = c.pool.wuyan[0].word; c.trad.verse[w].trad = 'abcde' }, '非汉字')
  run('条数写死', c => { c.trad.counts.verse = 1 }, 'counts.verse')
  run('分歧条数写死', c => { c.trad.counts.forks = 7 }, 'counts.forks')
  run('裁定没写理由', c => { c.trad.rules[0].why = '' }, '没写凭什么')
  run('裁定表里没有的记录', c => {
    const hit = Object.entries(c.trad.answers).find(([, e]) => (e.forks || []).some(f => f.pick))
    if (!hit) return
    const [, e] = hit
    const f = e.forks.find(x => x.pick)
    c.trad.rules = c.trad.rules.filter(r => r.pick !== f.pick)
  }, '裁定表里却没有')
  run('内容仓还有字没裁决', c => { c.trad.source.tradPending = 3 }, '还有字没裁决')
  run('派生句子没记行号', c => { const w = c.pool.wuyan[0].word; c.trad.verse[w].line = -1 }, '第几行')
  run('表派生没写凭什么', c => {
    const w = Object.keys(c.trad.verse).find(k => c.trad.verse[k].derive === 'table')
    if (w) c.trad.verse[w].why = ''
  }, '没写凭什么')

  const failures = []
  if (good.length)
    failures.push('真产物被判为有问题：\n  ' + good.join('\n  '))
  for (const c of cases) {
    if (!c.fired) failures.push('检查没触发：' + c.name)
    else if (!c.hit) failures.push('触发了但不是报这件事（' + c.name + '）：' + c.problems[0])
  }
  if (failures.length) {
    console.error('[check] check-trad --selftest 失败：')
    for (const x of failures) console.error('  - ' + x)
    process.exit(1)
  }
  console.log('[ok] check-trad --selftest 通过（' + cases.length + ' 项检查每项都被人为触发过一次）')
  process.exit(0)
}

if (isEntry) {
  let trad, pool, pv
  try {
    trad = loadJson(TRAD_PATH, '繁体产物（先跑 python tools/build-traditional.py）')
    pool = loadJson(POOL_PATH, '诗句词库')
    pv = loadJson(PV_PATH, '诗库抽取结果')
  }
  catch (e) {
    console.error('[check] ERROR: ' + e.message)
    process.exit(1)
  }
  const problems = inspect({ trad, pool, words: answerWords(), poemIds: new Set(pv.poems.map(p => p.id)) })
  if (problems.length) {
    console.error('[check] 繁体产物有问题（' + problems.length + ' 处）：')
    for (const p of problems.slice(0, 40)) console.error('  - ' + p)
    if (problems.length > 40) console.error('  …还有 ' + (problems.length - 40) + ' 处')
    process.exit(1)
  }
  const table = Object.values(trad.verse).filter(e => e.derive === 'table').length
  console.log('[ok] 繁体产物自洽：' + trad.counts.verse + ' 句诗句（其中 ' + table + ' 句走繁简表派生）+ '
    + trad.counts.answers + ' 条成语答案，' + trad.counts.forks + ' 处分歧全部留痕，本站裁定 ' + trad.counts.ruled + ' 处')
  console.log('     来源指纹 ' + trad.source.poemsJsonSha256.slice(0, 12) + ' / ' + trad.source.traditionalJsonSha256.slice(0, 12))
}

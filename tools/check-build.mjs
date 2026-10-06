#!/usr/bin/env node
/*
   产物体检：只看 dist，不看源码。
   抓的是「构建成功、部署成功、只有点开页面才看得见」那一类静默故障。
   用法：node tools/check-build.mjs [--selftest]
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 只禁「冒充上游」的那几个串。github.com/antfu/handle 是必须保留的署名，不能一起禁掉，
// 否则这条检查每次都对合规署名报错，久而久之就没人看它的输出了。
const FORBIDDEN = ['handle.antfu.me', 'antfu7', 'tiger.svg', 'netlify']
const REQUIRED = ['index.html', 'CNAME', 'favicon.svg', 'og.png', 'robots.txt']
const SIZE_CAP = 4 * 1024 * 1024

export function checkBuild(dist) {
  const problems = []
  if (!fs.existsSync(dist)) {
    problems.push('dist 不存在：' + dist + '（先跑 npm run build）')
    return problems
  }

  const files = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) walk(f)
      else files.push(f)
    }
  }
  walk(dist)

  const rel = new Set(files.map(f => path.relative(dist, f).replace(/\\/g, '/')))
  for (const r of REQUIRED) {
    if (!rel.has(r))
      problems.push('产物缺 ' + r)
  }

  let total = 0
  for (const f of files) total += fs.statSync(f).size
  if (total > SIZE_CAP)
    problems.push('产物 ' + (total / 1048576).toFixed(2) + ' MB，超过 ' + (SIZE_CAP / 1048576).toFixed(0) + ' MB 上限（词库被重复打进去了？）')

  let js = 0
  let css = 0
  let hasVerseData = false
  for (const f of files) {
    if (!/\.(html|css|js|txt|svg)$/.test(f)) continue
    const body = fs.readFileSync(f, 'utf8')
    if (f.endsWith('.js')) js++
    if (f.endsWith('.css')) css++
    if (f.endsWith('.js') && body.includes('poemId:')) hasVerseData = true

    const bad = FORBIDDEN.filter(k => body.includes(k))
    if (bad.length)
      problems.push(path.relative(dist, f) + ' 里还留着上游痕迹：' + bad.join(', '))

    if (body.includes('\uFFFD'))
      problems.push(path.relative(dist, f) + ' 含 U+FFFD（编码在中途被换过一次）')
  }
  if (!js) problems.push('产物里没有一个 .js')
  if (!hasVerseData) problems.push('产物里找不到诗句词库（没有 poemId 字段）——五言 / 七言会是空的')
  if (!css) problems.push('产物里没有一个 .css')

  const htmlPath = path.join(dist, 'index.html')
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8')
    for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const u = m[1]
      if (!u.startsWith('/') || u.startsWith('//')) continue
      if (!rel.has(u.slice(1)))
        problems.push('index.html 引用了不存在的产物：' + u)
    }
    if (!html.includes('dc-theme'))
      problems.push('index.html 没有 dc-theme 首帧定色脚本（暗色用户会先看到白屏）')
    if (!html.includes('lang="zh-CN"'))
      problems.push('index.html 的 lang 不是 zh-CN')
  }

  const cname = path.join(dist, 'CNAME')
  if (fs.existsSync(cname)) {
    const v = fs.readFileSync(cname, 'utf8').trim()
    if (v !== 'handle.diuci.com')
      problems.push('CNAME 是「' + v + '」，应为 handle.diuci.com')
  }

  return problems
}

function selftest() {
  const dir = fs.mkdtempSync(path.join(ROOT, '.selftest-build-'))
  let ok = true
  try {
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), '<!DOCTYPE html><html lang="zh-CN"><head><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/a.css"><script src="/assets/a.js"></script><script>localStorage.getItem("dc-theme")</script></head><body></body></html>')
    fs.writeFileSync(path.join(dir, 'CNAME'), 'handle.diuci.com\n')
    fs.writeFileSync(path.join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
    fs.writeFileSync(path.join(dir, 'og.png'), 'png')
    fs.writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *\n')
    fs.writeFileSync(path.join(dir, 'assets/a.css'), ':root{--paper:#f4ede0}')
    fs.writeFileSync(path.join(dir, 'assets/a.js'), 'console.log(1);const x=[{poemId:"a"}]')

    const good = checkBuild(dir)
    if (good.length) {
      ok = false
      console.log('[!!] 自检失败：干净产物被判为有问题')
      for (const x of good) console.log('     ' + x)
    }
    else { console.log('[ok] 干净产物：判为无问题') }

    fs.writeFileSync(path.join(dir, 'CNAME'), 'handle.antfu.me\n')
    fs.writeFileSync(path.join(dir, 'assets/a.js'), 'fetch("https://handle.antfu.me/x") // antfu7')
    fs.writeFileSync(path.join(dir, 'assets/b.js'), 'console.log(1)')
    fs.writeFileSync(path.join(dir, 'index.html'), '<!DOCTYPE html><html lang="en"><script src="/assets/missing.js"></script></html>')
    fs.writeFileSync(path.join(dir, 'assets/a.css'), 'a{content:"\uFFFD"}')

    const bad = checkBuild(dir)
    const want = ['CNAME', '上游痕迹', 'U+FFFD', '不存在的产物', 'lang', 'dc-theme', '诗句词库']
    const hit = want.filter(w => bad.some(b => b.includes(w)))
    if (hit.length < want.length) {
      ok = false
      console.log('[!!] 自检失败：坏产物只抓到 ' + hit.length + '/' + want.length + ' 类问题')
      for (const x of bad) console.log('     ' + x)
    }
    else { console.log('[ok] 坏产物被抓到 ' + bad.length + ' 条，覆盖 ' + want.length + ' 类') }
  }
  finally { fs.rmSync(dir, { recursive: true, force: true }) }
  return ok
}

if (process.argv.includes('--selftest')) {
  process.exit(selftest() ? 0 : 1)
}
else {
  const problems = checkBuild(process.env.DIST_DIR || path.join(ROOT, 'dist'))
  if (problems.length) {
    console.log('[!!] 产物体检未通过：')
    for (const q of problems) console.log('  - ' + q)
    process.exit(1)
  }
  console.log('[ok] 产物体检通过')
}

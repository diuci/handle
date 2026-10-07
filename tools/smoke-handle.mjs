#!/usr/bin/env node
/*
   上线前冒烟：真开一个浏览器，把当天这题猜对，看它是不是真的能赢。
   抓的是「构建过了、测试过了、页面打开是白的」那一类。
   三种玩法各跑一遍：成语、五言、七言——七言七个格子最容易在手机上摆不下。
   用法：
     npm run preview -- --port 4173 --host 127.0.0.1   # 先起静态服务
     node tools/smoke-handle.mjs [--url http://127.0.0.1:4173/] [--selftest]
   找不到浏览器时退出码 2 —— 不是 0。检查没跑过不能算跑过了。
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const KINDS = [
  { kind: 'idiom', len: 4, label: '成语' },
  { kind: 'wuyan', len: 5, label: '五言' },
  { kind: 'qiyan', len: 7, label: '七言' },
]

// 底部标签栏应有几项：断言与成功文案读同一个数。
// 之前成功文案里硬写着「5 项」，加了一项后检查改成 6、文案还在说 5 ——
// 「通过」这句话本身在撒谎。加入口时只改这一处。
const TAB_COUNT = 6

function findChrome() {
  const cands = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  for (const c of cands) {
    if (fs.existsSync(c)) return c
  }
  return null
}

async function loadPuppeteer() {
  try {
    return (await import('puppeteer-core')).default
  }
  catch {
    const local = path.join(ROOT, 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js')
    if (fs.existsSync(local))
      return (await import(pathToFileURL(local).href)).default
    throw new Error('puppeteer-core 没装：npm i -D puppeteer-core')
  }
}

/** init.ts 在 dev 下打的那一行：D<期号> <玩法> <日期> <答案> <提示> */
function parseDevLog(logs, kind) {
  const line = [...logs].reverse().find(l => new RegExp('^D\\d+ ' + kind + ' ').test(l))
  if (!line) return null
  const parts = line.trim().split(/\s+/g)
  return { day: parts[0], word: parts[3] || '' }
}

async function playRound(page, logs, base, spec, problems, day) {
  // 每一轮用不同的期号：赢过的期号不会再给输入框，清 localStorage 也没用
  // （页面卸载时 pauseTimer 会把内存里的战绩写回去）。换期号才是干净的重来。
  await page.goto(base + '/?dev=hey&mode=' + spec.kind + '&d=' + day, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 400))

  // 先确认 dev 开关好使：连当天答案都拿不到，后面查什么都没用。
  const { word } = parseDevLog(logs, spec.kind) || {}
  if (!word) {
    problems.push(spec.kind + '：拿不到第 ' + day + ' 期的答案（init.ts 的 D<day> <kind> 日志没出现，dev 开关失效？）')
    return
  }
  if ([...word].length !== spec.len)
    problems.push(spec.kind + '：当天答案 `` + word + `` 是 ' + [...word].length + ' 字，应为 ' + spec.len)

  if (!await page.$('input')) {
    problems.push(spec.kind + '：第 ' + day + ' 期页面上没有输入框')
    return
  }

  const picked = await page.evaluate(() => {
    const on = document.querySelector('.kind-btn.on')
    return on ? on.textContent.trim() : ''
  })
  if (picked !== spec.label)
    problems.push(spec.kind + '：玩法开关上高亮的是「' + picked + '」，应为「' + spec.label + '」（?mode= 没生效？）')

  // 只看板子上的行：弹层（规则页的例子、分享图）里的行不算
  const tiles = await page.$$eval('.row', els => els
    .filter(e => !e.closest('.dc-modal'))
    .map(e => e.querySelectorAll('.tile').length))
  if (!tiles.length || !tiles.every(n => n === spec.len))
    problems.push(spec.kind + '：看板每行格子数 ' + JSON.stringify(tiles) + '，应全是 ' + spec.len)

  // 手机宽度下七个格子必须摆得下：行不能横向溢出
  const overflow = await page.$$eval('.row', els => els
    .filter(e => !e.closest('.dc-modal') && e.scrollWidth > e.clientWidth + 1)
    .map(e => e.scrollWidth + '>' + e.clientWidth))
  if (overflow.length)
    problems.push(spec.kind + '：在 ' + (await page.viewport()).width + 'px 宽下格子行溢出：' + overflow.join(', '))

  await page.click('input')
  await page.type('input', word, { delay: 30 })
  await page.keyboard.press('Enter')
  await new Promise(r => setTimeout(r, 2000))

  const after = await page.evaluate(() => document.body.innerText)
  if (!after.includes('分享'))
    problems.push(spec.kind + '：输入当天正确答案 ' + word + ' 后没有出现「分享」，通关判定没触发')
  // 格子里每个字与它的声母韵母是分开渲染的，innerText 里不会出现连着的整句，逐字查。
  const missing = [...word].filter(ch => !after.includes(ch))
  if (missing.length)
    problems.push(spec.kind + '：猜完之后页面上看不到答案的字：' + missing.join(' '))
  if (spec.kind !== 'idiom' && !after.includes('出处'))
    problems.push(spec.kind + '：猜完之后没看到「出处」，诗句来源没显示')
}

export async function runSmoke(puppeteer, url) {
  const problems = []
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 1 })
    const errors = []
    const logs = []
    page.on('pageerror', e => errors.push('pageerror: ' + e.message))
    page.on('console', m => {
      logs.push(m.text())
      if (m.type() === 'error') errors.push('console.error: ' + m.text())
    })
    page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()))

    const base = url.replace(/\/$/, '')
    await page.goto(base + '/?dev=hey', { waitUntil: 'networkidle2', timeout: 60000 })
    await page.evaluate(() => {
      localStorage.clear()
      localStorage.setItem('handle-initialized', 'true')
      localStorage.setItem('dc-theme', 'light')
    })
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })

    const body0 = await page.evaluate(() => document.body.innerText)
    if (!body0.trim()) problems.push('页面正文是空的')
    if (!await page.$('input')) problems.push('页面上没有输入框')

    const tabs = await page.$$eval('.dc-tabbar a', els => els.map(e => e.getAttribute('href')))
      .catch(() => [])
    if (tabs.length !== TAB_COUNT)
      problems.push('底部标签栏有 ' + tabs.length + ' 项，应为 ' + TAB_COUNT + ' 项')
    else {
      for (const need of ['diuci.com', 'k12.diuci.com', 'lian.diuci.com', 'ink.diuci.com', 'moon.diuci.com', 'handle.diuci.com']) {
        if (!tabs.some(h => (h || '').includes(need)))
          problems.push('底部标签栏缺 ' + need)
      }
    }

    const attribution = await page.evaluate(() => document.body.innerText)
    if (!attribution.includes('汉兜 Handle'))
      problems.push('页面上看不到上游署名「汉兜 Handle」')

    // 玩法开关：三个按钮、标签对得上
    const btns = await page.$$eval('.kind-btn', els => els.map(e => e.textContent.trim()))
      .catch(() => [])
    if (btns.length !== 3)
      problems.push('玩法切换有 ' + btns.length + ' 个按钮，应为 3 个（成语 / 五言 / 七言）')
    else {
      for (const spec of KINDS) {
        if (!btns.includes(spec.label))
          problems.push('玩法切换里没有「' + spec.label + '」按钮：' + btns.join(' / '))
      }
    }

    // 三种玩法各猜一遍：宽屏一轮（第 1000 期），手机宽度一轮（第 1001 期）。
    // 两轮用不同期号，冒烟才能反复跑。
    for (const spec of KINDS)
      await playRound(page, logs, base, spec, problems, 1000)

    await page.setViewport({ width: 375, height: 720, deviceScaleFactor: 1 })
    for (const spec of KINDS)
      await playRound(page, logs, base, spec, problems, 1001)

    // 主题开关：必须同时改 html.dark、data-theme、localStorage['dc-theme']
    await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 1 })
    await page.goto(base + '/?dev=hey', { waitUntil: 'networkidle2', timeout: 60000 })
    const before = await page.evaluate(() => ({
      cls: document.documentElement.classList.contains('dark'),
      data: document.documentElement.dataset.theme,
      store: localStorage.getItem('dc-theme'),
    }))
    if (!await page.$('.theme-btn')) {
      problems.push('顶栏没有主题按钮 .theme-btn')
    }
    else {
      await page.click('.theme-btn')
      await new Promise(r => setTimeout(r, 400))
    }
    const afterTheme = await page.evaluate(() => ({
      cls: document.documentElement.classList.contains('dark'),
      data: document.documentElement.dataset.theme,
      store: localStorage.getItem('dc-theme'),
    }))
    if (before.cls === afterTheme.cls)
      problems.push('点主题按钮后 html.dark 没变')
    if (before.data === afterTheme.data)
      problems.push('点主题按钮后 html[data-theme] 没变')
    if (afterTheme.store !== (afterTheme.data))
      problems.push("localStorage['dc-theme'] 与 html[data-theme] 不一致（主站之间就不互通了）")

    if (errors.length)
      problems.push('浏览器里有 ' + errors.length + ' 条错误：' + errors.slice(0, 3).join(' | '))

    await page.close()
  }
  finally {
    await browser.close()
  }
  return problems
}

function serveFixture() {
  const broken = '<!DOCTYPE html><html lang="zh-CN"><body><script>undefinedThing()</script></body></html>'
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(broken)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

async function selftest(puppeteer) {
  const server = await serveFixture()
  const port = server.address().port
  try {
    const problems = await runSmoke(puppeteer, 'http://127.0.0.1:' + port)
    const want = ['正文是空', '没有输入框', '标签栏', '署名', '玩法切换', 'dev 开关', '主题按钮']
    const hit = want.filter(w => problems.some(x => x.includes(w)))
    if (hit.length < want.length) {
      console.log('[!!] 自检失败：坏页面只抓到 ' + hit.length + '/' + want.length + ' 类问题')
      for (const x of problems) console.log('     ' + x)
      return false
    }
    console.log('[ok] 坏页面被抓到 ' + problems.length + ' 条，覆盖 ' + want.length + ' 类')
    return true
  }
  finally {
    server.close()
  }
}

async function main() {
  const chrome = findChrome()
  if (!chrome) {
    console.log('[!!] 找不到 Chrome/Chromium/Edge，冒烟没有跑。')
    console.log('     找过：' + (process.platform === 'win32' ? 'Program Files 下的 Chrome 与 Edge' : '/usr/bin/google-chrome, /usr/bin/chromium'))
    return 2
  }
  let puppeteer
  try {
    puppeteer = await loadPuppeteer()
  }
  catch (e) {
    console.log('[!!] ' + e.message)
    return 2
  }

  if (process.argv.includes('--selftest'))
    return await selftest(puppeteer) ? 0 : 1

  const arg = process.argv.find(a => a.startsWith('--url='))
  const url = arg ? arg.slice(6) : (process.env.SMOKE_URL || 'http://127.0.0.1:4173')
  const problems = await runSmoke(puppeteer, url)
  if (problems.length) {
    console.log('[!!] 冒烟未通过（' + url + '）：')
    for (const q of problems) console.log('  - ' + q)
    return 1
  }
  console.log('[ok] 冒烟通过（' + url + '）：三种玩法各猜对一遍、900px 与 375px 都不溢出、标签栏 ' + TAB_COUNT + ' 项、署名在、主题开关三处同步')
  return 0
}

process.exit(await main())

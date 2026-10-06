#!/usr/bin/env node
/*
   上线前冒烟：真开一个浏览器，把当天这题猜对，看它是不是真的能赢。
   抓的是「构建过了、测试过了、页面打开是白的」那一类。
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

    await page.goto(url + '/?dev=hey', { waitUntil: 'networkidle2', timeout: 60000 })
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
    if (tabs.length !== 5)
      problems.push('底部标签栏有 ' + tabs.length + ' 项，应为 5 项')
    else {
      for (const need of ['diuci.com', 'k12.diuci.com', 'ink.diuci.com', 'moon.diuci.com', 'handle.diuci.com']) {
        if (!tabs.some(h => (h || '').includes(need)))
          problems.push('底部标签栏缺 ' + need)
      }
    }

    const attribution = await page.evaluate(() => document.body.innerText)
    if (!attribution.includes('汉兜 Handle'))
      problems.push('页面上看不到上游署名「汉兜 Handle」')

    // 用 init.ts 在 dev 模式打印的那一行拿到当天答案，真猜一次
    const line = logs.find(l => /^D\d+ /.test(l)) || ''
    const word = line.split(' ')[2]
    if (!word) {
      problems.push('拿不到当天答案（init.ts 的 D<dayNo> 日志没出现，dev 开关失效？）')
    }
    else {
      await page.click('input')
      await page.type('input', word, { delay: 40 })
      await page.keyboard.press('Enter')
      await new Promise(r => setTimeout(r, 2000))
      const after = await page.evaluate(() => document.body.innerText)
      if (!after.includes('分享'))
        problems.push('输入当天正确答案 ' + word + ' 后没有出现「分享」，通关判定没触发')
      // 格子里每个字与它的声母韵母是分开渲染的，innerText 里不会出现连着的「鲜为人知」，
      // 所以逐字查，不查整串。
      const missing = [...word].filter(ch => !after.includes(ch))
      if (missing.length)
        problems.push('猜完之后页面上看不到答案的字：' + missing.join(' '))
    }

    // 主题开关：必须同时改 html.dark、data-theme、localStorage['dc-theme']
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
    const want = ['正文是空', '没有输入框', '标签栏', '署名', 'dev 开关', '主题按钮']
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
  console.log('[ok] 冒烟通过（' + url + '）：页面有内容、能通关、标签栏 5 项、署名在、主题开关三处同步')
  return 0
}

process.exit(await main())

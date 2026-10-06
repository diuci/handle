#!/usr/bin/env node
/*
   主题体检：暗色必须由 class 驱动，配色必须还是主站那批值。
   两条历史故障就是这里抓的：
   1) UnoCSS 的 dark: 变体一旦退回 prefers-color-scheme，站内暗色会跟系统偏好跑，
      与 dc-theme 开关各判一次（基线阶段真拍出过两张一模一样的暗图）。
   2) 有人手改色值，把四个站的语义色改歪。
   用法：node tools/check-theme.mjs [--selftest]
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 逐值抄自 _deploy/index.html 的 :root 与 :root[data-theme="dark"]。
// 要改配色，先改主站，再改这里，最后改本站——顺序反了就是四个站长得不一样。
const LIGHT = [
  '--paper:#f4ede0',
  '--ink:#241f1a',
  '--cinnabar:#c8442e',
  '--celadon:#5f8d7d',
  '--gold:#c08a2e',
  '--line:#d8cbb4',
  '--on-accent:#fdf8ee',
]
const DARK = [
  '--paper:#17140f',
  '--ink:#f0e7d6',
  '--cinnabar:#e2694c',
  '--celadon:#7fae9c',
  '--gold:#d3a44a',
  '--line:#3b342a',
  '--on-accent:#1a1610',
]
const MAPS = [
  '--c-ok:var(--celadon)',
  '--c-mis:var(--gold)',
  '--c-primary:var(--cinnabar)',
]

export function checkTheme(dist) {
  const problems = []
  const assets = path.join(dist, 'assets')
  if (!fs.existsSync(assets)) {
    problems.push('dist/assets 不存在（先跑 npm run build）')
    return problems
  }

  const cssFiles = fs.readdirSync(assets).filter(f => f.endsWith('.css'))
  if (!cssFiles.length) {
    problems.push('产物里没有一个 .css')
    return problems
  }
  const css = cssFiles.map(f => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n')

  const media = (css.match(/prefers-color-scheme/g) || []).length
  if (media)
    problems.push('CSS 里有 ' + media + ' 处 prefers-color-scheme：暗色必须只由 html.dark / [data-theme=dark] 驱动')

  const darkSel = (css.match(/\.dark/g) || []).length
  if (darkSel < 5)
    problems.push('.dark 选择器只有 ' + darkSel + ' 处，UnoCSS 的 dark: 变体可能没生效（presetWind3 的 dark 选项）')

  for (const q of LIGHT) {
    if (!css.includes(q))
      problems.push('明色令牌缺失或值被改：' + q)
  }
  for (const q of DARK) {
    if (!css.includes(q))
      problems.push('暗色令牌缺失或值被改：' + q)
  }
  for (const q of MAPS) {
    if (!css.includes(q))
      problems.push('handle 语义色到主站色的映射被断开：' + q)
  }
  if (!css.includes('colorblind'))
    problems.push('色彩增强模式（.colorblind）的覆写不见了')

  const htmlPath = path.join(dist, 'index.html')
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8')
    if (!html.includes('dc-theme'))
      problems.push('index.html 没有 dc-theme 首帧定色脚本')
    if (!html.includes('metaTheme'))
      problems.push('index.html 没有 id=metaTheme 的 theme-color，切主题时浏览器界面色不会跟着变')
  }

  const js = fs.readdirSync(assets).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n')
  if (!js.includes('dc-tabbar'))
    problems.push('产物里没有 dc-tabbar：移动端底部标签栏没被打进去')

  return problems
}

function selftest() {
  const dir = fs.mkdtempSync(path.join(ROOT, '.selftest-theme-'))
  let ok = true
  try {
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true })
    const goodCss = LIGHT.concat(DARK, MAPS, ['.dark{a:b}', '.dark{c:d}', '.dark{e:f}', '.dark{g:h}', '.dark{i:j}', '.colorblind{z:1}']).join(';')
    fs.writeFileSync(path.join(dir, 'assets/a.css'), goodCss)
    fs.writeFileSync(path.join(dir, 'index.html'), '<html lang="zh-CN"><meta id="metaTheme"><script>localStorage.getItem("dc-theme")</script></html>')
    fs.writeFileSync(path.join(dir, 'assets/a.js'), 'x("dc-tabbar")')

    const good = checkTheme(dir)
    if (good.length) {
      ok = false
      console.log('[!!] 自检失败：合规产物被判为有问题')
      for (const x of good) console.log('     ' + x)
    }
    else { console.log('[ok] 合规产物：判为无问题') }

    fs.writeFileSync(path.join(dir, 'assets/a.css'), '@media(prefers-color-scheme:dark){:root{--paper:#fff;--ink:#000;--cinnabar:#111;--celadon:#222;--gold:#333;--line:#444;--on-accent:#555}}')
    fs.writeFileSync(path.join(dir, 'index.html'), '<html lang="zh-CN"></html>')
    fs.writeFileSync(path.join(dir, 'assets/a.js'), 'x("no tabbar")')

    const bad = checkTheme(dir)
    const want = ['prefers-color-scheme', '.dark', '明色令牌', '暗色令牌', '映射', 'colorblind', 'dc-theme', 'metaTheme', 'dc-tabbar']
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
  const problems = checkTheme(process.env.DIST_DIR || path.join(ROOT, 'dist'))
  if (problems.length) {
    console.log('[!!] 主题体检未通过：')
    for (const q of problems) console.log('  - ' + q)
    process.exit(1)
  }
  console.log('[ok] 主题体检通过')
}

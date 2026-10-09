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

// 盯哪几个色、值是多少，不在这里写死：从本站那份令牌副本（src/styles/tokens.css）当场读。
// 写死的色值会与正本各说各话——正本改了，这道闸门还在替旧配色说话。
const WATCH = ['--paper', '--ink', '--cinnabar', '--celadon', '--gold', '--line', '--on-accent']
function blockOf(raw, sel) {
  const i = raw.indexOf(sel)
  if (i < 0) return null
  const o = raw.indexOf('{', i)
  let d = 1, k = o + 1
  while (k < raw.length && d > 0) { if (raw[k] === '{') d++; else if (raw[k] === '}') d--; k++ }
  return raw.slice(o + 1, k - 1)
}
function readTokens() {
  const p = path.join(ROOT, 'src', 'styles', 'tokens.css')
  if (!fs.existsSync(p)) return { light: null, dark: null, problems: ['本站没有 src/styles/tokens.css：四站共用一套令牌，副本没了这道闸门就没依据'] }
  const raw = fs.readFileSync(p, 'utf8')
  const light = blockOf(raw, ':root{')
  const dark = blockOf(raw, ':root[data-theme="dark"]')
  const problems = []
  if (light === null) problems.push('令牌副本里没有 :root{ 块')
  if (dark === null) problems.push('令牌副本里没有 :root[data-theme="dark"] 块')
  const pick = (block) => WATCH.map(n => {
    const m = block && block.match(new RegExp('\\' + n + '\\s*:\\s*([^;]+);'))
    if (!m) { problems.push('令牌副本里找不到 ' + n); return null }
    return n + ':' + m[1].trim()
  }).filter(Boolean)
  return { light: light ? pick(light) : [], dark: dark ? pick(dark) : [], problems }
}
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

  const tokens = readTokens()
  problems.push(...tokens.problems)

  // 暗色必须只由 html.dark / [data-theme=dark] 驱动（当年 UnoCSS 退回 prefers-color-scheme，
  // 站内暗色跟系统偏好跑，与 dc-theme 开关各判一次，真拍出过两张一模一样的暗图）。
  // 唯一允许的例外：首帧兜底 —— @media (prefers-color-scheme: dark){ :root:not([data-theme]){…} }，
  // 一旦脚本写了 data-theme 就失效；没有 :not([data-theme]) 这层护栏的写法一律算违规。
  for (const m of css.matchAll(/prefers-color-scheme/g)) {
    const after = css.slice(m.index, m.index + 160)
    const b1 = after.indexOf('{')
    const b2 = after.indexOf('{', b1 + 1)
    const sel = b1 < 0 ? '' : after.slice(b1 + 1, b2 < 0 ? after.length : b2).trim()
    if (!/^:root:not\(\[data-theme\]\)/.test(sel))
      problems.push('prefers-color-scheme 没有 :root:not([data-theme]) 这层护栏：暗色会跟系统偏好跑，与 dc-theme 开关各判一次（写法「' + sel.slice(0, 40) + '」）')
  }

  const darkSel = (css.match(/\.dark/g) || []).length
  if (darkSel < 5)
    problems.push('.dark 选择器只有 ' + darkSel + ' 处，UnoCSS 的 dark: 变体可能没生效（presetWind3 的 dark 选项）')

  for (const q of tokens.light) {
    if (!css.includes(q))
      problems.push('明色令牌缺失或值被改：' + q)
  }
  for (const q of tokens.dark) {
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
    const t = readTokens()
    // 首帧兜底：带 :not([data-theme]) 护栏的那种写法必须放行，否则闸门会把正本自己判成违规
    const GUARDED = '@media (prefers-color-scheme: dark){:root:not([data-theme]){--paper:#17140f}}'
    const goodCss = t.light.concat(t.dark, MAPS, [GUARDED, '.dark{a:b}', '.dark{c:d}', '.dark{e:f}', '.dark{g:h}', '.dark{i:j}', '.colorblind{z:1}']).join(';')
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

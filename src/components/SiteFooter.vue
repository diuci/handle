<script setup lang="ts">
/**
 * 页脚：与主站 diuci.com、k12.diuci.com 同一块结构 ——
 * 左边三行（牌子 / 内容从哪来 / 许可与免责），右边同一组六个乐园链接。
 *
 * 之前汉兜整站没有页脚：署名藏在欢迎页里，法律页链接也只在欢迎页，
 * 一旦开始玩就再也够不着。别的站页脚都有，这里缺一条。
 */
const PARKS = [
  { href: 'https://k12.diuci.com/', label: '学古诗' },
  { href: 'https://lian.diuci.com/', label: '连词成句' },
  { href: '/', label: '汉兜' },
  { href: 'https://moon.diuci.com/', label: '遗失月冕' },
  { href: 'https://ink.diuci.com/', label: '丢词大作战' },
  { href: 'https://github.com/diuci/k12-chinese-poetry', label: '内容仓库' },
]
</script>

<template>
  <footer class="dc-foot">
    <div class="dc-foot-in">
      <div class="dc-foot-l">
        <a href="https://diuci.com/">丢词夺理 diuci.com</a> · 每天一个成语，也能猜五言、七言<br>
        诗句取自内容仓 253 篇课标必背课文 · 成语库沿用上游<br>
        <a href="https://k12.diuci.com/legal/" target="_blank">原文公有领域 · 注释 CC BY 4.0 · 代码 MIT · 版权与免责</a>
      </div>
      <nav aria-label="六个乐园">
        <a v-for="p in PARKS" :key="p.href" :href="p.href">{{ p.label }}</a>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
/* 逐值抄主站 footer：上边框、38px 上下留白、surface-3 底色、
   左块 13.4px / 行高 1.9、右侧链接 13.6px 悬停转朱砂 */
.dc-foot{border-top:1px solid var(--line);padding:38px 0 84px;margin-top:34px;background:var(--surface-3)}
.dc-foot-in{display:flex;flex-wrap:wrap;gap:16px 30px;align-items:center;justify-content:space-between;max-width:1160px;margin:0 auto;padding:0 24px;text-align:left}
.dc-foot-l{font-size:13.4px;color:var(--ink-faint);line-height:1.9}
.dc-foot-l a{color:var(--cinnabar);text-decoration:none}
.dc-foot-l a:hover{text-decoration:underline}
.dc-foot nav{display:flex;flex-wrap:wrap;gap:20px}
.dc-foot nav a{font-size:13.6px;color:var(--ink-soft);text-decoration:none;transition:color .2s}
.dc-foot nav a:hover{color:var(--cinnabar)}
@media(max-width:768px){
  .dc-foot{padding:28px 0 96px}
  .dc-foot-in{padding:0 16px}
}
</style>

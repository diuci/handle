<script setup lang="ts">
/**
 * 页脚：与主站 diuci.com、k12.diuci.com 同一块结构 ——
 * 左边三行（牌子 / 内容从哪来 / 许可与免责），右边同一组乐园链接。
 *
 * 之前汉兜整站没有页脚：署名藏在欢迎页里，法律页链接也只在欢迎页，
 * 一旦开始玩就再也够不着。别的站页脚都有，这里缺一条。
 *
 * 结构与样式单源 core/chrome.css（PLAN-全站统一-v3）；乐园数据单源 core/parks.json。
 * 站内链接不带 target="_blank"（v3 站内切换手感）。
 */
import parksData from '../../core/parks.json'
</script>

<template>
  <footer class="dc-foot">
    <div class="dc-foot-in">
      <div class="dc-foot-l">
        <a href="https://diuci.com/">丢词夺理 diuci.com</a> · 诗句取自内容仓课文 · 成语库沿用上游 · 注释 CC BY 4.0 · 代码 MIT ·
        <a href="https://k12.diuci.com/legal/">版权与免责</a>
      </div>
      <nav aria-label="八个乐园">
        <a v-for="p in parksData.parks" :key="p.href" :href="p.href">{{ p.label }}</a>
        <a href="mailto:hi@diuci.com">hi@diuci.com</a>
      </nav>
    </div>
  </footer>
</template>

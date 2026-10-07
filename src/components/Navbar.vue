<script setup lang="ts">
import { showDashboard, showHelp, showSettings, toggleTheme, useMask } from '~/state'
import { gamesCount } from '~/storage'

const toggleSettings = useToggle(showSettings)
const toggleDashboard = useToggle(showDashboard)

function openHelp() {
  showHelp.value = true
  useMask.value = false
}
</script>

<template>
  <nav class="dc-nav">
    <div class="dc-nav-in">
      <AppName />
      <!-- 与主站 diuci.com 顶栏同一组、同一顺序、同一措辞；
           本站那一项（汉兜）留在栏里并标当前页，和 k12 的「古诗文」一样。 -->
      <div class="dc-nav-btns dc-nav-tools">
        <button icon-btn title="玩法说明" @click="openHelp()">
          <div i-carbon-help />
        </button>
        <button v-if="gamesCount" icon-btn title="战绩" @click="toggleDashboard()">
          <div i-carbon-catalog />
        </button>
        <button icon-btn title="设置" @click="toggleSettings()">
          <div i-carbon-settings />
        </button>
      </div>
      <!-- 乐园那一排与主题钮一起靠右：主站是「牌子 | 乐园 | 圆钮」，
           站内工具摆在牌子后面，这样六个乐园的起点 x 与主站逐像素一致。 -->
      <div class="dc-nav-links" aria-label="六个乐园">
        <a href="https://diuci.com/" target="_blank">首页</a>
        <a href="https://k12.diuci.com/" target="_blank">学古诗</a>
        <a href="https://lian.diuci.com/" target="_blank">连词成句</a>
        <a href="https://ink.diuci.com/" target="_blank">丢词大作战</a>
        <a href="https://moon.diuci.com/" target="_blank">遗失月冕</a>
        <a href="/" aria-current="page" class="on">汉兜</a>
        <a href="https://github.com/diuci/k12-chinese-poetry" target="_blank">内容仓库</a>
      </div>
      <button class="theme-btn" type="button" aria-label="切换深色模式" title="切换深色模式" @click="toggleTheme()">
          <svg class="sun" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4.2"/>
            <path d="M12 2.4v2.1M12 19.5v2.1M2.4 12h2.1M19.5 12h2.1M5.2 5.2l1.5 1.5M17.3 17.3l1.5 1.5M18.8 5.2l-1.5 1.5M6.7 17.3l-1.5 1.5"/>
          </svg>
          <svg class="moon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8z"/>
          </svg>
      </button>
    </div>
  </nav>
</template>

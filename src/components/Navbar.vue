<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { showDashboard, showHelp, showSettings, toggleTheme, useMask } from '~/state'
import { gamesCount } from '~/storage'

const toggleSettings = useToggle(showSettings)
const toggleDashboard = useToggle(showDashboard)

function openHelp() {
  showHelp.value = true
  useMask.value = false
}

// 顶部菜单（v4.1）：小屏点开全部八站（含月冕/大作战——底栏不摆它们）；点外/Escape 收起
const menuOpen = ref(false)
const menuEl = ref<HTMLElement | null>(null)
function onDocClick(e: MouseEvent) {
  const n = e.target as Element | null
  if (menuOpen.value && n && !n.closest('.dc-menu') && !n.closest('.dc-menu-btn')) menuOpen.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') menuOpen.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
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
           站内工具摆在牌子后面，这样八项乐园的起点 x 与主站逐像素一致。
           不带 target="_blank"：六站互链一律当前页跳转（v3 站内切换手感）。 -->
      <div class="dc-nav-links" aria-label="八个乐园">
        <a href="https://diuci.com/">首页</a>
        <a href="https://k12.diuci.com/">学古诗</a>
        <a href="https://jiagu.diuci.com/">画甲骨</a>
        <a href="https://lian.diuci.com/">连词</a>
        <a href="https://zimi.diuci.com/">猜谜</a>
        <a href="/" aria-current="page" class="on">汉兜</a>
        <a href="https://moon.diuci.com/">月冕</a>
        <a href="https://ink.diuci.com/">大作战</a>
      </div>
      <button class="dc-menu-btn" type="button" aria-label="全部乐园" title="全部乐园"
              :aria-expanded="menuOpen ? 'true' : 'false'" @click.stop="menuOpen = !menuOpen">
        <svg class="i-bars" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6.8h16M4 12h16M4 17.2h16"/>
        </svg>
        <svg class="i-x" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
      <button class="dc-theme-btn" type="button" aria-label="切换深色模式" title="切换深色模式" @click="toggleTheme()">
          <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4.2"/>
            <path d="M12 2.4v2.1M12 19.5v2.1M2.4 12h2.1M19.5 12h2.1M5.2 5.2l1.5 1.5M17.3 17.3l1.5 1.5M18.8 5.2l-1.5 1.5M6.7 17.3l-1.5 1.5"/>
          </svg>
          <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8z"/>
          </svg>
      </button>
      <nav ref="menuEl" class="dc-menu" :hidden="!menuOpen" aria-label="全部乐园">
        <div class="dc-menu-in">
          <a href="https://diuci.com/">首页</a>
          <a href="https://k12.diuci.com/">学古诗</a>
          <a href="https://jiagu.diuci.com/">画甲骨</a>
          <a href="https://lian.diuci.com/">连词</a>
          <a href="https://zimi.diuci.com/">猜谜</a>
          <a href="/" class="on" aria-current="page">汉兜</a>
          <a href="https://moon.diuci.com/">月冕</a>
          <a href="https://ink.diuci.com/">大作战</a>
        </div>
      </nav>
    </div>
  </nav>
</template>

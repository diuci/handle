<script setup lang="ts">
import '~/init'
import { answer, dayNo, daySince, isDev, wordLength } from '~/state'
import { colorblind } from '~/storage'
import { DAYS_PLAY_BACK } from '~/logic/constants'

const { height, width } = useWindowSize()

watchEffect(() => {
  document.documentElement.style.setProperty('--vh', `` + (height.value / 100) + `px`)
})

/**
 * 格子尺寸。上游写死 5rem（80px）+ 每格 0.25rem 外边距，
 * 七言 7 格就是 7 × 88 = 616px，414px 的手机直接溢出。
 * 这里按「视口宽度 ÷ 格数」现算，上限仍是 80px，所以成语玩法看起来没变。
 */
watchEffect(() => {
  const n = wordLength.value
  // 七言格子密，间距收一半，不然 7 格在手机上更挤
  const gap = n >= 7 ? 2 : 4
  // 40px 是留给最挤的那个容器：规则页弹层自己还有 x5（20px × 2）的内边距，
  // 看板只有 p4（16px × 2）。按最挤的算，两边都不会被挤扁。
  const available = Math.min(width.value, 640) - 40
  const tile = Math.max(34, Math.min(80, Math.floor((available - n * gap * 2) / n)))
  const root = document.documentElement.style
  root.setProperty('--tile', `` + tile + `px`)
  root.setProperty('--tile-gap', `` + gap + `px`)
})
</script>

<template>
  <main class="dc-main" text="center" select-none :class="{ colorblind }">
    <NotTodayBanner v-if="dayNo < daySince" />
    <Navbar />
    <div p="4">
      <NoQuizToday v-if="!answer.word" />
      <NoFuturePlay v-else-if="dayNo > daySince && !isDev" />
      <NoPastPlay v-else-if="daySince - dayNo > DAYS_PLAY_BACK && !isDev" />
      <Play v-else />
    </div>
    <ModalsLayer />
    <Confetti />
    <TabBar />
  </main>
</template>

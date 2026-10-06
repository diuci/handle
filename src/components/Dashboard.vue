<script setup lang="ts">
import DashboardItem from './DashboardItem.vue'
import { t } from '~/i18n'
import { kind, showDashboard } from '~/state'
import { averageDurations, gamesCount, historyForKind, historyTriesCount, noHintPassedCount, passedCount, passedTries } from '~/storage'
import { checkValidIdiom, checkValidVerse } from '~/logic'

const triesMap = computed(() => {
  const map = new Map<number, number>()
  passedTries.value.forEach((i) => {
    let count = i.tries!.length
    if (count > 10)
      count = 10
    map.set(count, (map.get(count) || 0) + 1)
  })
  return map
})

const triesMax = computed(() => {
  let max = 0
  Array.from(triesMap.value.keys()).forEach((i) => {
    if (i > max)
      max = i
  })
  return max
})

const tiresMaxCount = computed(() => {
  let max = 1
  Array.from(triesMap.value.values()).forEach((i) => {
    if (i > max)
      max = i
  })
  return max
})

function close() {
  showDashboard.value = false
}

const allWords = computed(() => Array.from(new Set(Object.values(historyForKind.value).flatMap(i => i.tries).filter(Boolean) as string[])))
// 「用过的词里有多少是真实存在的」这个统计，也要按当前玩法查对应的词库
const validWords = computed(() => allWords.value.filter(i =>
  kind.value === 'idiom' ? checkValidIdiom(i, true) : checkValidVerse(i, kind.value, true),
))
</script>

<template>
  <div p5 flex="~ col center" relative>
    <div absolute top-4 right-4 flex="~ gap-3">
      <button icon-btn @click="close">
        <div i-carbon-close />
      </button>
    </div>

    <p text-xl font-serif mb2>
      <b>{{ t('dashboard') }}</b>
    </p>
    <div v-if="passedTries.length >= 3 && triesMax" w-full max-w-100 bg-gray:5 p4 my4>
      <p text-lg font-serif mb2 mt--1 text-center tracking-widest>
        {{ t('guess-dist') }}
      </p>
      <div v-for="i of triesMax" :key="i" flex="~" items-center gap-2>
        <div w-4 flex-none text-right op50>
          {{ i === 10 ? '10+' : i }}
        </div>
        <div bg-primary h-5 text-white text-right flex justify-end :style="{ width: triesMap.get(i) ? `${triesMap.get(i)! / tiresMaxCount * 100}%` : '1%' }">
          <div text-sm mya mr1>
            {{ triesMap.get(i) }}
          </div>
        </div>
      </div>
    </div>
    <div flex="~ wrap gap-4" justify-center min-w-100px py2>
      <DashboardItem :value="gamesCount" :text="t('games-count')" />
      <DashboardItem :value="passedCount" :text="t('win-count')" />
      <DashboardItem :value="noHintPassedCount" :text="t('win-no-hint-count')" />
      <DashboardItem :value="`${Math.round(passedCount / gamesCount * 100)}%`" :text="t('win-rate')" />
    </div>
    <div flex="~ wrap gap-4" justify-center min-w-100px py2>
      <DashboardItem :value="allWords.length" :text="kind === 'idiom' ? t('used-words') : t('used-words-verse')" />
      <DashboardItem :value="`${Math.round(validWords.length / allWords.length * 100)}%`" :text="kind === 'idiom' ? t('valid-words-rate') : t('valid-words-rate-verse')" />
    </div>
    <div flex="~ wrap gap-4" justify-center min-w-100px py2>
      <DashboardItem :value="(historyTriesCount / gamesCount).toFixed(1)" :text="t('average-tries-count')" />
      <DashboardItem :value="averageDurations || '-'" :text="t('average-durations')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MatchResult, MatchType, ParsedChar } from '~/logic/types'
import { inputMode, useCheckAssist } from '~/storage'
import { getSymbolState, useMask, useNumberTone } from '~/state'

const props = defineProps<{
  char?: ParsedChar
  answer?: MatchResult
  active?: boolean
}>()

const exact = computed(() => props.answer && Object.values(props.answer).every(i => i === 'exact'))

const parsed = computed(() => {
  if (props.answer)
    return props.answer
  if (!props.char || !useCheckAssist.value || !props.active)
    return

  // Assist coloring
  return {
    _1: getSymbolState(props.char._1, inputMode.value === 'sp' ? '_1' : undefined) === 'none' ? 'deleted' : undefined,
    _2: getSymbolState(props.char._2, inputMode.value === 'sp' ? '_2' : undefined) === 'none' ? 'deleted' : undefined,
    _3: getSymbolState(props.char._3) === 'none' ? 'deleted' : undefined,
    tone: getSymbolState(props.char.tone, 'tone') === 'none' ? 'deleted' : undefined,
  } as MatchResult
})

function getColor(result?: MatchType, isChar = false) {
  const pre = useMask.value
    ? `bg-current ` + (isChar ? ' !op70' : '!op40') + ` border border-current`
    : ''

  if (!result || exact.value)
    return pre

  const colors = {
    exact: 'text-ok',
    misplaced: 'text-mis',
    none: isChar ? 'op80' : 'op35',
    deleted: inputMode.value === 'zy' ? 'op30' : 'line-through op30',
  }
  return `` + pre + ` ` + colors[result]
}

const blockColor = computed(() => {
  if (!props.answer)
    return 'border-base'
  if (exact.value)
    return 'border-transparent bg-ok text-[var(--on-accent)]'
  return 'border-transparent bg-[var(--tag-bg)]'
})

const toneCharLocation = computed(() => {
  const part = props.char?._2 || ''
  return [
    part.lastIndexOf('iu') > -1 ? part.lastIndexOf('iu') + 1 : -1,
    part.lastIndexOf('a'),
    part.lastIndexOf('e'),
    part.lastIndexOf('o'),
    part.lastIndexOf('i'),
    part.lastIndexOf('u'),
    part.lastIndexOf('v'),
  ].find(i => i !== null && i >= 0) || 0
})

const vLocation = computed(() => {
  const part = props.char?._2 || ''
  return part.lastIndexOf('v')
})

const partTwo = computed(() => {
  const two = (props.char?._2 || '')
  const index = toneCharLocation.value
  // replace i with dot less for tone symbol
  if (!useNumberTone.value && two[index] === 'i')
    return `` + two.slice(0, index) + `ı` + two.slice(index + 1)
  return two
})

// 格子尺寸跟着玩法走：成语 4 格、五言 5 格、七言 7 格，
// 上游写死的 5rem 在七言下是 7 × 88 = 616px，414px 的手机放不下。
// 所有内部偏移都改成 --tile 的倍数（或拼音行内的 em），换尺寸才不会散架。
const tile = `var(--tile, 5rem)`
const hanziTop = computed(() => `calc(` + tile + ` * ` + (useMask.value ? 0.425 : 0.4) + `)`)
const zyLeft = computed(() => `calc(` + tile + ` * ` + (useMask.value ? 0.15 : 0.2) + `)`)
const pinyinTop = computed(() => `calc(` + tile + ` * ` + (useMask.value ? 0.175 : 0.1375) + `)`)
</script>

<template>
  <div
    class="block"
    border="2" rounded="[var(--radius)]"
    flex="~ center" relative
    leading-1em font-hanzi
    :class="blockColor"
  >
    <template v-if="char?.char?.trim()">
      <!-- Zhuyin -->
      <template v-if="inputMode === 'zy'">
        <div
          class="hanzi"
          absolute leading-1em flex items-center text-center font-hanzi
          top-0 bottom-0
          :class="getColor(parsed?.char, true)"
          :style="{ left: zyLeft }"
        >
          {{ char.char }}
        </div>
        <div
          absolute flex items-center text-center
          top-0 bottom-0
          :style="{ right: `calc(` + tile + ` * 0.125)`, width: `calc(` + tile + ` * 0.25)` }"
        >
          <div flex="~ center" class="small" style="writing-mode: vertical-rl">
            <span v-if="char._1" :class="getColor(parsed?._1)">
              {{ char._1 }}
            </span>
            <span v-if="char._2" :class="getColor(parsed?._2)">
              {{ char._2 }}
            </span>
            <span v-if="char._3" :class="getColor(parsed?._3)">
              {{ char._3 }}
            </span>
          </div>
          <ToneSymbol :tone="char.tone" :class="getColor(parsed?.tone)" mt--1 min-w-6px />
        </div>
      </template>

      <!-- Pinyin or Shuangpin -->
      <template v-else>
        <div
          class="hanzi"
          absolute leading-1em font-hanzi
          :class="getColor(parsed?.char, true)"
          :style="{ top: hanziTop }"
        >
          {{ char.char }}
        </div>
        <div
          class="pinyin"
          absolute font-mono
          text-center left-0 right-0 font-100 flex flex-col items-center
          :style="{ top: pinyinTop }"
        >
          <div
            relative ma items-start
            flex="~ x-center"
          >
            <div v-if="char._1" :class="getColor(parsed?._1)" mx-1px>
              {{ char._1 }}
            </div>
            <div v-if="partTwo" mx-1px flex>
              <div v-for="w, idx of partTwo" :key="idx" relative>
                <div :class="getColor(parsed?._2)">
                  {{ inputMode === 'sp' ? w : w.replace('v', 'u') }}
                </div>
                <VDots
                  v-if="!useMask && idx === vLocation && inputMode === 'py'"
                  :class="getColor(parsed?._2)"
                  absolute w="87%" left="8%" style="bottom: 0.76em"
                />
                <ToneSymbol
                  v-if="!useNumberTone && idx === toneCharLocation"
                  :tone="char.tone"
                  :class="getColor(parsed?.tone)"
                  absolute w="86%" left="8%"
                  :style="{
                    bottom: useMask
                      ? '1.25em'
                      : w === 'v'
                        ? '0.85em'
                        : '0.78em',
                  }"
                />
              </div>
            </div>
            <div
              v-if="useNumberTone"
              class="small"
              :class="getColor(parsed?.tone)"
              leading-1em mr--3 mt--1 ml-1px
            >
              {{ char.tone }}
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.block {
  width: var(--tile, 5rem);
  height: var(--tile, 5rem);
}
/* 上游是 text-3xl（1.875rem）配 5rem 的格子，比例 0.375 */
.hanzi {
  font-size: calc(var(--tile, 5rem) * 0.375);
  line-height: 1em;
}
/* 拼音行原本吃正文的 1rem，占格子的 0.2；格子缩到 45px 时 0.2 只剩 9px，
   所以夹一个 9px 的下限，七言在手机上还能读得清。 */
.pinyin {
  font-size: clamp(9px, calc(var(--tile, 5rem) * 0.2), 16px);
}
.small {
  font-size: 0.75em;
}
</style>

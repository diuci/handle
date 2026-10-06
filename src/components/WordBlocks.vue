<script setup lang="ts">
import { parseWord, parsedAnswer, testAnswer, answer as todayAnswer, wordLength } from '~/state'

const props = withDefaults(
  defineProps<{
    word: string
    revealed?: boolean
    answer?: string
    animate?: boolean
    active?: boolean
  }>(), {
    animate: true,
  },
)

const result = computed(() => {
  if (props.revealed) {
    return testAnswer(
      parseWord(props.word),
      props.answer ? parseWord(props.answer) : parsedAnswer.value,
    )
  }
  return []
})

const flip = ref(false)

watchEffect(() => {
  if (props.revealed) {
    setTimeout(() => {
      flip.value = true
    }, Math.random() * 300)
  }
})
</script>

<template>
  <div class="row" flex>
    <div
      v-for="c, i in parseWord(word.padEnd(wordLength, ' '), answer || todayAnswer.word)" :key="i"
      class="tile" :class="[flip ? 'revealed' : '']"
    >
      <template v-if="animate">
        <CharBlock
          class="front"
          :char="c"
          :active="active"
          :style="{ transitionDelay: `` + i * (300 + Math.random() * 50) + `ms` }"
        />
        <CharBlock
          class="back"
          :char="c"
          :answer="result[i]"
          :style="{
            transitionDelay: `` + i * (300 + Math.random() * 50) + `ms`,
            animationDelay: `` + i * (100 + Math.random() * 50) + `ms`,
          }"
        />
      </template>
      <template v-else>
        <CharBlock
          :char="c"
          :answer="result[i]"
          :active="active"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.row {
  flex-wrap: nowrap;
}
.tile {
  user-select: none;
  position: relative;
  /* flex: none —— 不许 flex 把格子压扁。压扁时 scrollWidth 恰好等于 clientWidth，
     体检的「不溢出」检查会被蒙混过关，格子却会挤成一条（梨、万 首当其冲）。 */
  flex: none;
  width: var(--tile, 5rem);
  height: var(--tile, 5rem);
  margin: var(--tile-gap, 0.25rem);
}
.tile .front,
.tile .back {
  position: absolute;
  top: 0;
  left: 0;
  transition: transform 0.6s;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.tile .back {
  transform: rotateY(180deg);
}
.tile.revealed .front {
  transform: rotateY(180deg);
}
.tile.revealed .back {
  transform: rotateY(0deg);
}
</style>

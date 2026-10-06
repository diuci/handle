<script setup lang="ts">
import { formatDuration, meta } from '~/storage'
import { t } from '~/i18n'
import { answer, dayNoHanzi, kind } from '~/state'

defineProps<{
  day?: boolean
}>()

const hintText = computed(() => {
  if (!meta.value.hintLevel)
    return t('hint-level-none')
  else if (meta.value.hintLevel === 1)
    return t('hint-level-1')
  else
    return t('hint-level-2')
})

// 出处只在猜完之后再出现：提前给等于泄题。
const source = computed(() => kind.value === 'idiom' ? undefined : answer.value.source)
</script>

<template>
  <div op50 my1 text-sm ws-nowrap text-center>
    <template v-if="day">
      {{ dayNoHanzi }} ·
    </template>
    {{ hintText }} ·
    <template v-if="meta.strict">
      {{ t('strict-mode') }} ·
    </template>
    {{ formatDuration(meta.duration || 0) }}
  </div>
  <div v-if="source" op60 my1 text-sm font-serif text-center>
    {{ t('verse-source') }}：{{ source }}
  </div>
</template>

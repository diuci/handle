<script setup lang="ts">
import { KINDS, KIND_LABEL_KEY, type Kind } from '~/logic'
import { kind } from '~/state'
import { t } from '~/i18n'

// 换玩法要先把上一局的弹层收起来，否则切到五言还挂着成语的失败弹窗。
const emit = defineEmits<{
  (e: 'change'): void
}>()

function pick(k: Kind) {
  if (kind.value === k)
    return
  kind.value = k
  emit('change')
}
</script>

<template>
  <div class="kind-switch" role="tablist" :aria-label="t('kind-switch')">
    <button
      v-for="k of KINDS" :key="k"
      class="kind-btn"
      :class="{ on: kind === k }"
      role="tab"
      :aria-selected="kind === k"
      @click="pick(k)"
    >
      {{ t(KIND_LABEL_KEY[k]) }}
    </button>
  </div>
</template>

<style scoped>
.kind-switch {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: calc(var(--radius) - 4px);
  background: var(--surface-3);
}
.kind-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font: inherit;
  font-size: 0.95rem;
  letter-spacing: 1px;
  padding: 4px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color .2s ease, color .2s ease;
}
.kind-btn:hover {
  color: var(--ink);
}
.kind-btn.on {
  background: var(--cinnabar);
  color: var(--on-accent);
}
</style>

import type { SpMode } from '@hankit/tools'
import { preferZhuyin, t } from './i18n'
import { dayNo, kind } from './state'
import type { InputMode, TriesMeta } from './logic'
import { emptyHistory, isLegacyHistory, migrateHistory } from './logic/history'

export const legacyTries = useStorage<Record<number, string[]>>('handle-tries', {})

/**
 * 战绩按玩法分开存：
 *   { idiom: { 1740: {...} }, wuyan: { 1740: {...} }, qiyan: { 1740: {...} } }
 *
 * 键名沿用上游的 handle-tries-meta，但形状变了。老玩家本地就是一份
 * { 1740: {...} }，不迁移等于把几百期战绩清空——这种事故一次就够，
 * 所以迁移写在读之前，而且有测试盯着（test/verse.test.ts）。
 */
export type { HistoryMap } from './logic/history'

const rawHistory = useStorage<Record<string, any>>('handle-tries-meta', {})
if (isLegacyHistory(rawHistory.value))
  rawHistory.value = migrateHistory(rawHistory.value)

export const history = rawHistory as Ref<HistoryMap>

export const initialized = useStorage('handle-initialized', false)

export const inputMode = useStorage<InputMode>('handle-mode', preferZhuyin ? 'zy' : 'py')
export const spMode = useStorage<SpMode>('handle-sp-mode', 'sougou')
export const colorblind = useStorage('handle-colorblind', false)
export const useNoHint = useStorage('handle-hard-mode', false)
export const useNumberTone = useStorage('handle-number-tone', false)
export const useCheckAssist = useStorage('handle-check-assist', false)
export const useStrictMode = useStorage('handle-strict', false)
export const acceptCollecting = useStorage('handle-accept-collecting', true)

export const meta = computed<TriesMeta>({
  get() {
    const k = kind.value
    if (!history.value[k])
      history.value[k] = {}
    if (!(dayNo.value in history.value[k]))
      history.value[k][dayNo.value] = {}
    return history.value[k][dayNo.value]
  },
  set(v) {
    const k = kind.value
    if (!history.value[k])
      history.value[k] = {}
    history.value[k][dayNo.value] = v
  },
})

export const tries = computed<string[]>({
  get() {
    if (!meta.value.tries)
      meta.value.tries = []
    // handle-tries 是成语玩法的老账本，五言 / 七言没有这份历史包袱。
    if (kind.value === 'idiom' && legacyTries.value[dayNo.value])
      return legacyTries.value[dayNo.value]
    return meta.value.tries
  },
  set(v) {
    meta.value.tries = v
  },
})

/** 当前玩法的全部战绩：战绩、胜率、分布都按玩法各算各的。 */
export const historyForKind = computed(() => history.value[kind.value] || {})

export const gamesCount = computed(() => Object.values(historyForKind.value).filter(m => m.passed || m.answer || m.failed).length)
export const passedTries = computed(() => Object.values(historyForKind.value).filter(m => m.passed))
export const passedCount = computed(() => passedTries.value.length)
export const noHintPassedCount = computed(() => Object.values(historyForKind.value).filter(m => m.passed && !m.hint).length)
export const historyTriesCount = computed(() => Object.values(historyForKind.value).filter(m => m.passed || m.answer || m.failed).map(m => m.tries?.length || 0).reduce((a, b) => a + b, 0))

export const triesCount = computed(() => tries.value.length)
export const averageDurations = computed(() => {
  const items = Object.values(historyForKind.value).filter(m => m.passed && m.duration)
  if (!items.length)
    return 0
  const durations = items.map(m => m.duration!).reduce((a, b) => a + b, 0)
  return formatDuration(durations / items.length)
})

export function markStart() {
  if (meta.value.end)
    return
  if (!meta.value.start)
    meta.value.start = Date.now()
}

export function markEnd() {
  if (meta.value.end)
    return

  if (!meta.value.duration)
    meta.value.duration = 0

  meta.value.end = Date.now()
  if (meta.value.start)
    meta.value.duration += meta.value.end - meta.value.start
}

export function pauseTimer() {
  if (meta.value.end)
    return

  if (!meta.value.duration)
    meta.value.duration = 0

  if (meta.value.start) {
    meta.value.duration += Date.now() - meta.value.start
    meta.value.start = undefined
  }
}

export function formatDuration(duration: number) {
  const ts = duration / 1000
  const m = Math.floor(ts / 60)
  const s = Math.floor(ts % 60)
  if (m)
    return m + t('minutes') + s + t('seconds')
  return s + t('seconds')
}

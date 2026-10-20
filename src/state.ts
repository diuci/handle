import { breakpointsTailwind } from '@vueuse/core'
import type { MatchType, ParsedChar } from './logic'
import { KIND_LENGTH, KIND_TRIES, START_DATE, type Kind, checkPass, getHint, isDstObserved, isKind, parseWord as _parseWord, testAnswer as _testAnswer } from './logic'
import { useNumberTone as _useNumberTone, inputMode, meta, spMode, tries } from './storage'
import { getAnswerOfDay } from './answers'

export const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isMobile = isIOS || /iPad|iPhone|iPod|Android|Phone|webOS/i.test(navigator.userAgent)
export const breakpoints = useBreakpoints(breakpointsTailwind)

export const now = useNow({ interval: 1000 })
// 主题存 cookie（domain=.diuci.com）：主站切到暗色，进汉兜仍是暗色（v4 跨站一致）。
// 上游用 useDark()，它读写的是 'vueuse-color-scheme'，与本站首帧脚本的键不是一个。
// localStorage 子域不共享，只读一次作老用户迁移。
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
function writeThemeCookie(v: 'light' | 'dark') {
  document.cookie = 'dc-theme=' + v + ';domain=.diuci.com;path=/;max-age=31536000;SameSite=Lax'
}
function readThemeCookie(): 'light' | 'dark' {
  const hit = document.cookie.split(/;\s*/).find(c => c.startsWith('dc-theme='))
  const v = hit ? hit.slice('dc-theme='.length) : null
  if (v === 'dark' || v === 'light') return v
  try {
    const s = localStorage.getItem('dc-theme')
    if (s === 'dark' || s === 'light') { writeThemeCookie(s); return s }
  }
  catch {}
  const d: 'light' | 'dark' = prefersDark ? 'dark' : 'light'
  writeThemeCookie(d)
  return d
}
export const theme = ref<'light' | 'dark'>(readThemeCookie())
export const isDark = computed(() => theme.value === 'dark')
export function toggleTheme() {
  theme.value = isDark.value ? 'light' : 'dark'
  writeThemeCookie(theme.value)
}
watchEffect(() => {
  const dark = isDark.value
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.getElementById('metaTheme')
  if (meta)
    meta.setAttribute('content', dark ? '#17140f' : '#f4ede0')
})
export const showHint = ref(false)
export const showSettings = ref(false)
export const showHelp = ref(false)
export const showShare = ref(false)
export const showFailed = ref(false)
export const showDashboard = ref(false)
export const showVariants = ref(false)
export const showCheatSheet = ref(false)
export const showShareDialog = ref(false)
export const useMask = ref(false)

export const useNumberTone = computed(() => {
  if (inputMode.value === 'sp')
    return true
  if (inputMode.value === 'zy')
    return false
  return _useNumberTone.value
})

const params = new URLSearchParams(window.location.search)
export const isDev = import.meta.hot || params.get('dev') === 'hey'

/**
 * 当前玩法。URL 的 ?mode= 优先于本地记忆，默认成语——
 * 老玩家点开链接看到的还是成语，不会因为多了两个玩法就换了题。
 */
const storedKind = useStorage<Kind>('handle-kind', 'idiom')
const urlKind = params.get('mode')
export const kind = ref<Kind>(isKind(urlKind) ? urlKind : storedKind.value)
watch(kind, (v) => {
  storedKind.value = v
})

export const wordLength = computed(() => KIND_LENGTH[kind.value])
export const triesLimit = computed(() => KIND_TRIES[kind.value])

export const daySince = useDebounce(computed(() => {
  // Adjust date for daylight saving time, assuming START_DATE is not in DST
  const adjustedNow = isDstObserved(now.value) ? new Date(+now.value + 3600000) : now.value
  return Math.floor((+adjustedNow - +START_DATE) / 86400000)
}))
export const dayNo = ref(+(params.get('d') || daySince.value))
// 期号用阿拉伯数字：numberToHanzi(1740) 出来是「千七百四十」（首位「一」被省），
// 拼成「第千七百四十期」读不通，且日号已过千期，汉字数字反而难读。
export const dayNoHanzi = computed(() => `第 ` + dayNo.value + ` 期`)

/**
 * ?word= 是调试用的强制答案。长度必须等于当前玩法的长度，
 * 否则「大漠孤烟直」打到成语玩法上就是 5 个格子对 4 个格子，整页错位。
 */
export const answer = computed(() => {
  const forced = params.get('word')
  if (forced && Array.from(forced).length === KIND_LENGTH[kind.value])
    return { word: forced, hint: getHint(forced) }
  return getAnswerOfDay(dayNo.value, kind.value)
})

export const hint = computed(() => answer.value.hint)
export const parsedAnswer = computed(() => parseWord(answer.value.word))

export const isPassed = computed(() => meta.value.passed || (tries.value.length && checkPass(testAnswer(parseWord(tries.value[tries.value.length - 1])))))
export const isFailed = computed(() => !isPassed.value && tries.value.length >= triesLimit.value)
export const isFinished = computed(() => isPassed.value || meta.value.answer)

export function parseWord(word: string, _ans = answer.value.word, mode = inputMode.value, spM = spMode.value) {
  return _parseWord(word, _ans, mode, spM)
}

export function testAnswer(word: ParsedChar[], ans = parsedAnswer.value) {
  return _testAnswer(word, ans)
}

export const parsedTries = computed(() => tries.value.map((i) => {
  const word = parseWord(i)
  const result = testAnswer(word)
  return {
    word,
    result,
  }
}))

export function getSymbolState(symbol?: string | number, key?: '_1' | '_2' | 'tone') {
  const results: MatchType[] = []
  for (const t of parsedTries.value) {
    for (let i = 0; i < wordLength.value; i++) {
      const w = t.word[i]
      const r = t.result[i]
      if (key) {
        if (w[key] === symbol)
          results.push(r[key])
      }
      else {
        if (w._1 === symbol)
          results.push(r._1)
        if (w._2 === symbol)
          results.push(r._2)
        if (w._3 === symbol)
          results.push(r._3)
      }
    }
  }
  if (results.includes('exact'))
    return 'exact'
  if (results.includes('misplaced'))
    return 'misplaced'
  if (results.includes('none'))
    return 'none'
  return null
}

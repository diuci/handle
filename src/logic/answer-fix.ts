import { KIND_TRIES, type Kind } from './kinds'
import { history } from '~/storage'
import { getAnswerOfDay } from '~/answers'

export function tryFixAnswer(day: number, kind: Kind) {
  const meta = history.value[kind]?.[day]
  const answer = getAnswerOfDay(day, kind)
  if (!meta)
    return
  if (!meta.answer && !meta.failed && !meta.passed)
    return

  const tries = meta.tries || []
  const index = tries.indexOf(answer.word)
  if (index < 0 || index >= tries.length - 1)
    return

  const newTries = tries.slice(0, index + 1)
  meta.tries = newTries
  if (index <= KIND_TRIES[kind]) {
    meta.passed = true
    meta.failed = false
    meta.answer = false
  }
  meta.duration = (meta.duration || 0) * newTries.length / tries.length
}

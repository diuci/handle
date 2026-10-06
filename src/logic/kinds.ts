/**
 * 玩法（kind）。
 *
 * 上游只有成语一种玩法，长度 4 是硬编码在常量里的。
 * 这里加了五言 / 七言，所以「几个字」「几次机会」都改成跟着玩法走。
 */

export type Kind = 'idiom' | 'wuyan' | 'qiyan'

export const KINDS: Kind[] = ['idiom', 'wuyan', 'qiyan']

export const KIND_LENGTH: Record<Kind, number> = {
  idiom: 4,
  wuyan: 5,
  qiyan: 7,
}

/** 猜测次数。三个玩法先都给 10 次：分享格子整齐，战绩口径一致。 */
export const KIND_TRIES: Record<Kind, number> = {
  idiom: 10,
  wuyan: 10,
  qiyan: 10,
}

/** i18n 键名。 */
export const KIND_LABEL_KEY: Record<Kind, string> = {
  idiom: 'kind-idiom',
  wuyan: 'kind-wuyan',
  qiyan: 'kind-qiyan',
}

export function isKind(v: unknown): v is Kind {
  return typeof v === 'string' && (KINDS as string[]).includes(v)
}

import type { TriesMeta } from './types'
import { KINDS, type Kind } from './kinds'

/**
 * 战绩存储的迁移逻辑，单独放一个文件纯粹是为了能被测试跑到：
 * storage.ts 在模块加载时就会碰 localStorage，测试环境里 import 它会炸。
 */
export type HistoryMap = Record<Kind, Record<number, TriesMeta>>

export function emptyHistory(): HistoryMap {
  return { idiom: {}, wuyan: {}, qiyan: {} }
}

/** 旧形状的特征：顶层键是纯数字（期号）。 */
export function isLegacyHistory(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return false
  return Object.keys(raw).some(k => /^\d+$/.test(k))
}

export function migrateHistory(raw: Record<string, any>): HistoryMap {
  const out = emptyHistory()
  for (const key of Object.keys(raw)) {
    const value = raw[key]
    if (!value || typeof value !== 'object')
      continue
    if (/^\d+$/.test(key))
      out.idiom[+key] = value
    else if ((KINDS as string[]).includes(key))
      out[key as Kind] = { ...value }
  }
  return out
}

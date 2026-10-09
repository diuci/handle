import hans from './locales/zh-cn.json'
import hant from './locales/zh-tw.json'

const lang = window.navigator.language?.toLowerCase() || ''
export const preferTraditional = lang.includes('hant') || lang.includes('tw') || lang.includes('hk')
export const preferZhuyin = lang.includes('tw')

export const locale = useStorage<'hans' | 'hant'>('handle-locale', preferTraditional ? 'hant' : 'hans')

export function t(key: keyof typeof hans, ...t: any[]): string {
  if (locale.value === 'hant') {
    // 不许静默择一（规范 §3）：繁体词典里没有这个词，就把 key 摊在页面上并当场说话，
    // 而不是悄悄退回简体——那样半繁半简没人发现。
    const tw = (hant as any)[key]
    if (tw === undefined) {
      console.error('[繁简] zh-tw.json 里没有这个键：' + key)
      return String(key)
    }
    return tw.replace(/\{(\d+)\}/g, (_, i) => t[i])
  }
  return hans[key].replace(/\{(\d+)\}/g, (_, i) => t[i])
}

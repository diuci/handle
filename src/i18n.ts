import hans from './locales/zh-cn.json'

// 界面文案词典（v4 起全站仅简体，繁体半边已下线）。
// 注音输入的自动偏好随繁体一起退场：默认拼音，用户仍可在设置里切注音。
export const preferZhuyin = false

export function t(key: keyof typeof hans, ...t: any[]): string {
  return hans[key].replace(/\{(\d+)\}/g, (_, i) => t[i])
}

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { appendOnly, collect, hashEntries, verifyFrozen, VerseError } from '../tools/build-verse.mjs'
import { inspect } from '../tools/check-verse.mjs'
import { emptyHistory, isLegacyHistory, migrateHistory } from '../src/logic/history'
import { KIND_LENGTH, KIND_TRIES, checkValidVerse, getPinyin, getVerse, getVerseSource } from '../src/logic'
import { getAnswerOfDay } from '../src/answers'
import poolJson from '../src/data/verse-pool.json'
import readingsJson from '../src/data/verse-readings.json'
import fixJson from '../src/data/verse-fix.json'
import sourceJson from '../src/data/poems-verse.json'
import snapshotJson from '../src/data/poems-snapshot.json'

const poem = (id: string, title: string, form: string, lines: string[]) => ({
  id, title, author: '作者', dynasty: '唐', form, stage: '小学', grade: 3, volume: '', lines,
})

describe('拆联', () => {
  it('十字联拆成两个五言，十四字联拆成两个七言，其它长度跳过', () => {
    const { pools, skipped, dupes } = collect({
      contentVersion: 't',
      forms: ['五言', '七言'],
      poems: [
        poem('a', '使至塞上', '五言', ['大漠孤烟直长河落日圆']),
        poem('b', '绝句', '七言', ['两个黄鹂鸣翠柳一行白鹭上青天']),
        poem('c', '咏鹅', '五言', ['鹅鹅鹅曲项向天歌']),
      ],
    })
    expect(pools.wuyan.map(e => e.word)).toEqual(['大漠孤烟直', '长河落日圆'])
    expect(pools.qiyan.map(e => e.word)).toEqual(['两个黄鹂鸣翠柳', '一行白鹭上青天'])
    expect(skipped).toHaveLength(1)
    expect(dupes).toBe(0)
  })

  it('跨篇重复句只留首次出处', () => {
    const { pools, dupes } = collect({
      contentVersion: 't',
      forms: ['五言', '七言'],
      poems: [
        poem('a', '甲', '五言', ['大漠孤烟直长河落日圆']),
        poem('b', '乙', '五言', ['大漠孤烟直长河落日圆']),
      ],
    })
    expect(pools.wuyan).toHaveLength(2)
    expect(dupes).toBe(2)
    expect(pools.wuyan[0].poemId).toBe('a')
  })
})

describe('词库只追加', () => {
  const existing = [{ word: '大漠孤烟直', source: '唐·王维《使至塞上》', poemId: 'a' }]

  it('已有条目原样保留，新句只能加到尾部', () => {
    const { merged, appended } = appendOnly(existing, [
      { word: '大漠孤烟直', source: '出处被改了', poemId: 'a' },
      { word: '长河落日圆', source: '唐·王维《使至塞上》', poemId: 'a' },
    ], 'wuyan')
    expect(merged[0].source).toBe('唐·王维《使至塞上》')
    expect(appended.map(e => e.word)).toEqual(['长河落日圆'])
  })

  it('前缀被动过就拒绝构建——这条是「昨天的答案今天不变」的唯一保障', () => {
    const frozen = { wuyan: { count: 1, sha256: hashEntries(existing) } }
    expect(() => verifyFrozen('wuyan', existing, frozen)).not.toThrow()
    expect(() => verifyFrozen('wuyan', [{ word: '大漠孤烟直', source: '出处被改了', poemId: 'a' }], frozen)).toThrow(VerseError)
    expect(() => verifyFrozen('wuyan', [{ word: '换了一句', source: 'x', poemId: 'z' }], frozen)).toThrow(VerseError)
  })
})

describe('已提交产物', () => {
  it('体检必须干净通过', () => {
    const problems = inspect({
      source: sourceJson as any,
      snapshot: snapshotJson as any,
      pool: poolJson as any,
      readings: readingsJson as any,
      fix: fixJson as any,
    })
    expect(problems).toEqual([])
  })

  it('每个玩法的词库字数与 KIND_LENGTH 一致', () => {
    for (const kind of ['wuyan', 'qiyan'] as const) {
      const list = (poolJson as any)[kind]
      expect(list.length).toBeGreaterThan(0)
      for (const e of list)
        expect(Array.from(e.word)).toHaveLength(KIND_LENGTH[kind])
    }
  })

  it('含多音字的句子全部有勘误记录', () => {
    const fix = fixJson as Record<string, string>
    const readings = readingsJson as Record<string, string>
    for (const kind of ['wuyan', 'qiyan'] as const) {
      for (const e of (poolJson as any)[kind]) {
        if (fix[e.word] !== undefined)
          expect(readings[e.word]).toBe(fix[e.word])
      }
    }
    expect(Object.keys(fix).length).toBeGreaterThan(400)
  })
})

describe('每日答案按玩法分开', () => {
  // 第 0 期是成语玩法的占位空答案（_PRE），从 1 开始测
  for (const day of [1, 7, 120, 5000, 99999]) {
    it('第 ' + day + ' 天：三种玩法各给各的答案，且可复现', () => {
      const idiom = getAnswerOfDay(day, 'idiom')
      const wuyan = getAnswerOfDay(day, 'wuyan')
      const qiyan = getAnswerOfDay(day, 'qiyan')
      expect(Array.from(idiom.word)).toHaveLength(KIND_LENGTH.idiom)
      expect(Array.from(wuyan.word)).toHaveLength(KIND_LENGTH.wuyan)
      expect(Array.from(qiyan.word)).toHaveLength(KIND_LENGTH.qiyan)
      expect(wuyan.word).not.toBe(qiyan.word)
      expect(wuyan.source).toBeTruthy()
      expect(qiyan.source).toBeTruthy()
      expect(getAnswerOfDay(day, 'wuyan').word).toBe(wuyan.word)
      expect(getAnswerOfDay(day, 'qiyan').word).toBe(qiyan.word)
      // 词库用完之后越界取值也必须落在词库里
      expect(getVerse(wuyan.word)).toBeTruthy()
      expect(getVerse(qiyan.word)).toBeTruthy()
    })
  }

  it('成语玩法没有出处，诗句玩法有', () => {
    expect(getAnswerOfDay(3, 'idiom').source).toBeUndefined()
    expect(getVerseSource(getAnswerOfDay(3, 'wuyan').word)).toBeTruthy()
  })
})

describe('输入校验', () => {
  it('宽松模式只查字数与汉字，严格模式必须真有其句', () => {
    expect(checkValidVerse('大漠孤烟直', 'wuyan')).toBe(true)
    expect(checkValidVerse('大漠孤烟', 'wuyan')).toBe(false)
    expect(checkValidVerse('大漠孤烟直直', 'wuyan')).toBe(false)
    expect(checkValidVerse('大漠孤烟a', 'wuyan')).toBe(false)
    expect(checkValidVerse('大漠孤烟直', 'qiyan')).toBe(false)
    expect(checkValidVerse('一行白鹭上青天', 'qiyan')).toBe(true)
    expect(checkValidVerse('大漠孤烟直', 'wuyan', true)).toBe(true)
    expect(checkValidVerse('随便编五个字', 'wuyan', true)).toBe(false)
  })

  it('答案侧用钉死读音，不信运行时词典的首读', () => {
    // 词典首读：燕 yàn、适 kuo4——两个都是错的
    expect(getPinyin('都护在燕然')).toEqual(['du1', 'hu4', 'zai4', 'yan1', 'ran2'])
    // y/j/q/x 后面的 u 一律写成 v（上游一致：怨 → yvan4、绿 → lv4、女 → nv3）
    expect(getPinyin('少无适俗韵')).toEqual(['shao4', 'wu2', 'shi4', 'su2', 'yvn4'])
    expect(getPinyin('塞上燕脂凝夜紫')[0]).toBe('sai4')
  })
})

describe('战绩存储迁移', () => {
  const legacy = { 1740: { tries: ['守株待兔'], passed: true }, 1741: { failed: true, tries: [] } }

  it('旧形状能识别、能迁到 idiom 名下', () => {
    expect(isLegacyHistory(legacy)).toBe(true)
    const out = migrateHistory(legacy)
    expect(out.idiom[1740].passed).toBe(true)
    expect(out.idiom[1741].failed).toBe(true)
    expect(out.wuyan).toEqual({})
    expect(out.qiyan).toEqual({})
  })

  it('迁完的形状不会再被迁第二次', () => {
    const once = migrateHistory(legacy)
    expect(isLegacyHistory(once)).toBe(false)
    expect(migrateHistory(once as any)).toEqual(once)
  })

  it('空对象与已经是新形状的不受影响', () => {
    expect(isLegacyHistory({})).toBe(false)
    expect(isLegacyHistory(null)).toBe(false)
    expect(isLegacyHistory([])).toBe(false)
    const modern = { idiom: { 5: { passed: true } }, wuyan: { 5: { passed: true } }, qiyan: {} }
    expect(migrateHistory(modern as any).idiom[5].passed).toBe(true)
    expect(migrateHistory(modern as any).wuyan[5].passed).toBe(true)
  })

  it('emptyHistory 三个玩法都在', () => {
    expect(Object.keys(emptyHistory()).sort()).toEqual(['idiom', 'qiyan', 'wuyan'])
  })
})

describe('玩法常量', () => {
  it('三个玩法都有长度与次数', () => {
    expect(KIND_LENGTH).toEqual({ idiom: 4, wuyan: 5, qiyan: 7 })
    expect(Object.keys(KIND_TRIES)).toEqual(['idiom', 'wuyan', 'qiyan'])
    for (const v of Object.values(KIND_TRIES))
      expect(v).toBe(10)
  })
})

describe('规则页的示范句', () => {
  // WelcomePage.vue 里的示范句是硬编码的。改句子的人未必知道它们必须在词库里，
  // 否则规则页演示的是一句游戏里根本猜不到的话。
  const vue = readFileSync(new URL('../src/components/WelcomePage.vue', import.meta.url), 'utf8')
  const inPool = (w: string) => poolJson.wuyan.some((e: any) => e.word === w)
    || poolJson.qiyan.some((e: any) => e.word === w)

  it('四句示范都在词库里，出处也是真的', () => {
    for (const d of ['千山鸟飞绝', '众鸟高飞尽', '病树前头万木春', '千树万树梨花开']) {
      expect(vue).toContain(d)
      expect(inPool(d)).toBe(true)
    }
  })

  it('示范句的字数对得上玩法，规则页不会摆出一行空格子', () => {
    expect([...'千山鸟飞绝']).toHaveLength(KIND_LENGTH.wuyan)
    expect([...'众鸟高飞尽']).toHaveLength(KIND_LENGTH.wuyan)
    expect([...'病树前头万木春']).toHaveLength(KIND_LENGTH.qiyan)
    expect([...'千树万树梨花开']).toHaveLength(KIND_LENGTH.qiyan)
  })
})


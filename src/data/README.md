# Sources

## `idioms.txt` / `polyphones.json`

Processed from https://github.com/pwxcoo/chinese-xinhua/blob/master/data/idiom.json

## `t2s.json`

Processed from https://github.com/mollykannn/translate-big5-gbk.git

## `extra.json`

From users' input

## 五言 / 七言玩法

| 文件 | 是什么 | 谁生成 |
| --- | --- | --- |
| `poems-verse.json` | 从内容仓抽出的五言 / 七言篇目（含每联原文） | `node tools/sync-poems.mjs` |
| `poems-snapshot.json` | 上面那份的来源指纹：内容仓的 `contentVersion` + 整文件 sha256 + 统计 | 同上 |
| `verse-pool.json` | 出题用的词库：拆成单句后的五言 226 句 / 七言 418 句，带出处与 `poemId`；`frozen` 记录已出题前缀的哈希 | `node tools/build-verse.mjs` |
| `verse-readings.json` | 每句的钉死读音（tone2 写法，与运行时拼音形式一致） | 同上 |
| `verse-fix.json` | 多音字勘误表：人工裁决过的读音，511 句 | 人工维护 |
| `verse-audit.md` | 裁决进度报告 | `node tools/audit-verse.mjs --report` |
| `verse-source-fixes.json` | 出处勘误表：词库冻结前缀里出处认错的句子，改认的出处与理由（词库本身不改写） | 人工维护 |

### 为什么答案的读音要钉死

多音字在词典里是一串候选，运行时字典只取第一个。「还来就菊花」的还、
「燕山月似钩」的燕、「少无适俗韵」的适，首读都是错的。答案的读音一旦跟着字典走，
同一期的答案就会随字典版本变，玩家昨天对的今天变成错的。

所以 `getPinyin()` 的顺序是：**钉死读音 → polyphones → 运行时字典**。
字典只用来给玩家的任意猜测注音，不用来给答案注音。

### 历史答案永不变

`verse-pool.json` 只追加。每次构建先复算 `frozen[kind]` 的 sha256，
前缀动过就拒绝构建；`check-verse` 在 CI 里再复算一遍。

## 繁体侧

| 文件 | 是什么 | 谁生成 |
| --- | --- | --- |
| `traditional.json` | 每日答案与诗句的繁体形：644 句诗句 + 407 条成语，带来源指纹与每一处「表给了别的写法」的记录 | `python tools/build-traditional.py` |
| `trad-rules.json` | 本站自己的繁简裁定（必须带理由），目前 1 条 | 人工维护 |

派生机只有一台：内容仓 `diuci/k12-chinese-poetry/tools/build-traditional.py`。本站这一支 import 它，
不写第二套繁简转换——否则本站的「繁体」与 k12.diuci.com 繁体版会长成分叉的两套字。
644 句里 640 句的繁体形不查表，从内容仓派生好的繁体正文里按「第几行第几字」取切片；
只有 4 句走繁简表（两句出处不在台账里、两句是教材正文之外的通行异文，理由见 `verse-source-fixes.json`）。

### 许可

诗文原文属公有领域。选篇编排、拆联、注音与勘误来自
[diuci/k12-chinese-poetry](https://github.com/diuci/k12-chinese-poetry)，
按 CC BY 4.0 授权，署名方式见仓库根目录 `NOTICE` 与页面底部。

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
| `verse-pool.json` | 出题用的词库：拆成单句后的五言 226 句 / 七言 410 句，带出处与 `poemId`；`frozen` 记录已出题前缀的哈希 | `node tools/build-verse.mjs` |
| `verse-readings.json` | 每句的钉死读音（tone2 写法，与运行时拼音形式一致） | 同上 |
| `verse-fix.json` | 多音字勘误表：人工裁决过的读音，503 句 | 人工维护 |
| `verse-audit.md` | 裁决进度报告 | `node tools/audit-verse.mjs --report` |

### 为什么答案的读音要钉死

多音字在词典里是一串候选，运行时字典只取第一个。「还来就菊花」的还、
「燕山月似钩」的燕、「少无适俗韵」的适，首读都是错的。答案的读音一旦跟着字典走，
同一期的答案就会随字典版本变，玩家昨天对的今天变成错的。

所以 `getPinyin()` 的顺序是：**钉死读音 → polyphones → 运行时字典**。
字典只用来给玩家的任意猜测注音，不用来给答案注音。

### 历史答案永不变

`verse-pool.json` 只追加。每次构建先复算 `frozen[kind]` 的 sha256，
前缀动过就拒绝构建；`check-verse` 在 CI 里再复算一遍。

### 许可

诗文原文属公有领域。选篇编排、拆联、注音与勘误来自
[diuci/k12-chinese-poetry](https://github.com/diuci/k12-chinese-poetry)，
按 CC BY 4.0 授权，署名方式见仓库根目录 `NOTICE` 与页面底部。

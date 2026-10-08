# 本站相对上游的改动

上游：[antfu/handle](https://github.com/antfu/handle)，MIT，版权归 Anthony Fu。
复刻基线 commit `2003b777f507ed18c1c80304fd6894280c56ad58`（2025-02-12，
`feat: replace picocolors with ansis (#98)`）。

法律层面的署名与许可见 [NOTICE](../NOTICE) 与 [LICENSE](../LICENSE)。
这份文件只记录**工程改动**，给后来接手的人看。

## 改了什么

1. **依赖与工具链**：不换框架，只升版本（Vite 4→8、UnoCSS 0.47→66、Vitest 0.25→5、
   TS 4.9→5.9、VueUse 9→15）；包管理从 pnpm 换成 npm；删除 Netlify 配置与已 EOL 的 eslint 8 配置。
2. **视觉**：配色、字体、纹理、顶栏、底部标签栏、圆角与阴影全部对齐主站 diuci.com 的设计语言；
   语义色逐值取自主站的 `:root` / `:root[data-theme="dark"]`。
3. **主题**：改用主站的 `localStorage['dc-theme']` + `<html data-theme>`，与主站、K12 站点互通。
4. **域名与身份**：`CNAME` 为 `handle.diuci.com`；标题、og、favicon、og 图换成本站的。
5. **测试**：Vitest 3 起移除内联测试（`import.meta.vitest`），三组内联测试原样搬入 `test/`，
   断言与快照未改。
6. **期号显示**：「第一千七百四十日」改为「第 1740 期」。
7. **外部链接**：上游作者的个人微博 / Twitter 入口换成本站的入口。
8. **三个玩法**：在成语之外加了五言、七言两个玩法，页面顶部可切换，
   格子尺寸按字数自适应（七言在 375px 宽下每格 45px）。

玩法逻辑、题库、出题算法（`seedrandom('day-N')`）、答案冻结日期、遮罩分享、
注音 / 双拼 / 繁体的开关**均未改动**。繁体开关原来只换界面词，现在底下多了一层繁体字形与出处
（见「繁体侧」一节），开关本身没动。

## 五言 / 七言玩法（本站新增，与上游无关）

- 内容来源：[diuci/k12-chinese-poetry](https://github.com/diuci/k12-chinese-poetry)，
  经 `tools/sync-poems.mjs` 抽取，`src/data/poems-snapshot.json` 留下来源指纹（sha256 + contentVersion）。
- 上游没有的东西：诗句词库、拆联规则（十字联拆两个五言、十四字联拆两个七言）、
  钉死读音表 `verse-readings.json` 与勘误表 `verse-fix.json`、按玩法分开的每日答案与战绩。
- 上游玩法逻辑未改：`parseWord` / `testAnswer` / `checkPass` / `getHint` 照旧，
  只是把「四字」参数化成 `KIND_LENGTH`，把 `handle-tries-meta` 按玩法分桶（带一次性迁移）。

## 繁体侧（本站新增）

- 设置里的「繁体 / 简体」开关是上游的，原来只换界面词（127 个词条双语），
  答案字形与诗句出处仍是简体。本站补的是内容侧。
- 派生机只有一台：内容仓 `diuci/k12-chinese-poetry/tools/build-traditional.py`。
  本站的 `tools/build-traditional.py` import 它，不写第二套繁简转换——
  否则本站的「繁体」与 k12.diuci.com 繁体版会长成分叉的两套字。
- 644 句五言 / 七言里 640 句的繁体形**不查表**：从内容仓已经派生好的繁体正文里按
  「第几行第几字」取切片，与 k12.diuci.com 繁体版是同一份字。只有 4 句走繁简表：
  两句的出处不在 252 篇台账里——「今人不见古时月，今月曾经照古人」是李白《把酒问月》，
  不在张若虚《春江花月夜》里，内容仓《春江花月夜》页的勘误记着这件事；
  另两句是教材正文之外的通行异文（「不拘一格降人才」「彩丝穿取当银铮」）。
  这四句改认的出处与理由记在 `src/data/verse-source-fixes.json`，词库本身一个字节没动。
- 407 条每日答案成语过那台机器：554 处「表给了别的写法」全部留在产物里，本站裁定 1 处
  （不寒而栗 → 不寒而慄：词组表给整条成语的繁体形就是「不寒而慄」，被单字表挡了下来）。
- 词库 `idioms.txt` 不繁体化；猜的匹配走简体归一化（`toSimplified`），
  拼音走 `getPinyin` 的简体回退——繁体输入照样对得上，拼音提示不会因为换字形而错。
  **繁体只改显示，不改玩法。**
- 产物 `src/data/traditional.json` 带来源指纹（内容仓 poems.json / traditional.json 的 sha256）。
  `npm run check:trad`（12 项自检）与 `python tools/build-traditional.py --selftest`（15 处断言）
  都串在 `npm run selftest` 里；`--check` 用来证明产物没被人手改过。

## 未采用上游的部分

- `netlify.toml` 与 `@netlify/functions`：本站由 GitHub Pages + GitHub Actions 部署。
- `public/tiger.svg`：全仓 0 引用。
- 上游 `public/og.png` 与上游 favicon：属上游品牌资产，已替换。
- `axios` / `nanoid` / `lru-cache` / `jsdom` / `@vue/test-utils` / `@iconify-json/noto-v1`：grep 确认全仓未使用。

## 决定不做的优化

见 [docs/phase2-pinyin.md](./phase2-pinyin.md)：「离线预生成拼音表、去掉运行时 `pinyin` 字典」
——实测之后确认它省不了体积（反而多 17 KB gz）、也只省 3–33 ms，已降级为按需触发。
写在这里是为了不让后来的人再把它当成待办性能优化。

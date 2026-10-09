#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把本站玩法要用的文字派生成繁体，产出 src/data/traditional.json。

为什么这个脚本是 Python：繁简派生只允许有一台机器，那台机器在内容仓
（diuci/k12-chinese-poetry/tools/build-traditional.py）。本站不自己写第二套转换，
否则两边的「繁体」会长成分叉的两套字。这里 import 那台机器，只加本站自己的裁定。

派生分两路，两路的证据强度不一样：

1) 五言 / 七言（636 句）——**不查表**。内容仓已经逐篇派生过繁体正文
   （来源页亲眼写作那个字 > 裁定表 > 表首选项），本站只是按位置把同一行取过来。
   所以这里的繁体与 k12.diuci.com 繁体版是同一份字，不会各翻各的。
2) 成语（每日答案那几百条）——内容仓没有这些词（它们是上游汉兜的词库），只能过那台机器。
   词组表被单字表挡下来的候选不静默丢掉；每一处「表给了别的写法」都记在产物里。

用法：
  python tools/build-traditional.py            生成 src/data/traditional.json
  python tools/build-traditional.py --check    重新派生一遍，与已提交的产物比对（CI 用）
  python tools/build-traditional.py --selftest 坏例子自检：这个脚本自己能不能发现问题
"""

import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'src' / 'data'
OUT = DATA / 'traditional.json'
RULES = DATA / 'trad-rules.json'
LOCAL_CONTENT = ROOT.parent / 'k12-chinese-poetry'
REMOTE_REPO = 'https://github.com/diuci/k12-chinese-poetry.git'
HAN = re.compile(r'[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]')


class TradError(Exception):
    pass


def die(msg):
    raise TradError(msg)


def engine_call(fn, *args):
    """派生机内部用 SystemExit 报错；本站把它接成 TradError，好让自检能一项一项试。"""
    try:
        return fn(*args)
    except SystemExit as e:
        die(str(e))


def sha256(buf):
    return hashlib.sha256(buf).hexdigest()


def load_engine(content_root):
    """载入内容仓那台派生机。找不到就停，不许本站自己凑一套。"""
    p = content_root / 'tools' / 'build-traditional.py'
    if not p.exists():
        die('找不到内容仓的派生机 %s\n本站不自己写第二套繁简转换' % p)
    spec = importlib.util.spec_from_file_location('btrad', p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def read_content(content_root, name):
    p = content_root / 'data' / name
    if not p.exists():
        die('内容仓里没有 data/%s' % name)
    return p.read_bytes()


def fetch_remote():
    tmp = tempfile.mkdtemp(prefix='k12-poetry-')
    repo = os.path.join(tmp, 'repo')
    r = subprocess.run(['git', 'clone', '--depth', '1', REMOTE_REPO, repo],
                       capture_output=True, text=True)
    if r.returncode != 0:
        die('克隆内容仓失败：\n' + (r.stderr or r.stdout or ''))
    return Path(repo), tmp


def strip_han(s):
    return ''.join(HAN.findall(s))


def load_source_fixes(where=None):
    """出处勘误表（src/data/verse-source-fixes.json）。derive=table 的句子不按教材繁体行取字。"""
    p = Path(where) if where else DATA / 'verse-source-fixes.json'
    if not p.exists():
        return {}
    d = json.loads(p.read_text(encoding='utf-8'))
    for k, v in d.items():
        if not (v.get('why') or '').strip():
            die('出处勘误「%s」没写凭什么' % k)
        if v.get('derive') not in (None, 'table'):
            die('出处勘误「%s」的 derive 只认 table，写的是 %s' % (k, v.get('derive')))
    return d


def load_rules():
    if not RULES.exists():
        return []
    arr = json.loads(RULES.read_text(encoding='utf-8'))
    for r in arr:
        if not (r.get('why') or '').strip():
            die('裁定 %s → %s 没写凭什么。本站的裁定必须带理由，否则等于让表替我们决定'
                % (r.get('simp'), r.get('pick')))
    return arr


# ---------------------------------------------------------------- 五言 / 七言

def verse_trad(pool, trad_rows, poems, s2c, engine, s2p, rules, fixes):
    """按位置把内容仓已经派生好的繁体行取过来。不查表、不猜字。"""
    by_id = {p['id']: p for p in poems}
    out = {}
    for kind in ('wuyan', 'qiyan'):
        for e in pool.get(kind) or []:
            word = e.get('word') or ''
            pid = e.get('poemId')
            if not word or not pid:
                die('%s：%s 这一句没有 poemId，没法回到出处' % (kind, word))
            fix = fixes.get(word) or {}
            p = by_id.get(pid)
            if p is None and not fix:
                die('%s：「%s」的出处 %s 不在内容仓的 poems.json 里' % (kind, word, pid))
            row = trad_rows.get(pid)
            if row is None and not fix:
                die('%s：《%s》在内容仓的繁体派生产物里没有这一篇' % (kind, p.get('title')))
            if fix.get('derive') == 'table':
                trad, marks = engine_call(engine.convert, word, s2p, s2c, set())
                engine_call(engine.apply_rules, marks, rules)
                trad = engine_call(engine.apply_picks, trad, marks)
                named = []
                for x in marks:
                    others = [y for y in (x.get('cands') or []) if y != x.get('simp')]
                    if not others and not x.get('pick'):
                        continue
                    named.append({'cands': x.get('cands'), 'decision': x.get('decision'),
                                  'pick': x.get('pick'), 'simp': x.get('simp')})
                src_label = fix.get('source') or e.get('source') or ''
                src_trad, _ = engine_call(engine.convert, src_label, s2p, s2c, set())
                out[word] = {
                    'at': -1,
                    'derive': 'table',
                    'forks': named,
                    'line': -1,
                    'poemId': fix.get('poemId') or pid,
                    'sourceTrad': src_trad,
                    'trad': trad,
                    'why': fix.get('why') or '',
                }
                continue
            simp_lines = p.get('fullLinesPunct') or p.get('linesPunct') or []
            trad_lines = row.get('text_trad') or row.get('lines_trad') or []
            if not simp_lines:
                die('%s：《%s》的简体正文是空的' % (kind, p.get('title')))
            if len(simp_lines) != len(trad_lines):
                die('%s：《%s》简体正文 %d 行，繁体派生 %d 行，对不上'
                    % (kind, p.get('title'), len(simp_lines), len(trad_lines)))
            want = strip_han(word)
            hit = None
            for i, (sl, tl) in enumerate(zip(simp_lines, trad_lines)):
                hs, ht = strip_han(sl), strip_han(tl)
                if len(hs) != len(ht):
                    die('%s：《%s》第 %d 行简体 %d 字、繁体 %d 字，逐字对不齐'
                        % (kind, p.get('title'), i + 1, len(hs), len(ht)))
                j = hs.find(want)
                if j >= 0:
                    hit = (i, j, hs[j:j + len(want)], ht[j:j + len(want)])
                    break
            if hit is None:
                die('%s：「%s」在《%s》的简体正文里找不到这一行' % (kind, word, p.get('title')))
            i, j, seg_s, seg_t = hit
            if seg_s != want:
                die('%s：「%s」取出来是「%s」，与词库里的字不一样' % (kind, word, seg_s))
            if len(seg_t) != len(seg_s):
                die('%s：「%s」的繁体切片 %d 字，简体 %d 字' % (kind, word, len(seg_t), len(seg_s)))
            allowed = {x.get('char') for x in (row.get('left_behind') or [])
                       if isinstance(x, dict) and (x.get('why') or '').strip()}
            for ch in seg_t:
                if ch in s2c and ch not in s2c[ch] and ch not in allowed:
                    die('%s：「%s」的繁体形「%s」里留下只有简体才用的字「%s」，'
                        '内容仓那一行也没写凭什么' % (kind, word, seg_t, ch))
            labels = row.get('labels_trad') or {}
            out[word] = {
                'at': j,
                'line': i,
                'poemId': pid,
                'sourceTrad': '%s·%s《%s》' % (p.get('dynasty') or '',
                                               labels.get('author') or p.get('author') or '',
                                               labels.get('title') or p.get('title') or ''),
                'trad': seg_t,
            }
    return out


# ---------------------------------------------------------------- 成语

def answer_trad(words, engine, s2p, s2c, extra_rules):
    """成语不在内容仓的词库里，只能过那台派生机。每一处分歧都要留在产物里。"""
    out = {}
    forks = 0
    ruled = 0
    for r in extra_rules:
        if not (r.get('why') or '').strip():
            die('裁定 %s → %s 没写凭什么' % (r.get('simp'), r.get('pick')))
    for w in words:
        trad, marks = engine_call(engine.convert, w, s2p, s2c, set())
        engine_call(engine.apply_rules, marks, extra_rules)
        trad = engine_call(engine.apply_picks, trad, marks)
        for ch in trad:
            if ch in s2c and ch not in s2c[ch]:
                named = any(x.get('pick') == ch or x.get('kept') == ch
                            or (x.get('simp') == ch and x.get('decision') in ('identity', 'keep'))
                            or (len(x.get('simp') or '') > 1 and ch in (x.get('simp') or ''))
                            for x in marks)
                if not named:
                    die('成语「%s」的繁体形「%s」里留下只有简体才用的字「%s」，却说不出凭什么'
                        % (w, trad, ch))
        named = []
        for x in marks:
            others = [y for y in (x.get('cands') or []) if y != x.get('simp')]
            if not others and not x.get('pick'):
                continue
            forks += 1
            named.append({'cands': x.get('cands'), 'decision': x.get('decision'),
                          'pick': x.get('pick'), 'simp': x.get('simp')})
            if x.get('pick'):
                ruled += 1
        out[w] = {'forks': named, 'trad': trad}
    return out, forks, ruled


def extract_answers():
    src = (ROOT / 'src' / 'answers' / 'list.ts').read_text(encoding='utf-8')
    pairs = re.findall(r"\['([^'\\\[\]]{2,10})',\s*'([^']*)'\]", src)
    words = sorted({p[0] for p in pairs})
    if len(words) < 300:
        die('从 src/answers/list.ts 只抓到 %d 条答案，解析方式八成不对了' % len(words))
    return words


def build(content_root):
    engine = load_engine(content_root)
    s2c = engine.read_table(engine.STC)
    s2p = engine.read_table(engine.STP)
    poems_raw = read_content(content_root, 'poems.json')
    trad_raw = read_content(content_root, 'traditional.json')
    poems = json.loads(poems_raw.decode('utf-8'))['poems']
    trad_doc = json.loads(trad_raw.decode('utf-8'))
    trad_rows = {r['id']: r for r in trad_doc.get('rows') or []}
    pool = json.loads((DATA / 'verse-pool.json').read_text(encoding='utf-8'))
    fixes = load_source_fixes()
    rules = load_rules()
    verses = verse_trad(pool, trad_rows, poems, s2c, engine, s2p, rules, fixes)
    answers, forks, ruled = answer_trad(extract_answers(), engine, s2p, s2c, rules)
    # 走繁简表派生的那几句诗句也有分歧，一样要计入条数——
    # 条数写少了，体检那边一数就对不上（这道对账已经真的拦过一次）。
    for v in verses.values():
        for f in (v.get('forks') or []):
            forks += 1
            if f.get('pick'):
                ruled += 1
    return {
        'counts': {'answers': len(answers), 'forks': forks, 'ruled': ruled, 'verse': len(verses)},
        'engine': 'diuci/k12-chinese-poetry · tools/build-traditional.py',
        'rules': load_rules(),
        'source': {
            'poemCount': len(poems),
            'poemsJsonSha256': sha256(poems_raw),
            'repo': 'diuci/k12-chinese-poetry',
            'tradPending': (trad_doc.get('counts') or {}).get('pending'),
            'tradPendingApparatus': (trad_doc.get('counts_apparatus') or {}).get('pending'),
            'traditionalJsonSha256': sha256(trad_raw),
        },
        'answers': answers,
        'verse': verses,
    }


# ---------------------------------------------------------------- CLI

def selftest():
    bad = 0
    tried = [0]   # 当场数的坏例子个数：不许从源码文本里数，那个数会把计数那一行自己也数进去
    engine = load_engine(LOCAL_CONTENT)
    s2c = engine.read_table(engine.STC)
    s2p = engine.read_table(engine.STP)
    poems = json.loads(read_content(LOCAL_CONTENT, 'poems.json').decode('utf-8'))['poems']
    trad_rows = {r['id']: r for r in json.loads(
        read_content(LOCAL_CONTENT, 'traditional.json').decode('utf-8'))['rows']}
    pool = json.loads((DATA / 'verse-pool.json').read_text(encoding='utf-8'))
    good = {'wuyan': [dict(e) for e in pool.get('wuyan')], 'qiyan': [dict(e) for e in pool.get('qiyan')]}
    first_id = good['wuyan'][0]['poemId']

    rules = load_rules()
    fixes = load_source_fixes()

    def expect(pool_, rows_, label):
        tried[0] += 1
        try:
            verse_trad(pool_, rows_, poems, s2c, engine, s2p, rules, fixes)
        except TradError:
            return
        print('坏例：%s 没被发现' % label)
        # 先前这一处只 print 不计数：坏例 1–5 永远不可能让自检失败，
        # 护栏哪天塌了，自检照样打印「通」——空过的检查比没有检查更危险。
        nonlocal bad
        bad += 1

    # 1) 诗句在出处正文里根本找不到
    p1 = {k: [dict(e) for e in v] for k, v in good.items()}
    p1['wuyan'][0]['word'] = '小娃撑小艇儿'
    expect(p1, trad_rows, '词库里有一句在出处正文里找不到')
    # 2) 出处 id 指向一篇内容仓里没有的诗
    p2 = {k: [dict(e) for e in v] for k, v in good.items()}
    p2['wuyan'][0]['poemId'] = '没有这篇'
    expect(p2, trad_rows, '出处 id 指向内容仓里没有的一篇')
    # 3) 繁体派生少一行
    r3 = {k: dict(v) for k, v in trad_rows.items()}
    r3[first_id] = dict(r3[first_id])
    r3[first_id]['text_trad'] = []
    r3[first_id]['lines_trad'] = (r3[first_id].get('lines_trad') or [])[:-1]
    expect(good, r3, '简体 2 行、繁体派生只 1 行')
    # 4) 繁体那一行比简体多字
    r4 = {k: dict(v) for k, v in trad_rows.items()}
    r4[first_id] = dict(r4[first_id])
    r4[first_id]['text_trad'] = []
    r4[first_id]['lines_trad'] = ['小娃撐小艇，偷采白蓮回。多出來三個字。', '不解藏蹤跡，浮萍一道開。']
    expect(good, r4, '繁体那一行比简体多字，逐字对不齐')
    # 5) 繁体行里留着只有简体才用的字还没有依据
    r5 = {k: dict(v) for k, v in trad_rows.items()}
    r5[first_id] = dict(r5[first_id])
    r5[first_id]['text_trad'] = []
    r5[first_id]['lines_trad'] = ['小娃撑小艇，偷采白蓮回。', '不解藏蹤跡，浮萍一道開。']
    expect(good, r5, '繁体行里留着只有简体才用的「撑」却没有依据')
    # 6) 词库条目缺出处 id
    p6 = {k: [dict(e) for e in v] for k, v in good.items()}
    p6['qiyan'][0]['poemId'] = None
    expect(p6, trad_rows, '词库里有一句没有出处 id')
    # 7) 裁定没写理由
    tried[0] += 1
    try:
        answer_trad(['万事如意'], engine, s2p, s2c, [{'simp': '万事如意', 'pick': '萬事如意'}])
        print('坏例：裁定没写理由却没被拦'); bad += 1
    except TradError:
        pass
    # 8) 裁定挑了候选里没有的字
    tried[0] += 1
    try:
        answer_trad(['不寒而栗'], engine, s2p, s2c,
                    [{'simp': '不寒而栗', 'pick': '不寒而凜', 'why': '凭空造的字'}])
        print('坏例：裁定挑了候选里没有的字却没被拦'); bad += 1
    except TradError:
        pass
    # 9) 分歧没留在产物里：把词组表里那条整条删掉，转换就只剩逐字照抄
    tried[0] += 1
    try:
        s2p2 = dict(s2p)
        s2p2.pop('不寒而栗', None)
        t, marks = engine_call(engine.convert, '不寒而栗', s2p2, s2c, set())
        t = engine_call(engine.apply_picks, t, marks)
        if t == '不寒而栗' and not any(len(x.get('cands') or []) > 1 for x in marks):
            print('坏例：词组表那条一撤，「栗 / 慄」这处分歧就从产物里消失了'); bad += 1
    except TradError:
        pass
    # 10) 出处勘误表：derive 写错、没写理由，都必须被拦（拿真的读表函数试，不在自检里重写一遍）
    tmp = DATA / '_selftest-fixes.json'
    try:
        good = json.loads((DATA / 'verse-source-fixes.json').read_text(encoding='utf-8'))
        b1 = {k: dict(v) for k, v in good.items()}
        next(iter(b1.values()))['derive'] = 'guess'
        tmp.write_text(json.dumps(b1, ensure_ascii=False), encoding='utf-8')
        tried[0] += 1
        try:
            load_source_fixes(tmp)
            print('坏例：出处勘误的 derive 写错了却没被拦'); bad += 1
        except TradError:
            pass
        b2 = {k: dict(v) for k, v in good.items()}
        next(iter(b2.values()))['why'] = ''
        tmp.write_text(json.dumps(b2, ensure_ascii=False), encoding='utf-8')
        tried[0] += 1
        try:
            load_source_fixes(tmp)
            print('坏例：出处勘误没写理由却没被拦'); bad += 1
        except TradError:
            pass
    finally:
        tmp.unlink(missing_ok=True)
    # 11) 答案列表解析塌了
    tried[0] += 1
    try:
        src = (ROOT / 'src' / 'answers' / 'list.ts').read_text(encoding='utf-8')
        n = len({p[0] for p in re.findall(r"\['([^'\\\[\]]{2,10})',\s*'([^']*)'\]", src)})
        n2 = len({p[0] for p in re.findall(r"\['([^'\\\[\]]{2,10})',\s*'([^']*)'\]", src.replace("['路不拾遗', '遗'],", '', 1))})
        if n == n2:
            print('坏例：答案列表少一条却没影响条数——条数下限这道闸没用'); bad += 1
    except TradError:
        pass
    if bad == 0:
        print('[ok] build-traditional --selftest 通（当场数到 %d 个坏例子，全部试到）' % tried[0])
        return 0
    print('[!] build-traditional --selftest 失败 %d 项' % bad)
    return 1


def main():
    check = '--check' in sys.argv
    if '--selftest' in sys.argv:
        return selftest()
    tmp = None
    content = LOCAL_CONTENT
    if not content.exists():
        content, tmp = fetch_remote()
    try:
        doc = build(content)
    except TradError as e:
        print('[繁体派生] %s' % e)
        return 1
    finally:
        if tmp:
            import shutil
            shutil.rmtree(tmp, ignore_errors=True)
    body = json.dumps(doc, ensure_ascii=False, indent=1, sort_keys=True)
    if check:
        if not OUT.exists():
            print('[繁体派生] 产物 %s 不在，先跑一次生成' % OUT)
            return 1
        if OUT.read_text(encoding='utf-8').strip() != body.strip():
            print('[繁体派生] 已提交的产物与重新派生的结果不一致：要么来源变了没重跑，要么产物被人手改过')
            return 1
        print('[繁体派生] 产物与来源一致：%d 句诗句、%d 条成语、%d 处分歧（本站裁定 %d 处）'
              % (doc['counts']['verse'], doc['counts']['answers'],
                 doc['counts']['forks'], doc['counts']['ruled']))
        return 0
    OUT.write_text(body + '\n', encoding='utf-8')
    print('[繁体派生] %d 句诗句、%d 条成语、%d 处分歧（本站裁定 %d 处）→ src/data/traditional.json'
          % (doc['counts']['verse'], doc['counts']['answers'],
             doc['counts']['forks'], doc['counts']['ruled']))
    return 0


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""엠케이아틀라스 서점 — 책 목록 · 도구 목록 만들기

아틀라스 네 저장소(역사 · 철학 · 과학 · 정치)에 있는 모든 읽을거리를 책으로, 눌러서 쓰는 것(지도 · 놀이판 · 계보도 ·
찾기 · 검사 · 영상)을 도구로 모아 data/books.json 하나로 묶는다. 표지 그림이 있으면 assets/covers/ 에 줄여 복사한다.
네 저장소는 읽기만 한다(아무것도 쓰지 않는다).

분야: 역사 · 철학 · 문학 · 예술 · 과학 · 사회. 과학은 학년(초등 3~4 · 초등 5~6 · 중학 · 일반)을 더 단다.
책의 종류(kind): series(여러 편), collection(여러 장을 한 권으로 묶음), single(한 지면), route(이야기 루트), map(지도), tool(찾기 · 검사), video(영상)
과학 밖의 도구(지도 · 계보도 · 찾기 · 검사 · 영상)도 한 편짜리 책이 되고, 「도구 모음」에는 과학아틀라스 것만 남는다.
과학 밖의 책은 모두 시대 여섯 칸(ERAS: 고대 · 중세 · 근세 · 근대 · 현대 · 시대를 넘어)에 꽂는다 — shelf 가 시대, 원래 갈래는 tag.

쓰는 법
  python3 scripts/build_books.py                 # 저장소들이 이 폴더 옆(../atlas 등)에 있을 때
  python3 scripts/build_books.py --src /home/user  # 네 저장소가 들어 있는 폴더를 직접 지정
  python3 scripts/build_books.py --no-covers     # 표지 그림 복사 없이 목록만
  python3 scripts/build_books.py --program       # data/program.json 의 상영 목록(items)도 채널 영상으로 채움

필요한 것: python3, node(아틀라스 자료 파일이 자바스크립트라서), Pillow(표지 줄이기, 없으면 그림 없이 진행)
"""
import argparse
import ast
import glob
import json
import os
import re
import subprocess
import sys
from collections import Counter, OrderedDict
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ATLASES = [
    {'id': 'history', 'name': '역사아틀라스', 'short': '역사', 'site': 'https://atlas.mkhz.kr', 'repo': 'atlas', 'spine': '#7a3b2a'},
    {'id': 'philo', 'name': '철학아틀라스', 'short': '철학', 'site': 'https://philo.mkhz.kr', 'repo': 'philo-atlas', 'spine': '#1f2c4d'},
    {'id': 'science', 'name': '과학아틀라스', 'short': '과학', 'site': 'https://science.mkhz.kr', 'repo': 'science-atlas', 'spine': '#1f6f6b'},
    {'id': 'politics', 'name': '정치아틀라스', 'short': '정치', 'site': 'https://politics.mkhz.kr', 'repo': 'politics-atlas', 'spine': '#5f6b2e'},
]
SITE = {a['id']: a['site'] for a in ATLASES}

# 분야 (책등 색은 분야 색을 따른다)
FIELDS = [
    {'id': 'history', 'name': '역사', 'ico': '🏯', 'color': '#7a3b2a', 'note': '1층 책장 골목 — 서쪽 끝부터 고대 · 중세 · 근세 · 근대 · 현대 · 시대를 넘어. 칸마다 읽을거리 · 이야기 루트 · 지도와 도구, 세계사도 같은 시대 칸에'},
    {'id': 'philo', 'name': '철학', 'ico': '🪞', 'color': '#1f2c4d', 'note': '2층 다락 서가 — 칸마다 시대 하나. 사상가 · 큰 질문 · 논쟁 · 사상 지도 · 오늘의 필사'},
    {'id': 'literature', 'name': '문학', 'ico': '📜', 'color': '#8a4b6b', 'note': '2층 다락 서가 — 칸마다 시대 하나. 신화와 서사시 · 옛 문학 · 일기와 기행 · 노벨문학상 · 말모이'},
    {'id': 'art', 'name': '예술', 'ico': '🎨', 'color': '#3e8e5a', 'note': '2층 다락 서가 — 음악가와 화가 · 음악사 · 미술사 · 국악'},
    {'id': 'science', 'name': '과학', 'ico': '🔭', 'color': '#1f6f6b', 'note': '자료실 · 발견 카드 · 어린이 과학 · 중학 과학과 수학 · 오늘의 과학',
     'grades': [{'id': 'kids-low', 'name': '초등 3~4학년'}, {'id': 'kids-high', 'name': '초등 5~6학년'}, {'id': 'middle', 'name': '중학교'}, {'id': 'general', 'name': '일반'}]},
    {'id': 'society', 'name': '사회', 'ico': '🏛️', 'color': '#5f6b2e', 'note': '1층 책장 골목 동쪽 끝 — 시대 순. 정치의 기초 · 법과 헌법 · 경제와 부동산 · 권력의 기록 · 아틀라스 투데이 · 찾아보기'},
]
GRADE_NAME = {'kids-low': '초등 3~4학년', 'kids-high': '초등 5~6학년', 'middle': '중학교', 'general': '일반'}

# 두 저장소에 같이 있는 시리즈는 한 곳에만 꽂는다
HOME_RANK = {'philo': 0, 'science': 1, 'politics': 2, 'history': 3}

CANON_RE = re.compile(r'<link\s+rel="canonical"\s+href="([^"]+)"')
OG_IMG_RE = re.compile(r'<meta\s+property="og:image"\s+content="([^"]+)"')
TITLE_RE = re.compile(r'<title>([^<]*)</title>')
DESC_RE = re.compile(r'<meta\s+name="description"\s+content="([^"]*)"')


def log(*a):
    print(*a, file=sys.stderr)


def node_json(cwd, code):
    out = subprocess.run(['node', '-e', code], cwd=cwd, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def node_load(cwd, files, names, extra='', expr=None):
    """브라우저용 자바스크립트 자료 파일(const X = …)을 읽어 JSON 으로."""
    code = "const fs=require('fs');global.window=global.window||{};global.document=undefined;"
    code += "function ld(f,names){let s=fs.readFileSync(f,'utf8');for(const n of names)s=s.replace(new RegExp('(const|let|var)\\\\s+'+n+'\\\\b'),'global.'+n);eval(s);}"
    for f in files:
        code += f"ld({json.dumps(f)},{json.dumps(names)});"
    code += extra
    code += "process.stdout.write(JSON.stringify(" + (expr or '{' + ','.join(f'{n}:(typeof {n}==="undefined"?null:{n})' for n in names) + '}') + "))"
    return node_json(cwd, code)


def py_const(path, name):
    tree = ast.parse(open(path, encoding='utf-8').read())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in node.targets):
            return ast.literal_eval(node.value)
    raise KeyError(f'{name} not in {path}')


def read(path):
    try:
        return open(path, encoding='utf-8').read()
    except OSError:
        return None


def canonical(path, fallback):
    html = read(path)
    if html:
        m = CANON_RE.search(html)
        if m:
            return m.group(1)
    return fallback


def html_title(path, strip_site=True):
    html = read(path) or ''
    m = TITLE_RE.search(html)
    t = plain(m.group(1)) if m else ''
    if strip_site:
        t = re.split(r'\s*[|]\s*', t)[0]
        t = re.sub(r'\s*[—–-]\s*(역사 아틀라스|철학아틀라스|과학 아틀라스|정치아틀라스|엠케이아틀라스)\s*$', '', t)
    d = DESC_RE.search(html)
    return t.strip(), (plain(d.group(1)) if d else '')


# ---------- 글 다듬기 ----------
def plain(s):
    if not s:
        return ''
    if isinstance(s, dict):
        s = s.get('ko') or ''
    if isinstance(s, list):
        s = ' '.join(plain(x) for x in s)
    s = str(s)
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\[\[[^\]|]+\|([^\]]+)\]\]', r'\1', s)
    s = re.sub(r'\[\[([^\]]+)\]\]', r'\1', s)
    s = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', s)
    s = s.replace('**', '').replace('__', '').replace('&amp;', '&').replace('&quot;', '"').replace('&#39;', "'")
    s = re.sub(r'^#+\s*', '', s, flags=re.M)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def first_sentence(s, limit=110):
    s = plain(s)
    if not s:
        return ''
    s = s.lstrip('【「『"\' ')
    m = re.search(r'(.+?[.?!。])(?=\s|$|["\'”’」』)])', s)
    out = (m.group(1) if m else s).strip()
    if len(out) > limit:
        cut = out[:limit]
        p = max(cut.rfind(', '), cut.rfind(' '))
        out = (cut[:p] if p > limit * 0.6 else cut).rstrip(' ,') + '…'
    return out


def split_title(full, name):
    full = plain(full or '')
    name = plain(name or '')
    if ' — ' in full:
        a, b = full.split(' — ', 1)
        return (name or a).strip(), b.strip()
    return (name or full).strip(), ''


def clip_line(s, limit=90):
    s = plain(s)
    return s if len(s) <= limit else first_sentence(s, limit)


def post_text(p):
    for k in ('body_ko', 'original_ko', 'claim_ko', 'translation_ko', 'commentary_ko', 'rebuttal_ko', 'desc_ko'):
        v = p.get(k)
        if v and plain(v):
            return v
    return ''


def book(**kw):
    b = {'kind': 'series', 'shelf': 'misc', 'shelfName': '그 밖에', 'grade': None, 'period': '', 'blurb': '', 'first': '',
         'hero': None, 'heroUrl': None, 'heroNote': '', 'tag': '', 'subtitle': ''}
    b.update(kw)
    b['toc'] = [{'t': plain(t)[:120] or '…', 'u': u} for t, u in b['toc'] if u]
    return b


def tool(**kw):
    t = {'ico': '🧰', 'note': '', 'grade': '', 'kind': 'tool'}
    t.update(kw)
    return t


# =====================================================================
# 역사아틀라스
# =====================================================================
ATLAS_ERA = {
    'prehistory': ('고조선 · 선사', '선사부터 삼한까지'), 'ancient': ('고대 · 삼국과 남북국', '삼국시대 · 통일신라 · 발해'),
    'medieval1': ('고려', '918~1392'), 'medieval2': ('조선', '1392~1910'), 'root': ('근대 · 개항기와 일제강점기', '1876~1945'),
    'modern2': ('해방 이후 현대사', '1945~1993'), 'contemporary': ('현대사', '1994~오늘'),
}
ATLAS_ERA_ORDER = ['prehistory', 'ancient', 'medieval1', 'medieval2', 'root', 'modern2', 'contemporary']
LIT_ROUTE = re.compile(r'literature|ilgi|illok|yeonhaengnok|pyohaerok|uiyudang|swaemirok|hunminjeongeum')
SOC_ROUTE = re.compile(r'party-history|disaster-history|cult-and-power|partisan-word')


def ev_url(era, slug):
    return f'{SITE["history"]}/event/{slug}' if era == 'root' else f'{SITE["history"]}/maps/{era}/event/{slug}'


def load_history(src):
    repo = os.path.join(src, 'atlas')
    H = SITE['history']
    books, tools = [], []
    # ---- 자료실 시리즈 ----
    series = node_json(repo, "const fs=require('fs'),vm=require('vm'),path=require('path');const a=[];"
                       "const sb={window:{registerArchiveSeries:s=>a.push(s)},console};vm.createContext(sb);"
                       "for(const f of fs.readdirSync('content/archive').filter(f=>f.endsWith('.js')).sort())"
                       "vm.runInContext(fs.readFileSync(path.join('content/archive',f),'utf8'),sb);"
                       "process.stdout.write(JSON.stringify(a))")
    gp = os.path.join(repo, 'build', 'generate_archive_pages.py')
    sub_labels = py_const(gp, 'SUBCATEGORY_LABELS')
    sub_fix = {'era_study_premodern': '시대연구', 'memorial_garden': '기억의 뜰', 'thinkers': '사상가'}
    SOC_SERIES = {'punishment_records', 'power_and_time', 'unequal_measures', 'prosecutorial_reckoning'}
    for s in series:
        sid = s['id']
        slug = sid.replace('_', '-')
        parts = []
        for p in s.get('posts', []):
            f = os.path.join(repo, 'archive', slug, p['id'] + '.html')
            if not os.path.exists(f):
                continue
            parts.append((p.get('title_ko') or p['id'], canonical(f, f'{H}/archive/{slug}/{p["id"]}')))
        if not parts:
            continue
        title, subtitle = split_title(s.get('full_name'), s.get('name'))
        cat, sub = s.get('category') or 'history', s.get('subcategory') or ''
        first = ''
        for p in s.get('posts', []):
            first = first_sentence(post_text(p))
            if first:
                break
        hero = s.get('hero_image')
        if cat == 'literature':
            field, shelf, shelfName = 'literature', 'classic', '옛 문학'
        elif sid in SOC_SERIES:
            field, shelf, shelfName = 'society', 'power', '권력과 책임의 기록'
        elif cat == 'world_history':
            field, shelf, shelfName = 'history', 'world', '세계사'
        elif cat == 'biographies':
            field, shelf, shelfName = 'history', 'bio', '인물열전'
        else:
            field = 'history'
            shelf = {'primary_sources': 'sources', 'revisionism': 'revisionism', 'memorial_garden': 'memorial'}.get(sub, 'era')
            shelfName = {'sources': '사료읽기', 'revisionism': '역사왜곡에 맞서다', 'memorial': '기억의 뜰', 'era': '시대연구'}[shelf]
        books.append(book(key=sid, atlas='history', field=field, shelf=shelf, shelfName=shelfName, tag=sub_labels.get(sub) or sub_fix.get(sub, ''),
                          title=title, subtitle=subtitle, period=plain(s.get('period')), blurb=clip_line(s.get('tagline') or s.get('description') or ''),
                          first=first, url=canonical(os.path.join(repo, 'archive', slug, 'index.html'), f'{H}/archive/{slug}/'),
                          hero=os.path.join(repo, hero) if hero else None, heroUrl=f'{H}/{hero}' if hero else None,
                          heroNote=plain(s.get('hero_ai_note')) if s.get('hero_ai') else plain(s.get('hero_credit')), toc=parts))
    # ---- 사건 연표: 시대별 한 권 ----
    try:
        idx = json.load(open(os.path.join(repo, 'build', 'atlas_index.json'), encoding='utf-8'))
        slugs = json.load(open(os.path.join(repo, 'build', 'event_slugs.json'), encoding='utf-8'))
        by_era = {}
        for ev in idx['events'].values():
            era = ev.get('era')
            slug = slugs.get(era, {}).get(ev['id'])
            if not slug:
                continue
            by_era.setdefault(era, []).append(ev)
        for era in ATLAS_ERA_ORDER:
            evs = by_era.get(era) or []
            if not evs:
                continue
            evs.sort(key=lambda e: (int(e.get('year') or 0), int(e.get('month') or 0) if str(e.get('month')).isdigit() else 0, int(e.get('day') or 0) if str(e.get('day')).isdigit() else 0))
            name, per = ATLAS_ERA[era]
            toc = [(f"{e.get('year')} · {e.get('title')}", ev_url(era, slugs[era][e['id']])) for e in evs]
            hub = f'{H}/events/' if era == 'root' else f'{H}/maps/{era}/events/'
            books.append(book(key=f'events_{era}', atlas='history', field='history', shelf='events', shelfName='사건 연표', kind='collection',
                              title=f'{name} 사건 연표', subtitle=f'{per} · 사건 {len(evs)}건', period=per,
                              blurb=f'{name} 시대 지도에 찍힌 사건 {len(evs)}건을 시간순으로 한 권에 묶었습니다. 각 장은 그 사건의 기록 지면으로 이어집니다.',
                              first=first_sentence(evs[0].get('summary')), url=hub, toc=toc))
    except Exception as e:  # noqa
        log('  역사: 사건 연표를 못 읽음', e)
    # ---- 인물 151명 ----
    try:
        ps = json.load(open(os.path.join(repo, 'data', 'people_slugs.json'), encoding='utf-8'))
        intro = json.load(open(os.path.join(repo, 'data', 'people_intro.json'), encoding='utf-8'))
        toc = []
        for name, slug in ps.items():
            nm = name.split('|')[0]
            if os.path.exists(os.path.join(repo, 'person', slug, 'index.html')):
                toc.append((nm, f'{H}/person/{slug}/'))
        books.append(book(key='people', atlas='history', field='history', shelf='people', shelfName='인물', kind='collection',
                          title='사건으로 보는 사람들', subtitle=f'역사 인물 {len(toc)}명', blurb='한 사람이 겪은 사건들을 시간순으로 늘어놓으면 한 생애가 보입니다. 선사부터 현대까지 역사 인물 한 사람 한 사람의 궤적.',
                          first=first_sentence(next(iter(intro.values()), '')), url=f'{H}/person/', toc=toc))
    except Exception as e:  # noqa
        log('  역사: 인물을 못 읽음', e)
    # ---- 루트 84 (이야기) ----
    try:
        R = node_json(repo, "global.window={};require('./content/routes_index.js');process.stdout.write(JSON.stringify(window.ATLAS_ROUTES))")
        era_dir = {'modern': ('root', 'route', 'event'), 'prehistory': ('prehistory', 'maps/prehistory/route', 'maps/prehistory/event'), 'ancient': ('ancient', 'maps/ancient/route', 'maps/ancient/event'),
                   'medieval1': ('medieval1', 'maps/medieval1/route', 'maps/medieval1/event'), 'medieval2': ('medieval2', 'maps/medieval2/route', 'maps/medieval2/event'),
                   'modern2': ('modern2', 'maps/modern2/route', 'maps/modern2/event'), 'contemporary': ('contemporary', 'maps/contemporary/route', 'maps/contemporary/event')}
        for era in R['eras']:
            ekey, rdir, edir = era_dir[era['id']]
            ename = ATLAS_ERA[ekey][0]
            for it in era['items']:
                slug = it['id'].replace('_', '-')
                href = it.get('href', '')
                page = os.path.join(repo, href)
                if not os.path.exists(page):
                    continue
                url = canonical(page, H + '/' + href.replace('.html', ''))
                if it.get('kind') in ('lineage', 'distribution', 'timeline', 'memorial'):
                    tools.append(tool(id=f'history-{it["id"]}', atlas='history', field='history', name=plain(it['name']), note=clip_line(it.get('tagline'), 60), url=url, ico={'lineage': '🌳', 'distribution': '📍', 'timeline': '⏳', 'memorial': '🕯️'}.get(it['kind'], '🗺️'), kind='map'))
                    continue
                wps = sorted(glob.glob(os.path.join(repo, edir, f'route-{slug}--wp_*.html')))
                toc = []
                for w in wps:
                    t, _ = html_title(w)
                    t = t.split(' — ' + plain(it['name']))[0] if ' — ' + plain(it['name']) in t else t
                    toc.append((t, canonical(w, H + '/' + os.path.relpath(w, repo).replace('.html', ''))))
                if not toc:
                    toc = [(plain(it['name']) + ' 루트 지도', url)]
                sl = slug
                if LIT_ROUTE.search(sl):
                    field, shelf, shelfName = 'literature', 'routes', '글로 걷는 길 (일기 · 기행 · 문학 루트)'
                elif 'art-history' in sl:
                    field, shelf, shelfName = 'art', 'routes', '예술사 루트'
                elif SOC_ROUTE.search(sl):
                    field, shelf, shelfName = 'society', 'routes', '사회의 기록 루트'
                else:
                    field, shelf, shelfName = 'history', 'routes', '이야기 루트'
                img = it.get('image')
                hero = os.path.join(repo, img.lstrip('/')) if img else None
                books.append(book(key=f'route_{it["id"]}', atlas='history', field=field, shelf=shelf, shelfName=shelfName, kind='route', tag=ename,
                                  title=plain(it['name']), subtitle=plain(it.get('tagline')), period=plain(it.get('period')),
                                  blurb=f'지도 위를 {it.get("waypoints") or len(toc)}곳 걸으며 읽는 이야기. 장마다 그 자리의 기록 지면이 열립니다.',
                                  first='', url=url, hero=hero if hero and os.path.exists(hero) else None, heroUrl=(H + img) if img else None, heroNote='', toc=toc))
        for it in R.get('cross', []):
            page = os.path.join(repo, it.get('href', ''))
            if not os.path.exists(page):
                continue
            url = canonical(page, H + '/' + it['href'].replace('.html', ''))
            tools.append(tool(id=f'history-{it["id"]}', atlas='history', field='society' if it['id'] in ('forced_mobilization', 'memorial_garden', 'rescuers_1950') else 'history', name=plain(it['name']), note=clip_line(it.get('tagline'), 60), url=url,
                              ico={'lineage': '🌳', 'distribution': '📍', 'timeline': '⏳', 'memorial': '🕯️'}.get(it.get('kind'), '🗺️'), kind='map'))
    except Exception as e:  # noqa
        log('  역사: 루트를 못 읽음', e)
    # ---- 한 줄 역사 · 이달의 역사 · 질문에서 시작하기 · FAQ ----
    flow = os.path.join(repo, 'flow', 'index.html')
    if os.path.exists(flow):
        secs = [('선사', 'seonsa'), ('상고', 'sanggo'), ('삼국과 가야', 'samguk'), ('남북국', 'nambuk'), ('고려', 'goryeo'), ('조선', 'joseon'), ('근대', 'geundae'), ('현대', 'hyeondae')]
        t, d = html_title(flow)
        books.append(book(key='flow', atlas='history', field='history', shelf='guide', shelfName='길잡이', kind='single', title='한 줄로 보는 우리 역사', subtitle='한국사 큰 줄기',
                          blurb=d or '처음이라면 여기서. 선사부터 현대까지 149개 정거장으로 이어지는 한 줄.', url=f'{H}/flow/', toc=[(n, f'{H}/flow/#{a}') for n, a in secs]))
    cal = sorted(glob.glob(os.path.join(repo, 'calendar', '[0-9][0-9].html')))
    if cal:
        toc = []
        for c in cal:
            t, _ = html_title(c)
            toc.append((t or os.path.basename(c), canonical(c, f'{H}/calendar/{os.path.basename(c)[:-5]}')))
        books.append(book(key='calendar', atlas='history', field='history', shelf='guide', shelfName='길잡이', kind='collection', title='이달의 역사', subtitle='달력으로 보는 역사',
                          blurb='그달 하루하루에 있었던 일, 이달의 독립운동가, 기억할 날.', url=f'{H}/calendar/', toc=toc))
    asks = sorted(glob.glob(os.path.join(repo, 'ask', '*', 'index.html')))
    if asks:
        toc = [(html_title(a)[0], canonical(a, f'{H}/ask/{os.path.basename(os.path.dirname(a))}/')) for a in asks]
        books.append(book(key='ask', atlas='history', field='history', shelf='guide', shelfName='길잡이', kind='collection', title='질문에서 시작하기', subtitle='여섯 가지 물음으로 읽는 한국사',
                          blurb='나라는 어떻게 만들어졌을까, 국경은 어떻게 바뀌었을까 — 질문 하나마다 지도 · 이야기 · 기록 · 현장으로 가는 읽기 길.', url=f'{H}/ask/', toc=toc))
    faq = os.path.join(repo, 'faq.html')
    if os.path.exists(faq):
        t, d = html_title(faq)
        books.append(book(key='faq', atlas='history', field='history', shelf='guide', shelfName='길잡이', kind='single', title='자주 묻는 질문', subtitle='역사 아틀라스는 왜 이렇게 만들어졌나', blurb=d, url=f'{H}/faq', toc=[(t, f'{H}/faq')]))
    # ---- 답사 ----
    try:
        th = node_json(repo, "global.window={};require('./maps/damsa/data/themes.js');process.stdout.write(JSON.stringify(window.DAMSA_THEMES.map(t=>({id:t.id,group:t.group,page:t.page,title:t.title,subtitle:t.subtitle,n:(t.places||[]).length}))))")
        toc = [(f"{t['title']} — {t['subtitle']} ({t['group']})", f"{H}/maps/damsa/{t['page'].replace('.html', '')}") for t in th if os.path.exists(os.path.join(repo, 'maps', 'damsa', t['page']))]
        books.append(book(key='damsa', atlas='history', field='history', shelf='damsa', shelfName='답사 · 현장', kind='collection', title='답사 — 지금 갈 수 있는 역사의 현장', subtitle=f'테마 {len(toc)}개 · 장소 {sum(t["n"] for t in th)}곳',
                          blurb='고인돌에서 개항장까지. 주차장 한 곳을 단위로 길 안내와 볼거리를 적었습니다.', url=f'{H}/maps/damsa/', toc=toc))
    except Exception as e:  # noqa
        log('  역사: 답사를 못 읽음', e)
    # ---- 도구: 시대 지도 · 제국 지도 · 세계사 루트 · 구비설화 · 놀이 · 광장 ----
    for era in ATLAS_ERA_ORDER:
        page = os.path.join(repo, 'map.html') if era == 'root' else os.path.join(repo, 'maps', era, 'index.html')
        if os.path.exists(page):
            t, d = html_title(page)
            tools.append(tool(id=f'history-map-{era}', atlas='history', field='history', name=t or ATLAS_ERA[era][0] + ' 지도', note='연표 지도 · 해를 고르면 사건이 켜져요', url=f'{H}/map' if era == 'root' else f'{H}/maps/{era}/', ico='🗺️', kind='map'))
    for f in sorted(glob.glob(os.path.join(repo, 'empire', '*.html'))):
        t, d = html_title(f)
        tools.append(tool(id='history-empire-' + os.path.basename(f)[:-5], atlas='history', field='history', name=f'제국의 역사 · {t}', note='세계 지도 위에서 시간을 밀며 보는 영토', url=f'{H}/empire/{os.path.basename(f)[:-5]}', ico='🌍', kind='map'))
    for f in sorted(glob.glob(os.path.join(repo, 'archive', 'world-routes', '*.html'))):
        base = os.path.basename(f)[:-5]
        if base == 'index' or os.path.exists(os.path.join(repo, 'empire', base + '.html')):
            continue
        t, d = html_title(f)
        fld = 'literature' if base in ('gilgamesh', 'odyssey', 'greek-sanctuaries', 'greek-heracles') else 'science' if base == 'quantum-mechanics' else 'society' if base in ('iran-hormuz', 'israel-palestine') else 'history'
        tools.append(tool(id='history-world-' + base, atlas='history', field=fld, name=t, note=clip_line(d, 60), url=f'{H}/archive/world-routes/{base}', ico='🗺️', kind='map'))
    gubi = os.path.join(repo, 'archive', 'gubi-folklore-map', 'index.html')
    if os.path.exists(gubi):
        t, d = html_title(gubi)
        tools.append(tool(id='history-gubi', atlas='history', field='literature', name=t or '땅의 이야기 — 시군별 구비설화 지도', note=clip_line(d, 60), url=f'{H}/archive/gubi-folklore-map/', ico='🗺️', kind='map'))
    for base, fld, ico, note in [('play/quiz/index.html', 'history', '📝', '시대를 골라 스무 문제 — 연표 시험'), ('play/crossroads/index.html', 'history', '🔀', '열두 번의 갈림길에서 고르면 닮은 역사 인물이 나와요'),
                                 ('play/independence/index.html', 'society', '🔎', '지역별 독립유공자 18,776명 찾기'), ('play/collaborators/index.html', 'society', '🔎', '친일반민족행위자 1,005명 · 분야와 법 조문으로 찾기'),
                                 ('agora.html', 'history', '💬', '오류 제보 · 콘텐츠 제안 · 역사 토론 · 질문'), ('maps/damsa/index.html', 'history', '🚗', '지금 갈 수 있는 역사의 현장 · 길 안내'),
                                 ('archive/lineage/index.html', 'history', '🌳', '계보도 · 분포도 · 도해 모음'), ('routes/index.html', 'history', '🥾', '지도 위의 이야기 84편 한눈에')]:
        p = os.path.join(repo, base)
        if os.path.exists(p):
            t, _ = html_title(p)
            url = f'{H}/' + base.replace('index.html', '').replace('.html', '')
            tools.append(tool(id='history-' + base.split('/')[0].replace('.html', '') + ('-' + base.split('/')[1] if '/' in base and base.split('/')[1] != 'index.html' else ''), atlas='history', field=fld, name=t, note=note, url=url, ico=ico, kind='tool'))
    return books, tools


# =====================================================================
# 철학아틀라스
# =====================================================================
COPYNOTE = []   # 철학아틀라스 「오늘의 필사」 원본 (load_philo 가 채움)


def load_philo(src):
    repo = os.path.join(src, 'philo-atlas')
    P = SITE['philo']
    books, tools = [], []
    raw = read(os.path.join(repo, 'data', 'archive_index.js'))
    idx = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])
    full = json.load(open(os.path.join(repo, 'build', 'port_src', 'series.json'), encoding='utf-8'))
    imgs = {}
    try:
        imgs = json.load(open(os.path.join(repo, 'build', 'archive_images.json'), encoding='utf-8')).get('posts', {})
    except OSError:
        pass
    for s in idx['series']:
        slug = s['slug']
        fs = full.get(s['id'], {})
        posts_full = {p['id']: p for p in fs.get('posts', [])} if isinstance(fs.get('posts'), list) else {}
        parts = []
        for p in s['posts']:
            f = os.path.join(repo, 'archive', slug, p['id'] + '.html')
            if os.path.exists(f):
                parts.append((p['ko'], canonical(f, f'{P}/archive/{slug}/{p["id"]}')))
        if not parts:
            continue
        title, subtitle = split_title(fs.get('full_name'), s['ko'])
        first = first_sentence(fs.get('description'))
        if not first:
            for p in s['posts']:
                first = first_sentence(post_text(posts_full.get(p['id'], {})))
                if first and len(first) > 12:
                    break
        m = OG_IMG_RE.search(read(os.path.join(repo, 'archive', slug, 'index.html')) or '')
        hero_url = m.group(1) if m else None
        hero, note = None, ''
        if hero_url and hero_url.startswith(P + '/'):
            rel = hero_url[len(P) + 1:]
            hero = os.path.join(repo, rel)
            for im in imgs.values():
                if im.get('img') == rel:
                    note = ' · '.join(x for x in [plain(im.get('artist')), plain(im.get('license'))] if x)
                    break
        if s['cat'] == 'epic':
            field, shelf, shelfName = 'literature', 'epic', '신화와 서사시'
        elif s['cat'] == 'source':
            field, shelf, shelfName = 'literature', 'text', '원전과 글자'
        else:
            field, shelf, shelfName = 'philo', 'lineage', '사상의 계보'
        books.append(book(key=s['id'], atlas='philo', field=field, shelf=shelf, shelfName=shelfName, title=title, subtitle=subtitle or plain(s.get('taglineKo')), period=plain(fs.get('period')),
                          blurb=clip_line(s.get('taglineKo') or ''), first=first, url=canonical(os.path.join(repo, 'archive', slug, 'index.html'), f'{P}/archive/{slug}/'),
                          hero=hero, heroUrl=hero_url, heroNote=note, toc=parts))
    # ---- 인물 117 (분야별 한 권) ----
    try:
        D = node_load(repo, ['data/people_index.js', 'data/disciplines.js', 'data/questions.js', 'data/debates.js', 'data/glossary.js', 'data/copynote.js', 'data/nobel.js', 'data/walk.js', 'data/eras.js'],
                      ['PHILO_PEOPLE_INDEX', 'PHILO_DISCIPLINES', 'PHILO_QUESTIONS', 'PHILO_DEBATES', 'PHILO_GLOSSARY_CATS', 'PHILO_GLOSSARY', 'PHILO_COPYNOTE', 'PHILO_NOBEL_CHAPTERS', 'PHILO_NOBEL', 'PHILO_WALK', 'PHILO_ERAS'])
        seo = json.load(open(os.path.join(repo, 'build', 'people_seo.json'), encoding='utf-8'))
        disc_map = {'western': ('philo', 'western', '서양철학'), 'eastern': ('philo', 'eastern', '동양철학'), 'religion': ('philo', 'religion', '종교철학'), 'science': ('philo', 'scimind', '과학철학 · 심리학'),
                    'psych': ('philo', 'scimind', '과학철학 · 심리학'), 'lit': ('literature', 'lit', '문학가'), 'art': ('art', 'people', '음악가와 화가')}
        disc_name = {d['id']: d['ko'] for d in D['PHILO_DISCIPLINES']}
        era_name = {e['id']: e['ko'] for e in D['PHILO_ERAS']}
        groups = OrderedDict()
        for pid, info in D['PHILO_PEOPLE_INDEX'].items():
            if not os.path.exists(os.path.join(repo, 'people', pid + '.html')):
                continue
            groups.setdefault(info['disc'], []).append((pid, info))
        for disc, lst in groups.items():
            field, shelf, shelfName = disc_map.get(disc, ('philo', 'western', '서양철학'))
            toc = [(seo.get(pid, info['ko']) + f" ({era_name.get(info['era'], '')})", f'{P}/people/{pid}') for pid, info in lst]
            name = disc_name.get(disc, disc)
            books.append(book(key=f'people_{disc}', atlas='philo', field=field, shelf=shelf, shelfName=shelfName, kind='collection', title=f'{name}, 이 사람들',
                              subtitle=f'인물 {len(toc)}명', blurb=f'{name}의 사람들 {len(toc)}명. 한 사람마다 시대의 자리, 원문 한 줄과 풀이, 삶이 사유가 된 이야기, 그가 남긴 질문.',
                              url=f'{P}/people/', toc=toc))
        # 큰 질문 · 논쟁 · 용어 · 필사 · 노벨문학상
        Q = D['PHILO_QUESTIONS']
        books.append(book(key='questions', atlas='philo', field='philo', shelf='questions', shelfName='질문과 논쟁', kind='collection', title='열아홉 개의 질문', subtitle='시대를 건너는 대화',
                          blurb='정의란 무엇인가, 죽음이란, 안다는 것은 — 큰 질문 하나에 시대를 건너 사상가들이 모여 답합니다.', first=first_sentence(Q[0].get('introKo')),
                          url=f'{P}/questions', toc=[(f"{q.get('icon', '')} {q['ko']} ({len(q['members'])}명)", f"{P}/questions#q-{q['id']}") for q in Q]))
        DB = D['PHILO_DEBATES']
        books.append(book(key='debates', atlas='philo', field='philo', shelf='questions', shelfName='질문과 논쟁', kind='collection', title='사상가들이 갈라선 자리', subtitle=f'논쟁 {len(DB)}편',
                          blurb='맹자와 순자, 흄과 칸트, 아인슈타인과 보어 — 실제로 부딪친 열 번의 논쟁. 양쪽의 원문과 쉬운 풀이, 그 뒤에 온 것.', first=first_sentence(DB[0].get('issueKo')),
                          url=f'{P}/debates', toc=[(d['titleKo'], f"{P}/debates#d-{d['id']}") for d in DB]))
        G, GC = D['PHILO_GLOSSARY'], {c['id']: c['ko'] for c in D['PHILO_GLOSSARY_CATS']}
        books.append(book(key='glossary', atlas='philo', field='philo', shelf='glossary', shelfName='용어', kind='collection', title='철학 용어집', subtitle=f'용어 {len(G)}개 · 세 겹으로 풀이',
                          blurb='정의 한 줄, 쉬운 말 한 단락, 이 말이 왜 생겼나. 서양철학 · 동양사상 · 한국사상 · 예술 · 과학철학.', first=first_sentence(G[0].get('easyKo')),
                          url=f'{P}/glossary', toc=[(f"{t['ko']} ({GC.get(t['cat'], t['cat'])})", f"{P}/glossary#t-{t['id']}") for t in G]))
        CN = D['PHILO_COPYNOTE']['notes']
        COPYNOTE[:] = CN   # 책상 자리 「필사하기」용 (data/copynote.json)
        books.append(book(key='copynote', atlas='philo', field='philo', shelf='daily', shelfName='오늘의 필사', kind='collection', title='오늘의 필사', subtitle=f'{len(CN)}편 · 손으로 옮겨 쓰는 한 줄',
                          blurb='하루 한 편. 원문 한 줄과 우리말, 출처, 따라 쓰는 다섯 문단, 그리고 질문.', first=first_sentence(CN[0].get('ko')),
                          url=f'{P}/copynote', toc=[(f"{n['no']}. {n['ko']} — {n['themeKo']}", f"{P}/copynote#{n['id']}") for n in CN]))
        NB, NCH = D['PHILO_NOBEL'], {c['id']: c['ko'] for c in D['PHILO_NOBEL_CHAPTERS']}
        books.append(book(key='nobel_literature', atlas='philo', field='literature', shelf='nobel', shelfName='노벨문학상', kind='collection', title='노벨문학상 지도', subtitle=f'1901년부터 · 수상자 {len(NB)}명',
                          blurb='해마다 한 사람. 어디서 썼고 무엇을 썼고 왜 받았는지, 그리고 그에게 던지는 질문.', first=first_sentence(NB[0].get('whyKo')),
                          url=f'{P}/route/nobel-literature', toc=[(f"{n['y']} {n['ko']} ({n.get('countryKo', '')}) · {NCH.get(n['ch'], '')}", f"{P}/route/nobel-literature#n{n['y']}") for n in NB]))
        # 말모이 (열두 달)
        if os.path.exists(os.path.join(repo, 'malmoi.html')):
            books.append(book(key='malmoi', atlas='philo', field='literature', shelf='language', shelfName='우리말', kind='collection', title='하루 한 말모이', subtitle='365일 · 토박이말 · 한자어 · 사자성어',
                              blurb='하루에 세 낱말. 토박이말 하나, 한자어 하나(글자마다 뜻과 유래), 사자성어 하나(옛이야기 출처까지).',
                              url=f'{P}/malmoi', toc=[(f'{m}월의 말모이', f'{P}/malmoi#mm-{(m - 1) * 30 + 1:03d}') for m in range(1, 13)]))
        q = os.path.join(repo, 'quantum.html')
        if os.path.exists(q):
            t, d = html_title(q)
            books.append(book(key='quantum', atlas='philo', field='philo', shelf='scimind', shelfName='과학철학 · 심리학', kind='single', title='양자와 철학', subtitle='오해에서 시작하는 안내', blurb=d, url=f'{P}/quantum', toc=[('양자와 철학 — 오해에서 시작하는 안내', f'{P}/quantum')]))
        # 도구: 시대 지도 5 · 루트 지도 · HEXACO · 산책
        for e in D['PHILO_ERAS']:
            tools.append(tool(id=f'philo-map-{e["id"]}', atlas='philo', field='philo', name=f'{e["ko"]} 지도', note=clip_line(e.get('subKo'), 60), url=f'{P}/maps/{e["id"]}/', ico='🗺️', kind='map'))
        route_field = {'gilgamesh': 'literature', 'odyssey': 'literature', 'greek-sanctuaries': 'literature', 'greek-heracles': 'literature', 'confucius': 'philo', 'hyecho': 'philo',
                       'classic': 'art', 'masters': 'art', 'gugak': 'art', 'art': 'art', 'korean-art': 'art'}
        for f in sorted(glob.glob(os.path.join(repo, 'route', '*.html'))):
            base = os.path.basename(f)[:-5]
            if base == 'nobel-literature':
                continue
            t, d = html_title(f)
            fld = route_field.get(base, 'philo')
            if fld == 'art':
                books.append(book(key=f'route_{base}', atlas='philo', field='art', shelf='routes', shelfName='예술사 루트', kind='map', title=t.split(' — ')[0], subtitle=t.split(' — ', 1)[1] if ' — ' in t else '',
                                  blurb=d, url=f'{P}/route/{base}', hero=os.path.join(repo, 'assets', 'route', base + '.webp'), heroUrl=f'{P}/assets/route/{base}.webp', toc=[(t, f'{P}/route/{base}')]))
            else:
                tools.append(tool(id=f'philo-route-{base}', atlas='philo', field=fld, name=t, note=clip_line(d, 60), url=f'{P}/route/{base}', ico='🥾', kind='map'))
        tools.append(tool(id='philo-hexaco', atlas='philo', field='philo', name='나를 여섯 축으로 보기 — 헥사코 성격 검사', note='60문항 · 닮은 기질의 사상가까지', url=f'{P}/hexaco', ico='🪞', kind='tool'))
        tools.append(tool(id='philo-walk', atlas='philo', field='philo', name='긴 산책 중에', note='영화 한 편과 음악 일곱 곡', url=f'{P}/walk', ico='🎬', kind='video'))
    except Exception as e:  # noqa
        log('  철학: 인물 · 질문 자료를 못 읽음', e)
    return books, tools


# =====================================================================
# 과학아틀라스
# =====================================================================
def load_science(src):
    repo = os.path.join(src, 'science-atlas')
    S = SITE['science']
    books, tools = [], []
    data = node_json(repo, "const fs=require('fs');"
                     "eval(fs.readFileSync('data/library.js','utf8').replace('const LIBRARY_BRANCHES','global.LIBRARY_BRANCHES')"
                     ".replace('const LIBRARY_SERIES','global.LIBRARY_SERIES').replace('const LIBRARY = {','global.LIBRARY = {'));"
                     "let IM={};try{IM=require('./data/library-images.js')}catch(e){}"
                     "process.stdout.write(JSON.stringify({B:LIBRARY_BRANCHES,S:LIBRARY_SERIES,L:LIBRARY,O:Object.keys(LIBRARY),IM}))")
    branches = {b['id']: b['ko'] for b in data['B']}
    L, order, IM = data['L'], data['O'], data['IM']
    rimg = {}
    m = re.search(r'const RIMG = \{([^}]*)\}', read(os.path.join(repo, 'tools', 'generate_route_pages.js')) or '')
    if m:
        rimg = dict(re.findall(r"(\w+)\s*:\s*'([^']+)'", m.group(1)))
    for s in data['S']:
        sid = s['id']
        ids = [k for k in order if L[k].get('series') == sid]
        parts = []
        for k in ids:
            f = os.path.join(repo, 'library', k + '.html')
            if os.path.exists(f):
                parts.append((L[k]['title'], canonical(f, f'{S}/library/{k}')))
        if not parts:
            continue
        title, subtitle = split_title(s['title'].get('ko'), '')
        br = Counter(L[k].get('branch') for k in ids).most_common(1)[0][0]
        first = ''
        for k in ids:
            body = L[k].get('body', {}).get('ko', [])
            hook = next((b for b in body if b.get('t') == 'hook'), None)
            if hook:
                v = hook.get('v')
                v = v.get('ko') if isinstance(v, dict) else v
                first = first_sentence((v or '').split('\n\n')[0])
            if not first:
                first = first_sentence(L[k].get('lede'))
            if first:
                break
        rel = 'assets/director/still-0.jpg' if sid == 'director' else (f'assets/library/{rimg[sid]}.webp' if sid in rimg else None)
        hero = os.path.join(repo, rel) if rel and os.path.exists(os.path.join(repo, rel)) else None
        note = ''
        if sid in rimg and rimg[sid] in IM:
            im = IM[rimg[sid]]
            note = 'AI 그림' if im.get('ai') else ' · '.join(x for x in [plain(im.get('by')), plain(im.get('license'))] if x)
        books.append(book(key=sid, atlas='science', field='science', shelf=br, shelfName=branches.get(br, br), grade='general', title=title, subtitle=subtitle,
                          blurb=first_sentence(s['lede'].get('ko'), 90), first=first, url=canonical(os.path.join(repo, 'routes', sid + '.html'), f'{S}/routes/{sid}'),
                          hero=hero, heroUrl=f'{S}/{rel}' if hero else None, heroNote=note, toc=parts))
    # ---- 발견 카드 212 (갈래별 한 권) · 인물 · 용어 ----
    try:
        D = node_load(repo, ['data/discoveries.js', 'data/people.js', 'data/glossary.js'], ['DISCOVERIES', 'PEOPLE', 'GLOSSARY'])
        era_name = {1: '묻다', 2: '잇다', 3: '관측하다', 4: '재다', 5: '흔들리다', 6: '만들다'}
        by = OrderedDict()
        for c in D['DISCOVERIES']:
            if os.path.exists(os.path.join(repo, 'cards', c['id'] + '.html')):
                by.setdefault(c.get('d', 'phys'), []).append(c)
        for br_id in ['math', 'phys', 'chem', 'bio', 'astro', 'earth', 'eng']:
            cs = by.get(br_id) or []
            if not cs:
                continue
            cs.sort(key=lambda c: (c.get('era', 0), str(c.get('year', ''))))
            toc = [(f"{plain(c.get('who'))} — {plain(c.get('q'))} ({c.get('year', '')})", f"{S}/cards/{c['id']}") for c in cs]
            books.append(book(key=f'cards_{br_id}', atlas='science', field='science', shelf=br_id, shelfName=branches.get(br_id, br_id), grade='general', kind='collection',
                              title=f'{branches.get(br_id, br_id)} 발견 카드', subtitle=f'질문 하나에 발견 이야기 하나 · {len(toc)}장', blurb=f'{branches.get(br_id, br_id)}에서 누가 무엇을 알아냈나. 묻다 · 잇다 · 관측하다 · 재다 · 흔들리다 · 만들다, 여섯 시대 순서로.',
                              first=plain(cs[0].get('q')), url=f'{S}/cards/', toc=toc))
        PE = D['PEOPLE']
        toc = [(f"{plain(v.get('name'))} — {plain(v.get('hook'))}", f'{S}/people/{k}') for k, v in PE.items() if os.path.exists(os.path.join(repo, 'people', k + '.html'))]
        books.append(book(key='people', atlas='science', field='science', shelf='people', shelfName='과학자', grade='general', kind='collection', title='이 사람, 이상했다', subtitle=f'과학자 {len(toc)}명',
                          blurb='이상한 버릇에서 시작해 질문으로 끝나는 과학자 이야기.', first=plain(next(iter(PE.values())).get('lede')), url=f'{S}/people/', toc=toc))
        G = D['GLOSSARY']
        gc = {'phys': '물리', 'bio': '생물의학', 'math': '수학', 'method': '과학의 방법', 'astro': '천문우주', 'chem': '화학', 'earth': '지구과학'}
        books.append(book(key='glossary', atlas='science', field='science', shelf='glossary', shelfName='용어', grade='kids-high', kind='collection', title='과학 용어집', subtitle=f'용어 {len(G)}개 · 초등 고학년도 읽게',
                          blurb='엄밀한 정의 한 줄, 장면 하나, 쉬운 풀이 한 단락.', first=first_sentence(G[0].get('scene')), url=f'{S}/glossary/',
                          toc=[(f"{t['ko']} ({gc.get(t['c'], t['c'])})", f"{S}/glossary/#t-{t['id']}") for t in G]))
    except Exception as e:  # noqa
        log('  과학: 카드 · 인물 · 용어를 못 읽음', e)
    # ---- 어린이 과학 · 중학 과학 · 중학 수학 (학년별 한 권) ----
    def units(track, folder, grade_of, title_fmt, shelf, shelfName):
        out = {}
        for f in sorted(glob.glob(os.path.join(repo, folder, '*', '*', 'index.html'))):
            g, n = f.split(os.sep)[-3], f.split(os.sep)[-2]
            if not (g.isdigit() and n.isdigit()):
                continue
            t, d = html_title(f)
            name = t.split(' — ')[0].strip()
            out.setdefault(int(g), []).append((int(n), name, d, f'{S}/{folder}/{g}/{n}/'))
        for g, lst in sorted(out.items()):
            lst.sort()
            books.append(book(key=f'{track}_{g}', atlas='science', field='science', shelf=shelf, shelfName=shelfName, grade=grade_of(g), kind='collection',
                              title=title_fmt.format(g=g), subtitle=f'{len(lst)}단원 · 교과서 순서대로', blurb=clip_line(lst[0][2], 90) if lst else '', first='',
                              url=f'{S}/{folder}/', toc=[(f'{n}. {name}', u) for n, name, d, u in lst]))
    units('kids', 'kids', lambda g: 'kids-low' if g <= 4 else 'kids-high', '초등 {g}학년 과학', 'kids', '어린이 과학 (초등)')
    units('middle', 'middle', lambda g: 'middle', '중학교 {g}학년 과학', 'middle', '중학교 과학')
    units('mathu', 'math', lambda g: 'middle', '중학교 {g}학년 수학', 'mathu', '중학교 수학')
    # ---- 과학 대사관 ----
    rooms = sorted(glob.glob(os.path.join(repo, 'embassy', '*', 'index.html')))
    toc = []
    for f in rooms:
        rid = f.split(os.sep)[-2]
        t, d = html_title(f)
        toc.append((t.split(' — ')[0], f'{S}/embassy/{rid}/'))
    if toc:
        books.append(book(key='embassy', atlas='science', field='science', shelf='embassy', shelfName='과학 대사관', grade='middle', kind='collection', title='과학 대사관 — 다른 나라 교실에서는?',
                          subtitle=f'{len(toc)}개 단원 · 영국 · 미국 · 인도 · 중국', blurb='같은 단원을 다섯 나라는 몇 살에 어떻게 배우나. 나라별 카드와 짧은 퀴즈.', url=f'{S}/embassy/', toc=toc))
    # ---- 오늘의 과학 (달마다 한 권) ----
    days = sorted(glob.glob(os.path.join(repo, 'data', 'today', '*.json')))
    months = OrderedDict()
    for f in days:
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:  # noqa
            continue
        dt = d.get('date') or os.path.basename(f)[:-5]
        if not os.path.exists(os.path.join(repo, 'today', dt, 'index.html')):
            continue
        months.setdefault(dt[:7], []).append((dt, d))
    for ym, lst in months.items():
        toc = [(f"{int(dt[5:7])}월 {int(dt[8:10])}일 — " + ' · '.join(plain(it.get('title'))[:22] for it in d.get('items', [])[:3]) + (' …' if len(d.get('items', [])) > 3 else ''), f'{S}/today/{dt}/') for dt, d in lst]
        n_items = sum(len(d.get('items', [])) for _, d in lst)
        books.append(book(key=f'today_{ym}', atlas='science', field='science', shelf='today', shelfName='오늘의 과학', grade='kids-high', kind='collection',
                          title=f'오늘의 과학 {int(ym[:4])}년 {int(ym[5:7])}월', subtitle=f'{len(lst)}일 · 소식 {n_items}건', blurb='그날의 과학 소식을 초등 고학년 눈높이로 다시 쓰고, 카드 · 자료실 · 놀이판으로 이어 줍니다.',
                          first=first_sentence(lst[0][1].get('intro') or (lst[0][1].get('items') or [{}])[0].get('one')), url=f'{S}/today/archive/', toc=toc))
    # ---- 특집 ----
    dr = os.path.join(repo, 'director', 'index.html')
    if os.path.exists(dr):
        t, d = html_title(dr)
        books.append(book(key='director_hub', atlas='science', field='science', shelf='special', shelfName='특집', grade='general', kind='single', title='한 감독의 질문', subtitle='영화 〈올리브나무 아래서〉에서 시작하는 과학',
                          blurb=d, url=f'{S}/director/', toc=[(t, f'{S}/director/')]))
    # ---- 도구: 놀이판 24 · 지도 · 과학상 · 마을 · 보는 과학 ----
    try:
        TR = node_json(repo, "const t=require('./tools/tool_registry.js');const s=require('./tools/shelf_registry.js');process.stdout.write(JSON.stringify({T:t.BRANCH_TOOLS,M:s.MAPS||[],V:s.VIDEOS||[]}))")
        for br_id, lst in TR['T'].items():
            for t in lst:
                grade = 'middle' if '큐비트' in t['ko'] else ('kids-high' if '놀이판' in t['ko'] else '')
                tools.append(tool(id='science-play-' + t['href'].strip('/').replace('/', '-'), atlas='science', field='science', name=plain(t['ko']), note=clip_line(t.get('koShort'), 60), url=S + t['href'], ico='🎛️', kind='play', grade=GRADE_NAME.get(grade, '')))
        for mp in TR['M']:
            href = mp.get('href') or mp.get('url') or ''
            if href and not href.startswith('/kids') and not href.startswith('/middle') and not href.startswith('/math/units'):
                tools.append(tool(id='science-map-' + href.strip('/').replace('/', '-'), atlas='science', field='science', name=plain(mp.get('ko') or mp.get('title') or href), note=clip_line(mp.get('koShort') or mp.get('sub') or '', 60), url=S + href, ico='🗺️', kind='map'))
    except Exception as e:  # noqa
        log('  과학: 놀이판 목록을 못 읽음', e)
    seen = {t['url'] for t in tools}
    for base, name, note, ico in [('map.html', '과학사 시대 지도', '여섯 시대 · 발견이 태어난 도시를 세계 지도 위에', '🗺️'), ('korea/index.html', '한국의 과학 지도', '과학관 · 천문대 · 연구기관 276곳', '🗺️'),
                                  ('nobel/index.html', '노벨상 루트', '물리 · 화학 · 생리의학 662건', '🏅'), ('fields/index.html', '필즈상 지도', '수학의 노벨상', '🏅'), ('turing/index.html', '튜링상 지도', '컴퓨터과학의 노벨상', '🏅'), ('ignobel/index.html', '이그노벨상 지도', '웃고 나서 생각하게 하는 상', '🏅'),
                                  ('village/index.html', '과학 마을', '초등 과학 · 중학 과학 · 중학 수학을 건물로', '🏘️'), ('play/index.html', '놀이판 모음', '만지는 과학 24개 한눈에', '🎛️'), ('watch/index.html', '보는 과학', '1분 원리 영상과 과학자의 말', '🎬'), ('routes/index.html', '탐방 루트', '시리즈 순서로 카드를 걷는 길 12개', '🥾'), ('en/index.html', 'Science Atlas (English)', '영어판', '🌐')]:
        p = os.path.join(repo, base)
        url = S + '/' + base.replace('index.html', '').replace('.html', '')
        if os.path.exists(p) and url not in seen:
            tools.append(tool(id='science-' + base.split('/')[0].replace('.html', ''), atlas='science', field='science', name=name, note=note, url=url, ico=ico, kind='map' if ico == '🗺️' or ico == '🏅' else 'tool'))
    return books, tools


# =====================================================================
# 정치아틀라스
# =====================================================================
def load_politics(src):
    repo = os.path.join(src, 'politics-atlas')
    T = SITE['politics']
    books, tools = [], []
    series = node_json(repo, "const fs=require('fs'),vm=require('vm'),path=require('path');const a=[];"
                       "const sb={window:{registerArchiveSeries:s=>a.push(s)},console};vm.createContext(sb);"
                       "for(const f of fs.readdirSync('content/archive').filter(f=>f.endsWith('.js')).sort())"
                       "vm.runInContext(fs.readFileSync(path.join('content/archive',f),'utf8'),sb);"
                       "process.stdout.write(JSON.stringify(a))")
    bc = os.path.join(repo, 'scripts', 'build_content.py')
    photo = py_const(bc, 'SERIES_PHOTO')
    hist = py_const(bc, 'HISTORY_CANONICAL')
    hist_ids = {k.replace('-', '_') for k in (hist if isinstance(hist, (dict, set, list)) else [])}
    try:
        credits = json.load(open(os.path.join(repo, 'assets', 'photos', 'credits.json'), encoding='utf-8'))
    except OSError:
        credits = {}
    try:
        over = json.load(open(os.path.join(repo, 'content', 'seo-politics.json'), encoding='utf-8')).get('series', {})
    except OSError:
        over = {}
    LAW = {'constitution_full', 'yusimin_appeal'}
    for s in series:
        sid = s['id']
        slug = sid.replace('_', '-')
        if sid in hist_ids:
            continue
        parts = []
        for p in s.get('posts', []):
            f = os.path.join(repo, 'library', slug, p['id'] + '.html')
            if os.path.exists(f):
                parts.append((p.get('title_ko') or p['id'], canonical(f, f'{T}/library/{slug}/{p["id"]}')))
        if not parts:
            continue
        title, subtitle = split_title(s.get('full_name'), s.get('name'))
        first = ''
        for p in s.get('posts', []):
            first = first_sentence(post_text(p))
            if first and len(first) > 12:
                break
        lead = [x for x in ((over.get(sid) or {}).get('lead') or []) if not str(x).startswith('【')]
        shelf, shelfName = ('law', '법과 헌법') if sid in LAW else ('power', '권력과 책임의 기록')
        hero = hero_url = None
        note = ''
        key = photo.get(sid) if isinstance(photo, dict) else None
        if key:
            c = credits.get(key) if isinstance(credits, dict) else None
            rel = (c.get('file') if isinstance(c, dict) else None)
            if rel and os.path.exists(os.path.join(repo, rel.lstrip('/'))):
                hero, hero_url = os.path.join(repo, rel.lstrip('/')), f'{T}/{rel.lstrip("/")}'
                note = ' · '.join(x for x in [plain(c.get('author')), plain(c.get('license'))] if x)
        books.append(book(key=sid, atlas='politics', field='society', shelf=shelf, shelfName=shelfName, title=title, subtitle=subtitle, period=plain(s.get('period')),
                          blurb=clip_line(s.get('tagline') or s.get('description') or (lead[0] if lead else '')), first=first,
                          url=canonical(os.path.join(repo, 'library', slug, 'index.html'), f'{T}/library/{slug}/'), hero=hero, heroUrl=hero_url, heroNote=note, toc=parts))
    # ---- 연재 · 읽을거리 · 용어 ----
    try:
        lib = node_json(repo, "global.window={};require('./js/library-data.js');process.stdout.write(JSON.stringify(window.LIB))")
        shelves = {}
        for sh in lib.get('SHELVES', []):
            if isinstance(sh, dict):
                shelves[sh.get('id') or sh.get('key')] = sh.get('name') or sh.get('ko') or ''
            elif isinstance(sh, (list, tuple)) and len(sh) >= 2:
                shelves[sh[0]] = sh[1]
        for s in lib.get('SERIES', []):
            arts = sorted([a for a in lib.get('ARTICLES', []) if (a.get('series') or {}).get('key') == s['key']], key=lambda a: a['series']['no'])
            parts = []
            for a in arts:
                no = '%02d' % a['series']['no']
                f = os.path.join(repo, 'library', s['key'], no + '.html')
                if os.path.exists(f):
                    parts.append((a.get('title'), canonical(f, f'{T}/library/{s["key"]}/{no}')))
            if parts:
                books.append(book(key=s['key'].replace('-', '_'), atlas='politics', field='society', shelf='economy', shelfName='경제와 살림', tag=plain(s.get('level')), title=plain(s['name']), subtitle=plain(s.get('seoName')),
                                  blurb=first_sentence(s.get('desc'), 90), first=first_sentence(arts[0].get('lead')) if arts else '', url=canonical(os.path.join(repo, 'library', s['key'], 'index.html'), f'{T}/library/{s["key"]}/'), toc=parts))
        standalone = [a for a in lib.get('ARTICLES', []) if not a.get('series')]
        if standalone:
            toc = [(f"{a.get('title')} — {a.get('subtitle', '')} ({shelves.get(a.get('shelf'), a.get('shelf'))})", f"{T}/library#{a['id']}") for a in standalone]
            books.append(book(key='reads', atlas='politics', field='society', shelf='reads', shelfName='읽을거리와 용어', kind='collection', title='자료실 읽을거리', subtitle=f'{len(toc)}편 · 경제 · 정치 · 세계 · 정치철학',
                              blurb='주식시장은 어떻게 움직이나, 투표용지가 일곱 장인 이유, 다수결은 왜 정당한가 — 도표 지면과 짝을 이루는 짧은 글.', first=first_sentence(standalone[0].get('lead')), url=f'{T}/library', toc=toc))
        gl = lib.get('GLOSSARY', [])
        if gl:
            books.append(book(key='glossary', atlas='politics', field='society', shelf='reads', shelfName='읽을거리와 용어', kind='single', title='정치 · 경제 · 부동산 용어집', subtitle=f'용어 {len(gl)}개',
                              blurb='주식, 영장, 전세 — 뉴스에 나오는 말을 한 줄로.', first=first_sentence(gl[0].get('def')), url=f'{T}/library#hGlossary', toc=[('용어집 (찾기)', f'{T}/library#hGlossary')]))
    except Exception as e:  # noqa
        log('  정치: 자료실 자료를 못 읽음', e)
    # ---- 정치의 기초 · 부동산 · 세계 ----
    sc = json.load(open(os.path.join(repo, 'site.config.json'), encoding='utf-8'))
    pages = {p['path']: p for p in sc.get('pages', [])}
    def pg(path):
        p = pages.get(path) or {}
        t = plain(p.get('title', '')).split(' | ')[0]
        return t, plain(p.get('description', ''))
    basics = [('/civics.html', 'civics'), ('/amendment.html', 'amendment'), ('/elections.html', 'elections'), ('/lawmaking.html', 'lawmaking'), ('/tax.html', 'tax'), ('/budget.html', 'budget'), ('/courts.html', 'courts')]
    toc = [(pg(p)[0], f'{T}/{u}') for p, u in basics if os.path.exists(os.path.join(repo, p.lstrip('/')))]
    books.append(book(key='basics', atlas='politics', field='society', shelf='basics', shelfName='정치의 기초', kind='collection', title='정치의 기초', subtitle='처음 오신 분께 · 일곱 장', tag='중학생도 이해되게',
                      blurb='삼권분립과 정부조직, 개헌, 선거, 입법, 세금, 예산, 법원. 그림을 누르면 설명이 열리는 지면.', first=pg('/civics.html')[1] and first_sentence(pg('/civics.html')[1]), url=f'{T}/civics', toc=toc,
                      hero=os.path.join(repo, 'assets', 'basics', 'civics.webp'), heroUrl=f'{T}/assets/basics/civics.webp'))
    housing = [('/housing-history.html', 'housing-history'), ('/housing.html', 'housing'), ('/housing-rules.html', 'housing-rules')]
    books.append(book(key='housing', atlas='politics', field='society', shelf='economy', shelfName='경제와 살림', kind='collection', title='부동산 — 연대기 · 원리 · 규제', subtitle='세 장',
                      blurb='1967년부터의 대책 연대기, 전세라는 발명, 무엇이 집값을 붙잡나.', first=first_sentence(pg('/housing.html')[1]), url=f'{T}/housing', toc=[(pg(p)[0], f'{T}/{u}') for p, u in housing]))
    t, d = pg('/us-politics.html')
    books.append(book(key='us_politics', atlas='politics', field='society', shelf='world', shelfName='세계', kind='single', title='미국은 어떻게 움직이나', subtitle='중간선거부터 로비까지', blurb=d, url=f'{T}/us-politics', toc=[(t, f'{T}/us-politics')]))
    eitc = os.path.join(repo, 'library', 'welfare', 'eitc.html')
    if os.path.exists(eitc):
        t, d = html_title(eitc)
        books.append(book(key='eitc', atlas='politics', field='society', shelf='economy', shelfName='경제와 살림', kind='single', title='근로장려금', subtitle='나라는 왜 일하는 사람에게 돈을 얹어줄까', blurb=d, url=f'{T}/library/welfare/eitc', toc=[(t, f'{T}/library/welfare/eitc')]))
    life = os.path.join(repo, 'life.html')
    if os.path.exists(life):
        t, d = pg('/life.html')
        books.append(book(key='life', atlas='politics', field='society', shelf='records', shelfName='기록', kind='single', title='살림의 기록', subtitle='숫자로 남기는 한 달', blurb=d, url=f'{T}/life', toc=[(t, f'{T}/life')]))
    # ---- 정책과 제도의 기록 130 · 아틀라스 투데이 ----
    try:
        pol = json.load(open(os.path.join(repo, 'data', 'records', 'policies.json'), encoding='utf-8'))
        fields = pol.get('fields', {})
        def era_of(y):
            return 'era1' if y <= 1960 else 'era2' if y <= 1992 else 'era3'
        toc = [(f"{it['y']}.{it.get('m') or '-'} {it['t']} ({fields.get(it.get('f'), '')})", f"{T}/maps/{era_of(it['y'])}/#{it['id']}") for it in sorted(pol['items'], key=lambda i: (i['y'], i.get('m') or 0))]
        books.append(book(key='policies', atlas='politics', field='society', shelf='records', shelfName='기록', kind='collection', title='이 나라는 어떻게 지금처럼 작동하게 됐나', subtitle=f'정책과 제도의 기록 {len(toc)}건 · 1919년부터',
                          blurb='임시헌장부터 오늘까지, 해마다 무엇이 정해졌는지. 시대 지도 위에서 열립니다.', first=first_sentence(pol['items'][0].get('s')), url=f'{T}/maps/era1/', toc=toc))
    except Exception as e:  # noqa
        log('  정치: 정책 기록을 못 읽음', e)
    try:
        days = json.load(open(os.path.join(repo, 'data', 'records', 'days-2026-08.json'), encoding='utf-8'))
        toc = [('아틀라스 투데이 — 봉인된 첫 화면', f'{T}/today'), ('지난 기록 — 지도로 보는 하루하루', f'{T}/archive/')]
        if os.path.exists(os.path.join(repo, 'special', 'dp-2026', 'index.html')):
            toc.append(('특집 · 전당대회 말모이 — 세 사람의 말', f'{T}/special/dp-2026/'))
        for d in days.get('days', []):
            for n in d.get('news', []):
                toc.append((f"{d.get('date', '')} · {n.get('title', '')}", f"{T}/news?id={n['id']}"))
        books.append(book(key='today', atlas='politics', field='society', shelf='records', shelfName='기록', kind='collection', title='아틀라스 투데이', subtitle='2026년 8월 · 봉인된 사흘의 기록',
                          blurb='오늘의 기록 · 사람의 기록 · 말모이. 짧게 끝난 뉴스 실험을 그대로 남겨 둔 지면.', url=f'{T}/today', toc=toc))
    except Exception as e:  # noqa
        log('  정치: 투데이 기록을 못 읽음', e)
    # ---- 도구 ----
    for base, name, note, ico, fld in [('maps/era1/index.html', '제1부 임시정부와 제1공화국 지도 1919–1960', '정책과 제도의 연표 지도', '🗺️', 'society'), ('maps/era2/index.html', '제2부 군정과 개발독재 지도 1961–1993', '정책과 제도의 연표 지도', '🗺️', 'society'),
                                       ('maps/era3/index.html', '제3부 문민과 자치의 시대 지도 1993–현재', '정책과 제도의 연표 지도', '🗺️', 'society'), ('parties.html', '대한민국 정당 계보도', '1945년부터 한 시간축에', '🌳', 'society'),
                                       ('people.html', '국회의원을 찾습니다', '14대부터 22대까지 1,493명 · 정당 · 지역 · 대수로', '🔎', 'society'), ('library/welfare/index.html', '이번 달에 마감하는 정부 혜택', '매주 월요일 새로 받는 자료', '📋', 'society'),
                                       ('library/welfare/map.html', '지역 혜택 지도', '우리 시 · 도가 주는 것', '🗺️', 'society'), ('library/welfare/me.html', '나에게 맞는 혜택 찾기', '사는 곳 · 나이 · 하는 일로 고르기', '🔎', 'society'),
                                       ('library/petitions/index.html', '5만 명이 모아도', '국회 청원 추적 · 90일을 넘긴 것들', '📋', 'society'), ('library/petitions/voices/index.html', '5만 명을 넘긴 청원은 무엇을 요구하나', '청원 303건 한 줄 요구와 본문', '🔎', 'society'),
                                       ('archive/index.html', '지난 기록 — 지도로 보는 하루하루', '아틀라스 투데이의 날들', '🗺️', 'society'), ('index.html', '정치아틀라스 마을', '건물을 누르면 방이 열려요', '🏘️', 'society')]:
        p = os.path.join(repo, base)
        if os.path.exists(p):
            url = T + '/' + base.replace('index.html', '').replace('.html', '')
            tools.append(tool(id='politics-' + base.replace('/index.html', '').replace('.html', '').replace('/', '-'), atlas='politics', field=fld, name=name, note=note, url=url.rstrip('/') + ('/' if base.endswith('index.html') and base != 'index.html' else ''), ico=ico, kind='map' if ico == '🗺️' else 'tool'))
    return books, tools


# =====================================================================
# 표지 · 상영 목록 · 묶기
# =====================================================================
def make_cover(path, out, max_w=420):
    try:
        from PIL import Image
    except ImportError:
        return False
    try:
        im = Image.open(path).convert('RGB')
        w, h = im.size
        target = 4 / 3
        if w / h > target:
            nw = int(h * target)
            im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else:
            nh = int(w / target)
            im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
        if im.width > max_w:
            im = im.resize((max_w, int(max_w / target)), Image.LANCZOS)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.save(out, 'WEBP', quality=72, method=6)
        return True
    except Exception as e:  # noqa
        log('  표지 실패', path, e)
        return False


def build_program(src):
    """채널 영상 목록(역사 · 과학 아틀라스에 적힌 것)으로 영화관 상영 목록을 채움. 서점지기가 대표 모음을 적으면 그것이 우선."""
    items = []
    try:
        Y = node_json(os.path.join(src, 'atlas'), "const s=require('fs').readFileSync('content/youtube_videos.js','utf8');eval(s.replace(/(const|let|var)\\s+YOUTUBE_VIDEOS\\b/,'global.Y'));process.stdout.write(JSON.stringify(Y.filter(v=>!v.hidden&&v.youtube_id).map(v=>[v.youtube_id,v.title,v.duration])))")
        for vid, title, dur in Y:
            mins = 4.0
            if dur and ':' in str(dur):
                mm, ss = str(dur).split(':')[-2:]
                mins = max(0.5, int(mm) + int(ss) / 60)
            items.append({'id': vid, 'title': plain(title), 'min': round(mins + 0.25, 2)})
    except Exception as e:  # noqa
        log('  상영 목록: 역사 영상을 못 읽음', e)
    try:
        V = node_json(os.path.join(src, 'science-atlas'), "const s=require('./tools/shelf_registry.js');process.stdout.write(JSON.stringify((s.VIDEOS||[]).filter(v=>v.yt).map(v=>[v.yt,v.title,v.len])))")
        known = {'5J36FwfFq70': 24.9}
        for vid, title, ln in V:
            if any(it['id'] == vid for it in items):
                continue
            mins = known.get(vid, 4.0)
            if ln and ':' in str(ln):
                mm, ss = str(ln).split(':')[-2:]
                mins = max(0.5, int(mm) + int(ss) / 60)
            items.append({'id': vid, 'title': plain(title), 'min': round(mins + 0.25, 2)})
    except Exception as e:  # noqa
        log('  상영 목록: 과학 영상을 못 읽음', e)
    return items


# =====================================================================
# 시대 (과학 밖의 모든 책을 같은 여섯 칸으로 꽂는다 — 서가 · 도서목록 · 책장 칸이 모두 이 순서)
# =====================================================================
ERAS = [
    {'id': 'e1', 'name': '고대', 'range': '~918', 'hint': '선사 · 고조선 · 삼국 · 남북국', 'y0': -99999, 'y1': 918},
    {'id': 'e2', 'name': '중세', 'range': '918~1392', 'hint': '고려 · 세계의 중세', 'y0': 918, 'y1': 1392},
    {'id': 'e3', 'name': '근세', 'range': '1392~1876', 'hint': '조선 · 르네상스에서 제국의 시대까지', 'y0': 1392, 'y1': 1876},
    {'id': 'e4', 'name': '근대', 'range': '1876~1945', 'hint': '개항 · 일제강점기 · 세계대전', 'y0': 1876, 'y1': 1945},
    {'id': 'e5', 'name': '현대', 'range': '1945~', 'hint': '광복 이후 · 오늘', 'y0': 1945, 'y1': 2027},
    {'id': 'e0', 'name': '시대를 넘어', 'range': '', 'hint': '여러 시대를 꿰는 통사 · 주제 · 인물 · 길잡이', 'y0': None, 'y1': None},
]
ERA_ORDER = {e['id']: i for i, e in enumerate(ERAS)}
ERA_SHELF = {e['id']: f"{e['name']}{' · ' + e['range'] if e['range'] else ''}" for e in ERAS}          # 책 카드에 짧게
ERA_LONG = {e['id']: f"{e['name']}{' · ' + e['range'] if e['range'] else ''} — {e['hint']}" for e in ERAS}   # 서가 목록 머리말
# 글자로 시대가 드러나는 이름표 (루트의 시대 표지 · 옛 문학 갈래)
ERA_TAG = [
    (re.compile(r'고조선|선사|상고|삼국|통일신라|남북국|고대'), 'e1'),
    (re.compile(r'고려'), 'e2'),
    (re.compile(r'조선'), 'e3'),
    (re.compile(r'근대|개항|일제'), 'e4'),
    (re.compile(r'현대|해방'), 'e5'),
]
# 제목 · 소개에 드러나는 시대 (해가 적혀 있지 않을 때만)
ERA_WORD = [
    (re.compile(r'신화|서사시|길가메시|일리아스|오디세|헤라클레스|축의 시대|공자의|혜초|고대|삼국|고구려|백제|신라|가야|발해|고조선|고인돌'), 'e1'),
    (re.compile(r'신앙과 이성|중세|고려'), 'e2'),
    (re.compile(r'이성의 시대|르네상스|조선|실학|붕당'), 'e3'),
    (re.compile(r'독립|일제|친일|강제동원|항일|임시정부|근대'), 'e4'),
    (re.compile(r'현대의 사유|현대|해방|민주화|한국전쟁|현충원|청원|국회|정당|혜택|아틀라스 투데이|오늘'), 'e5'),
]
# 손으로 정한 것 (해 범위만으로는 엉뚱한 칸에 가는 책) — 책 제목으로 적는다
ERA_FIX = {
    '무령왕': 'e1', '무령왕과 웅진 백제': 'e1',      # 461~1971 (1971년은 무덤을 찾은 해)
    '로마': 'e1', '제국의 역사 · 로마': 'e1',          # 천 년 제국, 고대의 대표
    '독도, 기록의 섬': 'e0', '독도, 기록의 섬 루트': 'e0',
    '흩어진 문화재를 지킨 사람들': 'e4',
    '환단고기, 무엇을 말하는가': 'e0',
    '고려·조선 성곽 분포도': 'e0',
    '현대의 사유 지도': 'e5',
}


def year_span(text, today=True):
    """기간 글에서 [처음 해, 끝 해]. 못 읽으면 None. today=False 면 「오늘」을 해로 치지 않음(제목용)"""
    if not text:
        return None
    t = text.replace('–', '~').replace('—', '~')
    ys = []
    for m in re.finditer(r'(?<![\d,])(기원전|BC|B\.C\.)?\s*(약\s*)?(\d+(?:\.\d+)?)\s*(만\s*년\s*전|세기|년|경)?(?![\d,])', t):
        bc, num, unit = m.group(1), m.group(3), (m.group(4) or '').replace(' ', '')
        v = float(num)
        nxt = t[m.end():m.end() + 1]
        if unit.startswith('만년전'):
            y = -v * 10000
        elif unit == '세기':
            y = (v - 1) * 100 + 50
            y = -y if bc else y
        elif bc:
            y = -v
        else:
            # 해가 아닌 숫자(84편 · 1,005명 · 60문항 · 제1부 · 90일)는 건너뜀
            if not (100 <= v <= 2100) or (not unit and nxt and nxt in '편명건곳개장권쪽문만%위대부회호번일주종점살km'):
                continue
            y = v
        ys.append(y)
    if today and re.search(r'현재|오늘', t):
        ys.append(2026)
    if re.search(r'구석기|신석기|신화시대', t):
        ys.append(-10000)
    if re.search(r'고조선', t):
        ys.append(-2333)
    if not ys:
        return None
    return min(ys), max(ys)


def era_by_span(a, b):
    if b <= 918:
        return 'e1'
    a = max(a, 0)
    if b <= a:
        return next(e['id'] for e in ERAS[:5] if e['y0'] <= a < e['y1'])
    share = [max(0, min(b, e['y1']) - max(a, e['y0'])) for e in ERAS[:5]]
    tot = sum(share) or 1
    touched = sum(1 for v in share if v > 0)
    best = max(range(5), key=lambda i: share[i])
    if touched >= 3 and share[best] / tot < 0.65:
        return 'e0'
    return ERAS[best]['id']


def span_of(b):
    return year_span(b.get('period')) or year_span(b['title'], False) or year_span(b.get('subtitle'), False)


def era_of(b):
    if b['title'] in ERA_FIX:
        return ERA_FIX[b['title']]
    for rx, e in ERA_TAG:
        if b.get('tag') and rx.search(b['tag']) and not re.search(r'인물|역사왜곡|사료|시대연구|기억', b['tag']):
            return e
    sp = span_of(b)
    if sp:
        return era_by_span(*sp)
    words = f"{b['title']} {b.get('subtitle') or ''}"
    for rx, e in ERA_WORD:
        if rx.search(words):
            return e
    if b['field'] == 'society':
        return 'e5'          # 사회 책은 해가 없어도 지금 이야기
    return 'e0'


TOOL_SHELF = {'map': ('maps', '지도'), 'tool': ('tools', '찾아보기 · 해 보기'), 'video': ('tools', '영상')}


def tools_to_books(tools, book_urls):
    """과학아틀라스 밖의 도구(지도 · 계보도 · 찾기 · 검사 · 영상)를 한 편짜리 책으로. 같은 것이 두 아틀라스에 있으면 한 곳만"""
    out, keys = [], {}
    for t in sorted(tools, key=lambda t: HOME_RANK[t['atlas']]):
        if t['url'] in book_urls:
            continue
        name = t['name']
        main_t, _, sub = name.partition(' — ')
        main_t = main_t.strip()
        norm = re.sub(r'[\s·의()\-—「」]', '', main_t)
        k2 = re.sub(r'[\s,·]', '', sub)[:9] if sub else None
        dup = keys.get(norm) or (k2 and keys.get('s:' + k2))
        if dup:
            continue
        keys[norm] = True
        if k2:
            keys['s:' + k2] = True
        base = t['id'].split('-', 1)[1]
        shelf, sname = TOOL_SHELF.get(t['kind'], TOOL_SHELF['tool'])
        out.append(book(key='tool-' + base, atlas=t['atlas'], field=t['field'], shelf=shelf, shelfName=sname, kind=t['kind'] if t['kind'] in ('map', 'video') else 'tool',
                        tag=sname, title=main_t, subtitle=sub or t.get('note', ''), blurb=t.get('note', ''), period='', url=t['url'], toc=[(name, t['url'])],
                        first=''))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.dirname(ROOT))
    ap.add_argument('--no-covers', action='store_true')
    ap.add_argument('--program', action='store_true', help='data/program.json 의 items 를 채널 영상으로 채움 (비어 있을 때만)')
    args = ap.parse_args()

    loaders = {'history': load_history, 'philo': load_philo, 'science': load_science, 'politics': load_politics}
    all_books, all_tools = [], []
    for a in ATLASES:
        if not os.path.isdir(os.path.join(args.src, a['repo'])):
            log(f'{a["name"]}: 저장소가 없어 건너뜀 ({a["repo"]})')
            continue
        try:
            bs, ts = loaders[a['id']](args.src)
        except Exception as e:  # noqa
            import traceback
            traceback.print_exc()
            log(f'{a["name"]}: 읽다가 멈춤 — {e}')
            continue
        log(f'{a["name"]}: 책 {len(bs)}권 · 도구 {len(ts)}개')
        all_books.extend(bs)
        all_tools.extend(ts)

    # 같은 시리즈가 두 곳에 있으면 한 곳만 (철학 > 과학 > 정치 > 역사)
    seen = {}
    for b in all_books:
        k = b['key']
        if b['kind'] != 'series':
            continue
        if k in seen:
            seen[k] = b if HOME_RANK[b['atlas']] < HOME_RANK[seen[k]['atlas']] else seen[k]
        else:
            seen[k] = b
    books = [b for b in all_books if b['kind'] != 'series' or seen[b['key']] is b]
    # 과학아틀라스 밖의 도구는 모두 책으로 (과학 도구만 「도구 모음」에 남는다)
    tool_books = tools_to_books([t for t in all_tools if t['atlas'] != 'science'], {b['url'] for b in books})
    log(f'도구 → 책: {len(tool_books)}권 (과학 밖의 지도 · 계보도 · 찾기 · 검사 · 영상)')
    books += tool_books
    all_tools = [t for t in all_tools if t['atlas'] == 'science']

    cover_dir = os.path.join(ROOT, 'assets', 'covers')
    keep = set()
    if not args.no_covers:
        os.makedirs(cover_dir, exist_ok=True)
    field_name = {f['id']: f['name'] for f in FIELDS}
    out_books = []
    for b in books:
        bid = f'{b["atlas"]}-{b["key"]}'.replace('_', '-')
        cover = None
        if b['hero'] and os.path.exists(b['hero']):
            fn = bid + '.webp'
            if args.no_covers:
                cover = 'assets/covers/' + fn if os.path.exists(os.path.join(cover_dir, fn)) else None
            elif make_cover(b['hero'], os.path.join(cover_dir, fn)):
                cover = 'assets/covers/' + fn
                keep.add(fn)
        out_books.append({
            'id': bid, 'atlas': b['atlas'], 'field': b['field'], 'fieldName': field_name[b['field']], 'shelf': b['shelf'], 'shelfName': b['shelfName'],
            'grade': b['grade'], 'gradeName': GRADE_NAME.get(b['grade'], ''), 'kind': b['kind'], 'tag': b['tag'],
            'title': b['title'], 'subtitle': b['subtitle'], 'period': b['period'],
            'parts': len(b['toc']), 'first': b['first'], 'blurb': b['blurb'],
            'url': b['url'], 'cover': cover, 'coverNote': b['heroNote'] if cover else '', 'toc': b['toc'],
        })
    # 과학 밖의 책은 시대 칸에 꽂는다: shelf = 시대, 원래 갈래(사료읽기 · 이야기 루트 · 제국사 …)는 tag 로
    for ob in out_books:
        if ob['field'] == 'science':
            continue
        ob['era'] = era_of(ob)
        old = ob['shelfName']
        tag = ob['tag'] if ob['tag'] and not any(rx.search(ob['tag']) for rx, _ in ERA_TAG) and ob['tag'] != old else ''
        ob['tag'] = old + (' · ' + tag if tag else '')
        ob['shelf'], ob['shelfName'] = ob['era'], ERA_SHELF[ob['era']]
        sp = span_of(ob)
        ob['y'] = int(sp[0]) if sp else None
    # 지도로 옮긴 책이 같은 이름의 시리즈를 가지면 그 곁에 (제국의 역사 · 로마 ↔ 로마)
    core = lambda t: re.sub(r'^제국의 역사 · ', '', t).replace(' 루트', '').split(',')[0].strip()
    named = {core(ob['title']): ob for ob in out_books if ob['field'] != 'science' and ob['kind'] != 'map' and ob['kind'] != 'tool'}
    for ob in out_books:
        if ob['field'] == 'science' or ob['kind'] not in ('map', 'tool') or ob['title'] in ERA_FIX:
            continue
        twin = named.get(core(ob['title']))
        if twin:
            ob['era'], ob['y'] = twin['era'], twin['y']
            ob['shelf'], ob['shelfName'] = ob['era'], ERA_SHELF[ob['era']]
    if not args.no_covers:
        for fn in os.listdir(cover_dir):
            if fn.endswith('.webp') and fn not in keep:
                os.remove(os.path.join(cover_dir, fn))

    forder = {f['id']: i for i, f in enumerate(FIELDS)}
    # 과학은 갈래 · 학년 순, 나머지는 시대 순 → 그 안에서 한국 먼저, 해 순
    def bkey(b):
        if b['field'] == 'science':
            return (forder[b['field']], 0, b['shelf'], {'kids-low': 0, 'kids-high': 1, 'middle': 2, 'general': 3}.get(b['grade'], 9), 0, 0, b['title'])
        world = 1 if re.search(r'세계사|제국|혁명|격변|문명|정신사', b['tag']) or b['tag'].startswith('신화') else 0
        return (forder[b['field']], ERA_ORDER[b['era']], '', 0, world, b['y'] if b['y'] is not None else 9999, b['title'])
    out_books.sort(key=bkey)
    shelves = []
    for f in FIELDS:
        names = []
        for b in out_books:
            if b['field'] == f['id'] and (b['shelf'], b['shelfName']) not in names:
                names.append((b['shelf'], b['shelfName']))
        for sid, sname in names:
            shelves.append({'field': f['id'], 'id': sid, 'name': ERA_LONG.get(sid, sname), 'count': sum(1 for b in out_books if b['field'] == f['id'] and b['shelf'] == sid)})
    # 도구: 분야 순 · 같은 주소는 하나만
    tseen, tools = set(), []
    for t in all_tools:
        if t['url'] in tseen:
            continue
        tseen.add(t['url'])
        tools.append(t)
    tools.sort(key=lambda t: (forder[t['field']], t['atlas'], t['kind'], t['name']))

    ERAS_OUT = [{k: e[k] for k in ('id', 'name', 'range', 'hint')} for e in ERAS]
    data = {
        'generated': date.today().isoformat(),
        'fields': FIELDS,
        'atlases': [{k: a[k] for k in ('id', 'name', 'short', 'site', 'spine')} for a in ATLASES],
        'shelves': shelves,
        'count': len(out_books),
        'parts': sum(b['parts'] for b in out_books),
        'books': out_books,
        'eras': ERAS_OUT,
        'tools': tools,
    }
    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    with open(os.path.join(ROOT, 'data', 'books.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    # 책상 자리 「필사하기」: 철학아틀라스 「오늘의 필사」를 그대로 (편 순서 · 문장 그대로, 주소는 canonical)
    if COPYNOTE:
        keep = ('id', 'no', 'themeKo', 'pid', 'origin', 'originLang', 'ko', 'srcKo', 'srcNote', 'bodyKo', 'qKo')
        cn = {
            '_읽는법': '철학아틀라스 data/copynote.js 의 「오늘의 필사」를 scripts/build_books.py 가 옮긴 것. 손으로 고치지 않는다. 오늘 편 = (한국 날짜 일련번호) % 편수 — 철학아틀라스와 같은 날 같은 편.',
            'site': 'https://philo.mkhz.kr/copynote',
            'notes': [{**{k: n.get(k) for k in keep}, 'url': f"https://philo.mkhz.kr/copynote#{n['id']}"} for n in COPYNOTE],
        }
        with open(os.path.join(ROOT, 'data', 'copynote.json'), 'w', encoding='utf-8') as f:
            json.dump(cn, f, ensure_ascii=False, separators=(',', ':'))
        log(f'오늘의 필사 {len(COPYNOTE)}편 → data/copynote.json')
    by_field = Counter(b['field'] for b in out_books)
    log('분야별 권수: ' + ' · '.join(f'{field_name[k]} {v}' for k, v in sorted(by_field.items(), key=lambda kv: forder[kv[0]])))
    covers = sum(1 for b in out_books if b['cover'])
    log(f'모두 {len(out_books)}권 · {data["parts"]}장 · 도구 {len(tools)}개 · 그림 표지 {covers}권 · 글자 표지 {len(out_books) - covers}권 → data/books.json')

    if args.program:
        pp = os.path.join(ROOT, 'data', 'program.json')
        try:
            prog = json.load(open(pp, encoding='utf-8'))
        except OSError:
            prog = {}
        if not prog.get('items'):
            prog['items'] = build_program(args.src)
            prog['_items_note'] = '역사 · 과학 아틀라스에 적힌 채널 영상으로 자동으로 채운 목록. 대표 모음을 만들면 이 items 를 통째로 바꾸면 됩니다.'
            with open(pp, 'w', encoding='utf-8') as f:
                json.dump(prog, f, ensure_ascii=False, indent=1)
            log(f'상영 목록 {len(prog["items"])}편 → data/program.json')
        else:
            log('상영 목록은 이미 채워져 있어 그대로 둠')


if __name__ == '__main__':
    main()

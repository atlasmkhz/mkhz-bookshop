#!/usr/bin/env python3
"""엠케이아틀라스 서점 — 책 목록 만들기

아틀라스 네 저장소(역사 · 철학 · 과학 · 정치)의 자료실 시리즈를 한 권씩 책으로 바꿔
data/books.json 하나로 묶는다. 표지 그림이 있으면 assets/covers/ 에 작게 줄여 복사한다.

네 저장소는 읽기만 한다(아무것도 쓰지 않는다).

쓰는 법
  python3 scripts/build_books.py                 # 저장소들이 이 폴더 옆(../atlas 등)에 있을 때
  python3 scripts/build_books.py --src /home/user  # 네 저장소가 들어 있는 폴더를 직접 지정
  python3 scripts/build_books.py --no-covers     # 표지 그림 복사 없이 목록만

필요한 것: python3, node(아틀라스 자료 파일이 자바스크립트라서), Pillow(표지 줄이기, 없으면 그림 없이 진행)
"""
import argparse
import ast
import json
import os
import re
import subprocess
import sys
from collections import Counter
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ATLASES = [
    {'id': 'history', 'name': '역사아틀라스', 'short': '역사', 'site': 'https://atlas.mkhz.kr', 'repo': 'atlas', 'spine': '#7a3b2a'},
    {'id': 'philo', 'name': '철학아틀라스', 'short': '철학', 'site': 'https://philo.mkhz.kr', 'repo': 'philo-atlas', 'spine': '#1f2c4d'},
    {'id': 'science', 'name': '과학아틀라스', 'short': '과학', 'site': 'https://science.mkhz.kr', 'repo': 'science-atlas', 'spine': '#1f6f6b'},
    {'id': 'politics', 'name': '정치아틀라스', 'short': '정치', 'site': 'https://politics.mkhz.kr', 'repo': 'politics-atlas', 'spine': '#5f6b2e'},
]

# 두 저장소에 같이 있는 시리즈는 한 곳에만 꽂는다
#   - 정치아틀라스가 역사아틀라스 주소를 원본으로 둔 시리즈(HISTORY_CANONICAL) → 역사
#   - 철학아틀라스에도 있는 시리즈(신화 · 원전 · 사상의 계보) → 철학
#   - 그 밖에 정치아틀라스 서고에 있는 시리즈 → 정치
HOME_RANK = {'philo': 0, 'science': 1, 'politics': 2, 'history': 3}

CANON_RE = re.compile(r'<link\s+rel="canonical"\s+href="([^"]+)"')
OG_IMG_RE = re.compile(r'<meta\s+property="og:image"\s+content="([^"]+)"')


def log(*a):
    print(*a, file=sys.stderr)


def node_json(cwd, code):
    out = subprocess.run(['node', '-e', code], cwd=cwd, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def py_const(path, name):
    """파이썬 파일을 실행하지 않고 NAME = {...} 상수만 읽어 온다."""
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
    s = s.replace('**', '').replace('__', '')
    s = re.sub(r'^#+\s*', '', s, flags=re.M)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def first_sentence(s, limit=110):
    s = plain(s)
    if not s:
        return ''
    s = s.lstrip('【「『"\' ')
    m = re.search(r'(.+?[.?!。])(?=\s|$|["\'”’」』)])', s)
    out = m.group(1) if m else s
    out = out.strip()
    if len(out) > limit:
        cut = out[:limit]
        # 쉼표나 띄어쓰기에서 자르기
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
    if len(s) <= limit:
        return s
    # 문장 하나로
    fs = first_sentence(s, limit)
    return fs


def post_text(p):
    for k in ('body_ko', 'original_ko', 'claim_ko', 'translation_ko', 'commentary_ko', 'rebuttal_ko', 'desc_ko'):
        v = p.get(k)
        if v and plain(v):
            return v
    return ''


# ---------- 역사아틀라스 ----------
def load_history(src):
    repo = os.path.join(src, 'atlas')
    series = node_json(repo, "const fs=require('fs'),vm=require('vm'),path=require('path');const a=[];"
                       "const sb={window:{registerArchiveSeries:s=>a.push(s)},console};vm.createContext(sb);"
                       "for(const f of fs.readdirSync('content/archive').filter(f=>f.endsWith('.js')).sort())"
                       "vm.runInContext(fs.readFileSync(path.join('content/archive',f),'utf8'),sb);"
                       "process.stdout.write(JSON.stringify(a))")
    gp = os.path.join(repo, 'build', 'generate_archive_pages.py')
    cat_labels = py_const(gp, 'CATEGORY_LABELS')
    sub_labels = py_const(gp, 'SUBCATEGORY_LABELS')
    shelf_names = {'history': '우리 역사', 'world_history': '세계사', 'literature': '옛 문학', 'biographies': '인물열전'}
    sub_fix = {'era_study_premodern': '시대연구', 'memorial_garden': '기억의 뜰', 'thinkers': '사상가'}
    books = []
    for s in series:
        sid = s['id']
        slug = sid.replace('_', '-')
        parts = []
        for p in s.get('posts', []):
            url = canonical(os.path.join(repo, 'archive', slug, p['id'] + '.html'), f'https://atlas.mkhz.kr/archive/{slug}/{p["id"]}')
            if not os.path.exists(os.path.join(repo, 'archive', slug, p['id'] + '.html')):
                log('  역사: 글 파일 없음', slug, p['id'])
                continue
            parts.append({'t': plain(p.get('title_ko')) or p['id'], 'u': url})
        if not parts:
            continue
        title, subtitle = split_title(s.get('full_name'), s.get('name'))
        cat = s.get('category') or 'history'
        sub = s.get('subcategory') or ''
        first = ''
        for p in s.get('posts', []):
            first = first_sentence(post_text(p))
            if first:
                break
        hero = s.get('hero_image')
        books.append({
            'key': sid, 'atlas': 'history',
            'shelf': cat, 'shelfName': shelf_names.get(cat, cat_labels.get(cat, cat)),
            'tag': sub_labels.get(sub) or sub_fix.get(sub, ''),
            'title': title, 'subtitle': subtitle, 'period': plain(s.get('period')),
            'blurb': clip_line(s.get('tagline') or s.get('description') or ''),
            'first': first,
            'url': canonical(os.path.join(repo, 'archive', slug, 'index.html'), f'https://atlas.mkhz.kr/archive/{slug}/'),
            'hero': os.path.join(repo, hero) if hero else None,
            'heroUrl': f'https://atlas.mkhz.kr/{hero}' if hero else None,
            'heroNote': plain(s.get('hero_ai_note')) if s.get('hero_ai') else plain(s.get('hero_credit')),
            'toc': parts,
        })
    return books


# ---------- 철학아틀라스 ----------
def load_philo(src):
    repo = os.path.join(src, 'philo-atlas')
    raw = read(os.path.join(repo, 'data', 'archive_index.js'))
    idx = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])
    cats = {c['id']: c['ko'] for c in idx['categories']}
    full = json.load(open(os.path.join(repo, 'build', 'port_src', 'series.json'), encoding='utf-8'))
    imgs = {}
    try:
        imgs = json.load(open(os.path.join(repo, 'build', 'archive_images.json'), encoding='utf-8')).get('posts', {})
    except OSError:
        pass
    books = []
    for s in idx['series']:
        slug = s['slug']
        fs = full.get(s['id'], {})
        posts_full = {p['id']: p for p in fs.get('posts', [])} if isinstance(fs.get('posts'), list) else {}
        parts = []
        for p in s['posts']:
            f = os.path.join(repo, 'archive', slug, p['id'] + '.html')
            if not os.path.exists(f):
                log('  철학: 글 파일 없음', slug, p['id'])
                continue
            parts.append({'t': plain(p['ko']), 'u': canonical(f, f'https://philo.mkhz.kr/archive/{slug}/{p["id"]}')})
        if not parts:
            continue
        title, subtitle = split_title(fs.get('full_name'), s['ko'])
        first = first_sentence(fs.get('description'))
        if not first:
            for p in s['posts']:
                first = first_sentence(post_text(posts_full.get(p['id'], {})))
                if first and len(first) > 12:
                    break
        index_html = read(os.path.join(repo, 'archive', slug, 'index.html')) or ''
        m = OG_IMG_RE.search(index_html)
        hero_url = m.group(1) if m else None
        hero = None
        note = ''
        if hero_url and hero_url.startswith('https://philo.mkhz.kr/'):
            rel = hero_url[len('https://philo.mkhz.kr/'):]
            hero = os.path.join(repo, rel)
            for pid, im in imgs.items():
                if im.get('img') == rel:
                    note = ' · '.join(x for x in [plain(im.get('artist')), plain(im.get('license'))] if x)
                    break
        books.append({
            'key': s['id'], 'atlas': 'philo', 'shelf': s['cat'], 'shelfName': cats.get(s['cat'], s['cat']), 'tag': '',
            'title': title, 'subtitle': subtitle or plain(s.get('taglineKo')), 'period': plain(fs.get('period')),
            'blurb': clip_line(s.get('taglineKo') or ''),
            'first': first,
            'url': canonical(os.path.join(repo, 'archive', slug, 'index.html'), f'https://philo.mkhz.kr/archive/{slug}/'),
            'hero': hero, 'heroUrl': hero_url, 'heroNote': note,
            'toc': parts,
        })
    return books


# ---------- 과학아틀라스 ----------
def load_science(src):
    repo = os.path.join(src, 'science-atlas')
    data = node_json(repo, "const fs=require('fs');"
                     "eval(fs.readFileSync('data/library.js','utf8').replace('const LIBRARY_BRANCHES','global.LIBRARY_BRANCHES')"
                     ".replace('const LIBRARY_SERIES','global.LIBRARY_SERIES').replace('const LIBRARY = {','global.LIBRARY = {'));"
                     "let IM={};try{IM=require('./data/library-images.js')}catch(e){}"
                     "process.stdout.write(JSON.stringify({B:LIBRARY_BRANCHES,S:LIBRARY_SERIES,L:LIBRARY,O:Object.keys(LIBRARY),IM}))")
    branches = {b['id']: b['ko'] for b in data['B']}
    L, order, IM = data['L'], data['O'], data['IM']
    rimg = {}
    gr = read(os.path.join(repo, 'tools', 'generate_route_pages.js')) or ''
    m = re.search(r'const RIMG = \{([^}]*)\}', gr)
    if m:
        rimg = dict(re.findall(r"(\w+)\s*:\s*'([^']+)'", m.group(1)))
    books = []
    for s in data['S']:
        sid = s['id']
        ids = [k for k in order if L[k].get('series') == sid]
        parts = []
        for k in ids:
            f = os.path.join(repo, 'library', k + '.html')
            if not os.path.exists(f):
                log('  과학: 글 파일 없음', k)
                continue
            parts.append({'t': plain(L[k]['title']), 'u': canonical(f, f'https://science.mkhz.kr/library/{k}')})
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
        hero = hero_url = None
        if sid == 'director':
            rel = 'assets/director/still-0.jpg'
        else:
            rel = f'assets/library/{rimg[sid]}.webp' if sid in rimg else None
        if rel and os.path.exists(os.path.join(repo, rel)):
            hero, hero_url = os.path.join(repo, rel), f'https://science.mkhz.kr/{rel}'
        note = ''
        if sid in rimg and rimg[sid] in IM:
            im = IM[rimg[sid]]
            note = 'AI 그림' if im.get('ai') else ' · '.join(x for x in [plain(im.get('by')), plain(im.get('license'))] if x)
        route = os.path.join(repo, 'routes', sid + '.html')
        books.append({
            'key': sid, 'atlas': 'science', 'shelf': br, 'shelfName': branches.get(br, br), 'tag': '',
            'title': title, 'subtitle': subtitle, 'period': '',
            'blurb': first_sentence(s['lede'].get('ko'), 90),
            'first': first,
            'url': canonical(route, f'https://science.mkhz.kr/routes/{sid}'),
            'hero': hero, 'heroUrl': hero_url, 'heroNote': note,
            'toc': parts,
        })
    return books


# ---------- 정치아틀라스 ----------
def load_politics(src):
    repo = os.path.join(src, 'politics-atlas')
    series = node_json(repo, "const fs=require('fs'),vm=require('vm'),path=require('path');const a=[];"
                       "const sb={window:{registerArchiveSeries:s=>a.push(s)},console};vm.createContext(sb);"
                       "for(const f of fs.readdirSync('content/archive').filter(f=>f.endsWith('.js')).sort())"
                       "vm.runInContext(fs.readFileSync(path.join('content/archive',f),'utf8'),sb);"
                       "process.stdout.write(JSON.stringify(a))")
    bc = os.path.join(repo, 'scripts', 'build_content.py')
    groups = py_const(bc, 'GROUPS')
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
    gmap = {}
    for g in groups:
        for i in g[3]:
            gmap[i] = (g[0], g[1])
    books = []
    for s in series:
        sid = s['id']
        slug = sid.replace('_', '-')
        if sid in hist_ids:
            continue  # 역사아틀라스 책으로 꽂힘
        parts = []
        for p in s.get('posts', []):
            f = os.path.join(repo, 'library', slug, p['id'] + '.html')
            if not os.path.exists(f):
                log('  정치: 글 파일 없음', slug, p['id'])
                continue
            parts.append({'t': plain(p.get('title_ko')) or p['id'], 'u': canonical(f, f'https://politics.mkhz.kr/library/{slug}/{p["id"]}')})
        if not parts:
            continue
        title, subtitle = split_title(s.get('full_name'), s.get('name'))
        first = ''
        for p in s.get('posts', []):
            first = first_sentence(post_text(p))
            if first and len(first) > 12:
                break
        lead = (over.get(sid) or {}).get('lead') or []
        lead = [x for x in lead if not str(x).startswith('【')]
        gid, gname = gmap.get(sid, ('modern', '근현대 시대연구'))
        hero = hero_url = None
        note = ''
        key = photo.get(sid) if isinstance(photo, dict) else None
        if key:
            c = credits.get(key) if isinstance(credits, dict) else None
            rel = c.get('file') if isinstance(c, dict) else None
            if rel:
                rel = rel.lstrip('/')
                if os.path.exists(os.path.join(repo, rel)):
                    hero, hero_url = os.path.join(repo, rel), f'https://politics.mkhz.kr/{rel}'
                    note = ' · '.join(x for x in [plain(c.get('author')), plain(c.get('license'))] if x)
        books.append({
            'key': sid, 'atlas': 'politics', 'shelf': gid, 'shelfName': gname, 'tag': '',
            'title': title, 'subtitle': subtitle, 'period': plain(s.get('period')),
            'blurb': clip_line(s.get('tagline') or s.get('description') or (lead[0] if lead else '')),
            'first': first,
            'url': canonical(os.path.join(repo, 'library', slug, 'index.html'), f'https://politics.mkhz.kr/library/{slug}/'),
            'hero': hero, 'heroUrl': hero_url, 'heroNote': note,
            'toc': parts,
        })
    # 연재 (주식 첫걸음 등)
    try:
        lib = node_json(repo, "global.window={};require('./js/library-data.js');process.stdout.write(JSON.stringify(window.LIB))")
    except Exception as e:  # noqa
        log('  정치: 연재 자료를 못 읽음', e)
        lib = None
    if lib:
        for s in lib.get('SERIES', []):
            arts = sorted([a for a in lib.get('ARTICLES', []) if (a.get('series') or {}).get('key') == s['key']], key=lambda a: a['series']['no'])
            parts = []
            for a in arts:
                no = '%02d' % a['series']['no']
                f = os.path.join(repo, 'library', s['key'], no + '.html')
                if not os.path.exists(f):
                    continue
                parts.append({'t': plain(a.get('title')), 'u': canonical(f, f'https://politics.mkhz.kr/library/{s["key"]}/{no}')})
            if not parts:
                continue
            first = first_sentence(arts[0].get('lead')) if arts else ''
            books.append({
                'key': s['key'].replace('-', '_'), 'atlas': 'politics', 'shelf': 'serial', 'shelfName': '연재', 'tag': plain(s.get('level')),
                'title': plain(s['name']), 'subtitle': plain(s.get('seoName')), 'period': '',
                'blurb': first_sentence(s.get('desc'), 90), 'first': first,
                'url': canonical(os.path.join(repo, 'library', s['key'], 'index.html'), f'https://politics.mkhz.kr/library/{s["key"]}/'),
                'hero': None, 'heroUrl': None, 'heroNote': '',
                'toc': parts,
            })
    return books


# ---------- 표지 그림 ----------
def make_cover(path, out, max_w=420):
    try:
        from PIL import Image
    except ImportError:
        return False
    try:
        im = Image.open(path)
        im = im.convert('RGB')
        w, h = im.size
        # 책 표지 비율(2:3)에 맞게 가운데를 잘라 냄 → 위쪽 그림 칸에 쓰므로 4:3 으로
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.dirname(ROOT), help='아틀라스 저장소 네 개가 들어 있는 폴더')
    ap.add_argument('--no-covers', action='store_true')
    args = ap.parse_args()

    loaders = {'history': load_history, 'philo': load_philo, 'science': load_science, 'politics': load_politics}
    all_books = []
    for a in ATLASES:
        if not os.path.isdir(os.path.join(args.src, a['repo'])):
            log(f'{a["name"]}: 저장소가 없어 건너뜀 ({a["repo"]})')
            continue
        try:
            bs = loaders[a['id']](args.src)
        except Exception as e:  # noqa
            log(f'{a["name"]}: 읽다가 멈춤 — {e}')
            continue
        log(f'{a["name"]}: {len(bs)}권')
        all_books.extend(bs)

    # 같은 시리즈가 두 곳에 있으면 한 곳만
    seen = {}
    for b in all_books:
        k = b['key']
        if k in seen:
            prev = seen[k]
            seen[k] = b if HOME_RANK[b['atlas']] < HOME_RANK[prev['atlas']] else prev
        else:
            seen[k] = b
    books = [b for b in all_books if seen[b['key']] is b]

    cover_dir = os.path.join(ROOT, 'assets', 'covers')
    if not args.no_covers:
        os.makedirs(cover_dir, exist_ok=True)
        keep_files = set()
    out_books = []
    for b in books:
        bid = f'{b["atlas"]}-{b["key"]}'.replace('_', '-')
        cover = None
        if b['hero'] and not args.no_covers:
            fn = bid + '.webp'
            if make_cover(b['hero'], os.path.join(cover_dir, fn)):
                cover = 'assets/covers/' + fn
                keep_files.add(fn)
        elif b['hero'] and args.no_covers and os.path.exists(os.path.join(cover_dir, bid + '.webp')):
            cover = 'assets/covers/' + bid + '.webp'
        out_books.append({
            'id': bid, 'atlas': b['atlas'], 'shelf': b['shelf'], 'shelfName': b['shelfName'], 'tag': b['tag'],
            'title': b['title'], 'subtitle': b['subtitle'], 'period': b['period'],
            'parts': len(b['toc']), 'first': b['first'], 'blurb': b['blurb'],
            'url': b['url'], 'cover': cover, 'coverNote': b['heroNote'] if cover else '',
            'toc': b['toc'],
        })
    if not args.no_covers:
        for fn in os.listdir(cover_dir):
            if fn.endswith('.webp') and fn not in keep_files:
                os.remove(os.path.join(cover_dir, fn))

    order = {a['id']: i for i, a in enumerate(ATLASES)}
    out_books.sort(key=lambda b: (order[b['atlas']], b['shelf'], b['title']))
    shelves = []
    for a in ATLASES:
        names = []
        for b in out_books:
            if b['atlas'] == a['id'] and (b['shelf'], b['shelfName']) not in names:
                names.append((b['shelf'], b['shelfName']))
        for sid, sname in names:
            shelves.append({'atlas': a['id'], 'id': sid, 'name': sname, 'count': sum(1 for b in out_books if b['atlas'] == a['id'] and b['shelf'] == sid)})
    data = {
        'generated': date.today().isoformat(),
        'atlases': [{k: a[k] for k in ('id', 'name', 'short', 'site', 'spine')} for a in ATLASES],
        'shelves': shelves,
        'count': len(out_books),
        'parts': sum(b['parts'] for b in out_books),
        'books': out_books,
    }
    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    with open(os.path.join(ROOT, 'data', 'books.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    covers = sum(1 for b in out_books if b['cover'])
    log(f'모두 {len(out_books)}권 · {data["parts"]}편 · 그림 표지 {covers}권 · 글자 표지 {len(out_books) - covers}권 → data/books.json')


if __name__ == '__main__':
    main()

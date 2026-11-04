// 고양이책과방 미술관 서버
// - POST /upload  사진 올리기 → 자동 검사(Workers AI) → 통과하면 R2 에 저장하고 대기열에
// - GET  /wall    지금 걸린 30점 (+ 대기 수). 누군가 요청할 때 교대를 계산 (타이머 없음)
// - POST /seen    미술관을 나갈 때 본 작품을 한 번에 (같은 기기는 하루 한 번만 셈)
// - POST /heart   하트 (기기마다 한 번)
// - POST /report  신고 (그날 본 작품만, 기기 · 접속 주소마다 한 번). 서로 다른 5곳에서 신고하면 자동으로 내려감
// - GET  /img/:id 사진 (R2 공개 주소를 쓰면 이 요청은 생기지 않음)
// - /admin/*      서점지기: 내려간 작품 보기 · 되살리기 · 지우기 (ADMIN_KEY)
import { DurableObject } from 'cloudflare:workers';
import { cleanText } from '../../server/src/filter.js';

const CTRL = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + ']', 'g');
const clean = (s, n) => String(s ?? '').replace(CTRL, '').slice(0, n);
const cors = (origin) => ({ 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400', vary: 'origin' });
const json = (data, origin, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(origin) } });
const kstDay = (t = Date.now()) => Math.floor((t + 9 * 3600e3) / 86400e3);

function allowed(req, env) {
  const origin = req.headers.get('origin') || '';
  const list = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin) return { ok: true, origin: '*' };
  return { ok: list.includes(origin), origin: list.includes(origin) ? origin : 'null' };
}
async function ipHash(req, env) {
  const ip = req.headers.get('cf-connecting-ip') || 'x';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|' + (env.SALT || 'mkhz-gallery')));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const b64ToBytes = (b64) => { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

// 자동 검사: 그림을 읽는 모델에게 묻고, 확실히 괜찮을 때만 통과 (모델이 없거나 실패하면 통과시키지 않음)
async function moderate(env, bytes) {
  if (!env.AI) return { ok: false, why: '자동 검사기가 아직 준비되지 않았어요' };
  try {
    const prompt = 'You are a strict content moderator for a family-friendly photo gallery. Look at the image. Reply with exactly one word: UNSAFE if it contains nudity, sexual or suggestive content, underwear focus, gore, blood, injury, violence, weapons aimed at people, self-harm, drugs, or hateful symbols. Otherwise reply SAFE.';
    const r = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', { image: [...bytes], prompt, max_tokens: 6 });
    const a = String(r?.description || r?.response || '').toUpperCase();
    if (a.includes('UNSAFE')) return { ok: false, why: '자동 검사에서 걸렸어요 (야하거나 폭력적인 사진은 걸 수 없어요)' };
    if (a.includes('SAFE')) return { ok: true };
    return { ok: false, why: '자동 검사 결과가 분명하지 않아 걸지 않았어요. 다른 사진으로 해 주세요' };
  } catch (e) {
    return { ok: false, why: '자동 검사를 하지 못했어요. 잠시 뒤 다시 해 주세요' };
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const { ok, origin } = allowed(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, name: 'mkhz-gallery' }, origin);
    const hall = env.HALL.get(env.HALL.idFromName('hall'));
    // 사진 (공개 주소가 없을 때만 여기로)
    if (url.pathname.startsWith('/img/')) {
      const id = clean(url.pathname.slice(5), 24).replace(/[^a-z0-9]/g, '');
      const cache = caches.default;
      const hit = await cache.match(req);
      if (hit) return hit;
      const obj = await env.ART.get(`art/${id}.jpg`);
      if (!obj) return new Response('not found', { status: 404, headers: cors('*') });
      const res = new Response(obj.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', ...cors('*') } });
      await cache.put(req, res.clone());
      return res;
    }
    if (!ok) return new Response('forbidden origin', { status: 403 });
    const opt = { slots: +env.SLOTS || 30, slotMs: (+env.SLOT_MINUTES || 60) * 60e3, reports: +env.REPORT_LIMIT || 5, daily: +env.DAILY_UPLOADS || 3 };
    if (url.pathname === '/wall') return json(await hall.wall(opt), origin);
    let body = {};
    if (req.method === 'POST') { try { body = JSON.parse((await req.text()).slice(0, 900000)); } catch { return json({ ok: false, msg: '잘못된 요청이에요' }, origin, 400); } }
    const uid = clean(body.uid, 16).replace(/[^a-z0-9]/gi, '');
    if (url.pathname === '/upload' && req.method === 'POST') {
      const ip = await ipHash(req, env);
      const pre = await hall.canUpload(uid, ip, opt);
      if (!pre.ok) return json(pre, origin, 429);
      let bytes;
      try { bytes = b64ToBytes(String(body.image || '')); } catch { return json({ ok: false, msg: '사진을 읽지 못했어요' }, origin, 400); }
      if (bytes.length < 2000 || bytes.length > 650000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return json({ ok: false, msg: '사진 크기나 형식이 맞지 않아요' }, origin, 400);
      const mod = await moderate(env, bytes);
      if (!mod.ok) { await hall.noteReject(uid, ip); return json({ ok: false, msg: mod.why }, origin, 422); }
      const id = (Date.now().toString(36) + crypto.getRandomValues(new Uint32Array(1))[0].toString(36)).slice(0, 16);
      await env.ART.put(`art/${id}.jpg`, bytes, { httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' } });
      const title = cleanText(clean(body.title, 24)) || '무제';
      const name = cleanText(clean(body.name, 12)) || '손님';
      return json(await hall.add({ id, uid, ip, title, name }, opt), origin);
    }
    if (url.pathname === '/seen' && req.method === 'POST') return json(await hall.seen(uid, (Array.isArray(body.ids) ? body.ids : []).slice(0, 40).map((x) => clean(x, 16))), origin);
    if (url.pathname === '/heart' && req.method === 'POST') return json(await hall.heart(uid, clean(body.id, 16)), origin);
    if (url.pathname === '/report' && req.method === 'POST') return json(await hall.report(uid, await ipHash(req, env), clean(body.id, 16), opt), origin);
    if (url.pathname.startsWith('/admin/')) {
      const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!env.ADMIN_KEY) return json({ ok: false, error: 'ADMIN_KEY 가 서버에 아직 없어요' }, origin, 503);
      if (key !== env.ADMIN_KEY) return json({ ok: false, error: '열쇠가 맞지 않아요' }, origin, 401);
      if (url.pathname === '/admin/items') return json(await hall.adminList(), origin);
      if (url.pathname === '/admin/restore') return json(await hall.adminRestore(clean(body.id, 16), opt), origin);
      if (url.pathname === '/admin/remove') { const r = await hall.adminRemove(clean(body.id, 16)); if (r.ok) await env.ART.delete(`art/${clean(body.id, 16)}.jpg`); return json(r, origin); }
    }
    return json({ ok: false, msg: '없는 주소예요' }, origin, 404);
  },
};

// 미술관 하나를 맡는 작은 서버 (Durable Object). 저장은 몇 개의 키에 모아서 씀 (쓰기 횟수 아끼기)
export class GalleryHall extends DurableObject {
  async load() {
    if (this.s) return this.s;
    const st = this.ctx.storage;
    const [items, wall, queue, users, counts] = await Promise.all(['items', 'wall', 'queue', 'users', 'counts'].map((k) => st.get(k)));
    this.s = { items: items || {}, wall: wall || [], queue: queue || [], users: users || {}, counts: counts || {} };
    return this.s;
  }
  async save(...keys) { const st = this.ctx.storage; await Promise.all(keys.map((k) => st.put(k, this.s[k]))); }

  // 교대: 빈 벽을 채우고, 1시간 넘게 걸린 작품은 기다리는 작품이 있을 때만 내려감
  tick(opt) {
    const s = this.s, now = Date.now();
    let changed = false;
    while (s.wall.length < opt.slots) s.wall.push(null);
    const order = s.wall.map((id, i) => ({ i, id, start: id ? s.items[id]?.start || 0 : -1 })).sort((a, b) => a.start - b.start);
    for (const w of order) {
      if (!s.queue.length) break;
      if (w.id && now - w.start < opt.slotMs) continue;
      if (w.id) { const it = s.items[w.id]; if (it) { it.status = 'past'; it.end = now; this.release(it); } }
      const next = s.queue.shift();
      const it = s.items[next];
      if (!it) continue;
      it.status = 'wall'; it.start = now; it.slot = w.i;
      s.wall[w.i] = next;
      changed = true;
    }
    // 끝난 작품은 목록에서 덜어 냄 (기록은 따로)
    for (const [id, it] of Object.entries(s.items)) if (it.status === 'past') { this.ctx.storage.put(`past:${id}`, { ...it, ...this.cnt(id) }); delete s.items[id]; changed = true; }
    return changed;
  }
  release(it) { const u = this.s.users[it.uid]; if (u && u.active === it.id) u.active = null; }
  cnt(id) { const c = this.s.counts[id] || [0, 0, []]; return { views: c[0], hearts: c[1] }; }
  slotView(id, i, opt) {
    const it = this.s.items[id];
    if (!it) return null;
    return { id, title: it.title, name: it.name, ...this.cnt(id), since: it.start, until: it.start + opt.slotMs, slot: i };
  }

  async wall(opt) {
    await this.load();
    if (this.tick(opt)) await this.save('items', 'wall', 'queue', 'users');
    const s = this.s;
    return { now: Date.now(), queue: s.queue.length, slots: s.wall.map((id, i) => (id ? this.slotView(id, i, opt) : null)) };
  }

  async canUpload(uid, ip, opt) {
    await this.load();
    if (!uid) return { ok: false, msg: '잘못된 요청이에요' };
    const day = kstDay(), now = Date.now();
    const u = this.s.users[uid] || {}, p = this.s.users['ip:' + ip] || {};
    if ((u.blockUntil || 0) > now || (p.blockUntil || 0) > now) return { ok: false, msg: '신고로 작품이 두 번 내려가 한동안 올릴 수 없어요' };
    if (u.active && this.s.items[u.active]) return { ok: false, msg: '이미 걸려 있거나 기다리는 작품이 있어요. 그 작품이 내려간 뒤에 올려 주세요' };
    const uc = u.day === day ? u.ups || 0 : 0, pc = p.day === day ? p.ups || 0 : 0;
    if (uc >= opt.daily || pc >= opt.daily + 2) return { ok: false, msg: `하루에 ${opt.daily}장까지 올릴 수 있어요. 내일 다시 와 주세요` };
    return { ok: true };
  }
  bump(key, day) { const u = this.s.users[key] || {}; if (u.day !== day) { u.day = day; u.ups = 0; } u.ups = (u.ups || 0) + 1; this.s.users[key] = u; return u; }
  async noteReject(uid, ip) { await this.load(); const day = kstDay(); this.bump(uid, day); this.bump('ip:' + ip, day); await this.save('users'); }

  async add({ id, uid, ip, title, name }, opt) {
    await this.load();
    const s = this.s, day = kstDay();
    s.items[id] = { id, uid, ip, title, name, status: 'queue', created: Date.now(), reports: [] };
    s.queue.push(id);
    const u = this.bump(uid, day); u.active = id; this.bump('ip:' + ip, day);
    this.tick(opt);
    await this.save('items', 'wall', 'queue', 'users');
    const it = s.items[id];
    if (it.status === 'wall') return { ok: true, status: 'wall', msg: `${it.slot + 1}번 벽에 바로 걸렸어요!`, slot: it.slot };
    // 기다리는 시간: 벽들이 비는 시각을 차례로 나눠 가짐
    const pos = s.queue.indexOf(id);
    const frees = s.wall.map((wid) => Math.max(Date.now(), (s.items[wid]?.start || 0) + opt.slotMs)).sort((a, b) => a - b);
    const eta = frees[pos % frees.length] + Math.floor(pos / frees.length) * opt.slotMs;
    return { ok: true, status: 'queue', position: pos + 1, eta, msg: `대기 ${pos + 1}번째예요. 약 ${Math.max(1, Math.round((eta - Date.now()) / 60e3))}분 뒤에 걸려요` };
  }

  async seen(uid, ids) {
    await this.load();
    if (!uid || !ids.length) return { ok: true };
    const st = this.ctx.storage, day = kstDay();
    const rec = (await st.get(`seen:${uid}`)) || {};
    const today = rec.day === day ? new Set(rec.ids) : new Set();
    let n = 0;
    for (const id of ids) { if (today.has(id) || !this.s.items[id]) continue; today.add(id); const c = this.s.counts[id] || [0, 0, []]; c[0]++; this.s.counts[id] = c; n++; }
    await st.put(`seen:${uid}`, { day, ids: [...today].slice(-200) });
    if (n) await this.save('counts');
    return { ok: true, counted: n };
  }

  async heart(uid, id) {
    await this.load();
    if (!uid || !this.s.items[id]) return { ok: false };
    const st = this.ctx.storage, k = `h:${id}:${uid}`;
    if (await st.get(k)) return { ok: true, already: true };
    await st.put(k, 1);
    const c = this.s.counts[id] || [0, 0, []]; c[1]++; this.s.counts[id] = c;
    await this.save('counts');
    return { ok: true, hearts: c[1] };
  }

  async report(uid, ip, id, opt) {
    await this.load();
    const it = this.s.items[id];
    if (!uid || !it || it.status !== 'wall') return { ok: false, msg: '지금 걸린 작품이 아니에요' };
    const rec = (await this.ctx.storage.get(`seen:${uid}`)) || {};
    if (rec.day !== kstDay() || !(rec.ids || []).includes(id)) return { ok: false, msg: '미술관에서 직접 본 작품만 신고할 수 있어요' };
    it.reports = it.reports || [];
    if (it.reports.some((r) => r.u === uid || r.ip === ip)) return { ok: true, already: true, msg: '이미 신고했어요' };
    it.reports.push({ u: uid, ip, t: Date.now() });
    let hidden = false;
    if (it.reports.length >= opt.reports) {
      // 자동으로 내림 → 「보류」(서점지기가 되살리거나 지울 수 있음), 올린 사람 경고 1회
      hidden = true;
      it.status = 'hidden'; it.end = Date.now();
      const i = this.s.wall.indexOf(id); if (i >= 0) this.s.wall[i] = null;
      this.release(it);
      for (const key of [it.uid, 'ip:' + it.ip]) { const u = this.s.users[key] || {}; u.strikes = (u.strikes || 0) + 1; if (u.strikes >= 2) u.blockUntil = Date.now() + 30 * 86400e3; this.s.users[key] = u; }
      this.tick(opt);
    }
    await this.save('items', 'wall', 'queue', 'users');
    return { ok: true, hidden, msg: hidden ? '신고가 쌓여 작품을 내렸어요. 알려 주셔서 고마워요' : '신고를 받았어요. 여러 분이 신고하면 자동으로 내려가요' };
  }

  async adminList() { await this.load(); const s = this.s; return { ok: true, queue: s.queue.length, items: Object.values(s.items).map((it) => ({ id: it.id, title: it.title, name: it.name, status: it.status, reports: (it.reports || []).length, created: it.created, ...this.cnt(it.id) })) }; }
  async adminRestore(id, opt) { await this.load(); const it = this.s.items[id]; if (!it || it.status !== 'hidden') return { ok: false }; it.status = 'queue'; it.reports = []; this.s.queue.unshift(id); this.tick(opt); await this.save('items', 'wall', 'queue'); return { ok: true }; }
  async adminRemove(id) { await this.load(); const it = this.s.items[id]; if (!it) return { ok: false }; const i = this.s.wall.indexOf(id); if (i >= 0) this.s.wall[i] = null; this.s.queue = this.s.queue.filter((q) => q !== id); this.release(it); delete this.s.items[id]; await this.save('items', 'wall', 'queue', 'users'); return { ok: true }; }
}

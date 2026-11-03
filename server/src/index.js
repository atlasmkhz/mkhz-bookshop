// 엠케이아틀라스 서점 방 서버 (Cloudflare Workers + Durable Objects)
// Durable Object = 방(호점) 하나를 맡는 작은 서버. 방마다 손님 목록과 메시지 전달을 맡습니다.
// - 고양이 움직임은 방 안의 손님 한 명(가장 먼저 들어온 사람) 브라우저가 정하고,
//   "어디로 간다 · 무엇을 한다"는 계획(cq, cs)만 서버를 거쳐 나눠 줍니다.
// - 무료 플랜 절약: WebSocket Hibernation API — 메시지가 없을 땐 서버가 잠들어 실행시간이 쌓이지 않습니다.
//   연결 유지용 'ping'에는 서버를 깨우지 않고 자동으로 'pong'이 나갑니다. 서버 쪽 타이머 · 알람은 쓰지 않습니다.
// - 채팅은 가까이 있는 손님에게만 보냅니다 (서점처럼 조용히).
// - 건의함(Suggestions)은 서점지기만 볼 수 있게 저장합니다.
import { DurableObject } from 'cloudflare:workers';
import { cleanText } from './filter.js';

const CTRL = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + ']', 'g');
const clean = (s, n) => String(s ?? '').replace(CTRL, '').slice(0, n);

function cors(origin) {
  return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400', vary: 'origin' };
}
const json = (data, init = {}, origin = '*') => new Response(JSON.stringify(data), {
  ...init,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(origin), ...(init.headers || {}) },
});

function allowedOrigin(req, env) {
  const origin = req.headers.get('origin') || '';
  const list = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin) return { ok: true, origin: '*' };
  return { ok: list.includes(origin), origin: list.includes(origin) ? origin : 'null' };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const { ok, origin } = allowedOrigin(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, name: 'mkhz-bookshop' }, {}, origin);
    if (!ok) return new Response('forbidden origin', { status: 403 });

    const cap = +env.ROOM_CAP || 100;
    const max = +env.MAX_ROOMS || 10;
    const lobby = env.LOBBY.get(env.LOBBY.idFromName('lobby'));

    if (url.pathname === '/rooms') return json(await lobby.list(cap, max), {}, origin);

    // 건의함에 넣기 (손님)
    if (url.pathname === '/suggest' && req.method === 'POST') {
      const box = env.BOX.get(env.BOX.idFromName('box'));
      let body;
      try { body = JSON.parse((await req.text()).slice(0, 4000)); } catch { return json({ ok: false }, { status: 400 }, origin); }
      const ip = req.headers.get('cf-connecting-ip') || '';
      const r = await box.add(body, ip);
      return json(r, { status: r.ok ? 200 : r.code || 400 }, origin);
    }
    // 건의함 보기 · 지우기 (서점지기: ADMIN_KEY 필요)
    if (url.pathname.startsWith('/admin/')) {
      const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!env.ADMIN_KEY) return json({ ok: false, error: 'ADMIN_KEY 가 서버에 아직 없어요' }, { status: 503 }, origin);
      if (key !== env.ADMIN_KEY) return json({ ok: false, error: '열쇠가 맞지 않아요' }, { status: 401 }, origin);
      const box = env.BOX.get(env.BOX.idFromName('box'));
      if (url.pathname === '/admin/suggestions') return json(await box.list(), {}, origin);
      if (url.pathname === '/admin/delete' && req.method === 'POST') {
        let body = {};
        try { body = JSON.parse(await req.text()); } catch { /* 무시 */ }
        return json(await box.remove(String(body.id || '')), {}, origin);
      }
      return json({ ok: false }, { status: 404 }, origin);
    }

    const m = url.pathname.match(/^\/room\/(\d{1,4})\/ws$/);
    if (m) {
      const n = +m[1];
      if (n < 1 || n > max) return new Response('no such room', { status: 404 });
      if (req.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      const stub = env.ROOM.get(env.ROOM.idFromName(`room-${n}`));
      const fwd = new Request(req, { headers: new Headers(req.headers) });
      fwd.headers.set('x-room', String(n));
      fwd.headers.set('x-cap', String(cap));
      fwd.headers.set('x-chat-range', String(+env.CHAT_RANGE || 12));
      return stub.fetch(fwd);
    }
    return new Response('not found', { status: 404 });
  },
};

// ---------------- 로비: 방별 인원 ----------------
export class Lobby extends DurableObject {
  async report(n, count) {
    const counts = (await this.ctx.storage.get('counts')) || {};
    if (count > 0) counts[n] = { c: count, t: Date.now() }; else delete counts[n];
    await this.ctx.storage.put('counts', counts);
  }
  async list(cap, max) {
    const counts = (await this.ctx.storage.get('counts')) || {};
    const now = Date.now();
    const rooms = [];
    let highest = 0;
    for (let n = 1; n <= max; n++) {
      const e = counts[n];
      const c = e && now - e.t < 10 * 60 * 1000 ? e.c : 0;
      if (c > 0) highest = n;
      rooms.push({ n, count: c });
    }
    const best = rooms.find((r) => r.count > 0 && r.count < cap) || rooms.find((r) => r.count === 0) || null;
    const shown = rooms.filter((r) => r.n <= Math.max(highest + 1, 1));
    return { cap, max, best: best ? best.n : null, rooms: shown };
  }
}

// ---------------- 건의함 ----------------
// 한 사람(IP)이 하루 5번까지, 서점 전체로 하루 300건까지. 오래된 것부터 2,000건 넘으면 지움.
export class Suggestions extends DurableObject {
  async add(body, ip) {
    const text = clean(body?.m, 600).trim();
    if (text.length < 2) return { ok: false, code: 400 };
    const day = new Date().toISOString().slice(0, 10);
    const lim = (await this.ctx.storage.get('limit')) || { day, ips: {}, total: 0 };
    if (lim.day !== day) { lim.day = day; lim.ips = {}; lim.total = 0; }
    const ipKey = ip.slice(0, 64);
    if ((lim.ips[ipKey] || 0) >= 5 || lim.total >= 300) return { ok: false, code: 429 };
    lim.ips[ipKey] = (lim.ips[ipKey] || 0) + 1;
    lim.total++;
    const id = `s:${String(Date.now()).padStart(15, '0')}:${Math.random().toString(36).slice(2, 7)}`;
    await this.ctx.storage.put({ limit: lim, [id]: { id, m: text, n: clean(body?.n, 20).trim(), room: +body?.room || 0, at: Date.now() } });
    const keys = [...(await this.ctx.storage.list({ prefix: 's:', limit: 2100 })).keys()];
    if (keys.length > 2000) await this.ctx.storage.delete(keys.slice(0, keys.length - 2000));
    return { ok: true };
  }
  async list() {
    const items = [...(await this.ctx.storage.list({ prefix: 's:', reverse: true, limit: 500 })).values()];
    return { ok: true, items };
  }
  async remove(id) {
    if (!id.startsWith('s:')) return { ok: false };
    await this.ctx.storage.delete(id);
    return { ok: true };
  }
}

// ---------------- 방 하나 ----------------
const MAX_MSG = 4096;

export class BookRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rate = new Map();
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  sockets() { return this.ctx.getWebSockets().filter((w) => w.readyState === 1); }

  async fetch(req) {
    const n = +req.headers.get('x-room');
    const cap = +req.headers.get('x-cap') || 100;
    const range = +req.headers.get('x-chat-range') || 12;
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const others = this.sockets().filter((w) => w !== server);
    if (others.length >= cap) {
      server.send(JSON.stringify({ t: 'full', cap }));
      server.close(4001, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }
    server.serializeAttachment({ n, range, uid: null, seq: Date.now() + Math.random(), host: false, hi: null, st: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, m) { try { ws.send(JSON.stringify(m)); } catch { /* 무시 */ } }
  broadcast(m, except) {
    const s = JSON.stringify(m);
    for (const w of this.sockets()) if (w !== except && w.deserializeAttachment()?.uid) { try { w.send(s); } catch { /* 무시 */ } }
  }

  // 손님이 지금 있을 법한 곳: 걸어가는 중이면 목적지, 아니면 마지막 위치
  where(att) {
    const st = att?.st;
    if (!st) return null;
    if (Array.isArray(st.g)) return [+st.g[0] || 0, +st.g[1] || 0, +st.g[2] || 0];
    if (Array.isArray(st.p)) return [+st.p[0] || 0, +st.p[1] || 0, +st.p[3] || 0];
    return null;
  }

  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > MAX_MSG) return;
    const now = Date.now();
    const r = this.rate.get(ws) || { t: now, c: 0, chat: 0 };
    if (now - r.t > 1000) { r.t = now; r.c = 0; }
    if (++r.c > 20) { this.rate.set(ws, r); return; }
    this.rate.set(ws, r);

    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const att = ws.deserializeAttachment() || {};

    if (m.t === 'hello') {
      if (att.uid) return;
      att.uid = clean(m.uid, 16) || Math.random().toString(36).slice(2, 10);
      for (const w of this.sockets()) {
        if (w !== ws && w.deserializeAttachment()?.uid === att.uid) { try { w.close(4002, 'replaced'); } catch { /* 무시 */ } }
      }
      att.hi = this.hiOf(m, att.uid);
      ws.serializeAttachment(att);
      const members = this.sockets().filter((w) => w !== ws).map((w) => w.deserializeAttachment()).filter((a) => a && a.uid && a.uid !== att.uid);
      this.send(ws, { t: 'welcome', room: att.n, members: members.map((a) => ({ hi: a.hi, st: a.st })) });
      this.broadcast(att.hi, ws);
      this.ensureHost();
      await this.report(att.n);
      return;
    }
    if (!att.uid) return;
    m.uid = att.uid;

    switch (m.t) {
      case 'hi':
        att.hi = this.hiOf(m, att.uid);
        ws.serializeAttachment(att);
        this.broadcast(att.hi, ws);
        break;
      case 'st':
        att.st = { t: 'st', uid: att.uid, p: Array.isArray(m.p) ? m.p.slice(0, 4) : null, s: Number.isInteger(m.s) ? m.s : -1, g: Array.isArray(m.g) ? m.g.slice(0, 3) : null };
        ws.serializeAttachment(att);
        this.broadcast(att.st, ws);
        break;
      case 'cq': case 'cs':
        if (!att.host) return;
        this.broadcast(m, ws);
        break;
      case 'chat': {
        // 2초에 한 번까지, 가까이 있는 손님에게만
        if (now - (r.chat || 0) < 2000) return;
        r.chat = now;
        const text = cleanText(m.m);
        if (!text) return;
        const msg = JSON.stringify({ t: 'chat', uid: att.uid, m: text });
        const me = this.where(att);
        for (const w of this.sockets()) {
          if (w === ws) continue;
          const a = w.deserializeAttachment();
          if (!a?.uid) continue;
          const p = this.where(a);
          if (me && p && Math.hypot(p[0] - me[0], p[1] - me[1]) + Math.abs(p[2] - me[2]) * 2 > (att.range || 12)) continue;
          try { w.send(msg); } catch { /* 무시 */ }
        }
        break;
      }
      case 'gift': {
        // 음료 선물: 받는 사람에게만
        const to = clean(m.to, 16);
        const msg = JSON.stringify({ t: 'gift', uid: att.uid, to, d: clean(m.d, 16) });
        for (const w of this.sockets()) if (w.deserializeAttachment()?.uid === to) { try { w.send(msg); } catch { /* 무시 */ } }
        break;
      }
      case 'pet': case 'treat': case 'wave':
        this.broadcast(m, ws);
        break;
      default:
        break;
    }
  }

  hiOf(m, uid) {
    const l = m.l && typeof m.l === 'object' ? { top: clean(m.l.top, 7), hair: clean(m.l.hair, 7), skin: clean(m.l.skin, 7) } : null;
    let mc = null;
    if (m.mc && typeof m.mc === 'object') {
      mc = {};
      for (const k of ['base', 'dark', 'light', 'orange', 'eye']) if (typeof m.mc[k] === 'string') mc[k] = clean(m.mc[k], 7);
      for (const k of ['stripes', 'white', 'patches']) mc[k] = !!m.mc[k];
      mc.whiteAmount = Math.max(0, Math.min(1, +m.mc.whiteAmount || 0));
      mc.name = cleanText(clean(m.mc.name, 10));
    }
    return { t: 'hi', uid, n: cleanText(clean(m.n, 12)) || '손님', l, d: m.d ? clean(m.d, 16) : null, mc };
  }

  ensureHost() {
    const list = this.sockets().map((w) => ({ w, a: w.deserializeAttachment() })).filter((x) => x.a && x.a.uid);
    if (list.some((x) => x.a.host)) return;
    list.sort((p, q) => p.a.seq - q.a.seq);
    const h = list[0];
    if (!h) return;
    h.a.host = true;
    h.w.serializeAttachment(h.a);
    this.send(h.w, { t: 'role', host: true });
  }

  async webSocketClose(ws, code) {
    await this.leave(ws);
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch { /* 무시 */ }
  }
  async webSocketError(ws) { await this.leave(ws); }

  async leave(ws) {
    const att = ws.deserializeAttachment();
    this.rate.delete(ws);
    if (!att || !att.uid || att.left) return;
    att.left = true;
    att.host = false;
    try { ws.serializeAttachment(att); } catch { /* 무시 */ }
    this.broadcast({ t: 'bye', uid: att.uid }, ws);
    this.ensureHost();
    await this.report(att.n);
  }

  async report(n) {
    const count = this.sockets().filter((w) => { const a = w.deserializeAttachment(); return a && a.uid && !a.left; }).length;
    try { await this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby')).report(n, count); } catch { /* 무시 */ }
  }
}

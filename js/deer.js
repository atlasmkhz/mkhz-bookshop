// 숲속 꽃사슴 다섯 가족 — 엄마 사슴과 아기 사슴(한두 마리)이 저마다 사는 풀밭을 천천히 거닐며 풀을 뜯음
//
// 진돗개 · 레서판다처럼 서버 메시지를 하나도 쓰지 않습니다. 가족마다 씨앗값으로 뽑은 일정을 지금 시각에 맞춰
// 각 브라우저가 계산하므로 모든 손님이 같은 자리에서 봅니다. 가까이 가면 고개를 들고, 너무 가까우면 몇 걸음
// 달아났다 돌아오고, 누르면 쳐다보는 것은 내 화면에서만 일어나는 반응입니다.
import * as THREE from 'three';
import { DeerModel } from './deerModel.js';
import { pushOut, findPath, insideObstacle, inCabin, levelOf, WORLD } from './nav.js';

const LEGS = 18;              // 가족 한 바퀴에 들르는 곳 수
const WALK = 0.55, RUN = 1.7; // 걷기 · 뛰기 (m/s)
const RESTS = ['graze', 'graze', 'graze', 'lie', 'alert', 'graze', 'nurse', 'graze', 'lie', 'graze'];
const FAR = 55;               // 이보다 멀면 그리지 않음 (휴대폰 가볍게)

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const angDamp = (a, b, k, dt) => {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-k * dt));
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class DeerHerds {
  constructor(scene, room, fx, sound, defs) {
    this.scene = scene; this.room = room; this.fx = fx; this.sound = sound;
    this.night = 0;
    this.listener = null;   // 내 위치
    this.camera = null;
    this.families = defs.map((d, fi) => {
      const members = [{ name: d.mom, fawn: false }, ...d.kids.map((k) => ({ name: k, fawn: true }))].map((m, i) => {
        const model = new DeerModel(m.fawn, fi * 7 + i + 1);
        const hit = new THREE.Mesh(new THREE.SphereGeometry(m.fawn ? 0.55 : 0.5, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.y = 0.7;
        hit.userData.deerId = `${d.id}:${i}`;
        model.root.add(hit);
        scene.add(model.root);
        return { ...m, i, model, hit, shown: V(0, 0, 0), pos: V(0, 0, 0), yaw: 0, placed: false, hold: 0, holdYaw: 0, flee: 0, fleeDir: V(0, 0, 0), alertT: 0 };
      });
      return { def: d, fi, members, legs: null, cycle: 1 };
    });
  }

  build(F) {
    const g = this.room.grids?.get(0);
    const ok = (p) => !inCabin(p, 2) && (!g || g.ok(g.cx(p.x), g.cz(p.z))) && !insideObstacle(this.room, p, 0.45)
      && p.x > WORLD.minX + 1.5 && p.x < WORLD.maxX - 1.5 && p.z > WORLD.minZ + 1.5 && p.z < Math.min(WORLD.maxZ, 22) - 1.5;
    const [hx, hz] = F.def.home;
    const pts = [];
    for (const r of [0, 2.5, 5, 7.5, 10]) {
      for (let k = 0; k < (r ? 10 : 1); k++) {
        const a = (k / 10) * Math.PI * 2 + r * 0.3;
        const p = V(hx + Math.cos(a) * r, 0, hz + Math.sin(a) * r);
        pushOut(this.room, p, 0.4, true);
        if (ok(p)) pts.push(p);
      }
    }
    if (pts.length < 3) { F.legs = []; return; }
    const rnd = mulberry32(20261105 + F.fi * 977);
    const legs = [];
    let cur = pts[0], at = 0, tries = 0;
    while (legs.length < LEGS && tries < 500) {
      tries++;
      const to = pts[Math.floor(rnd() * pts.length)];
      const dist = to.distanceTo(cur);
      if (dist < 2.5 || dist > 13) continue;
      const path = [cur.clone(), ...findPath(this.room, cur, to).map((p) => p.clone().setY(0))];
      if (path.some((p) => inCabin(p, 0.5) || levelOf(p))) continue;
      const cum = [0];
      for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + path[k].distanceTo(path[k - 1]));
      const len = cum[cum.length - 1];
      if (len > dist * 2) continue;
      const fast = rnd() < 0.1;
      const act = RESTS[Math.floor(rnd() * RESTS.length)];
      const rest = act === 'lie' ? 35 + rnd() * 40 : act === 'alert' ? 6 + rnd() * 5 : act === 'nurse' ? 12 + rnd() * 8 : 18 + rnd() * 22;
      legs.push({ path, cum, len, fast, start: at, walkDur: len / (fast ? RUN : WALK), rest, act, seed: rnd() * 6.28 });
      at += len / (fast ? RUN : WALK) + rest;
      cur = to;
    }
    if (legs.length) {
      const first = legs[0].path[0];
      const path = [cur.clone(), ...findPath(this.room, cur, first).map((p) => p.clone().setY(0))];
      const cum = [0];
      for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + path[k].distanceTo(path[k - 1]));
      const len = cum[cum.length - 1];
      legs.push({ path, cum, len, fast: false, start: at, walkDur: len / WALK, rest: 15, act: 'graze', seed: 1 });
      at += len / WALK + 15;
    }
    F.legs = legs;
    F.cycle = at;
  }

  // 시각 T 에 엄마(k=0) · 아기(k=1, 2)가 있을 곳 · 하는 일
  at(F, T, k) {
    const legs = F.legs;
    const lag = k ? 1.2 + k * 1.1 : 0;   // 아기는 엄마 뒤를 조금 늦게 따라감
    const tc = (((T - lag) % F.cycle) + F.cycle) % F.cycle;
    let lo = 0, hi = legs.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (legs[mid].start <= tc) lo = mid; else hi = mid - 1; }
    const L = legs[lo];
    const u = tc - L.start;
    const out = { pos: V(0, 0, 0), yaw: 0, anim: 'idle', speed: 0, hop: 0 };
    if (u < L.walkDur) {
      const s = u * (L.fast ? RUN : WALK);
      let j = 1;
      while (j < L.cum.length - 1 && L.cum[j] < s) j++;
      const a = L.path[j - 1], b = L.path[j];
      out.pos.lerpVectors(a, b, Math.min(1, (s - L.cum[j - 1]) / Math.max(1e-6, L.cum[j] - L.cum[j - 1])));
      out.yaw = Math.atan2(b.x - a.x, b.z - a.z);
      if (k) out.pos.add(V(Math.cos(out.yaw) * 0.5 * (k === 1 ? 1 : -1), 0, -Math.sin(out.yaw) * 0.5 * (k === 1 ? 1 : -1)));
      out.anim = L.fast ? 'run' : 'walk';
      out.speed = L.fast ? RUN : WALK;
      if (k && L.fast) out.hop = 1;
      return out;
    }
    // 쉬는 곳: 엄마는 한가운데, 아기는 곁에
    const r = u - L.walkDur;
    const end = L.path[L.path.length - 1];
    out.pos.copy(end);
    out.yaw = L.seed;
    const night = this.night > 0.6;
    let act = night && L.act !== 'alert' ? 'lie' : L.act;
    if (!k) {
      out.anim = act === 'lie' ? (r > 8 && (r + L.seed * 10) % 30 < 18 ? 'sleep' : 'lie') : act === 'nurse' ? 'idle' : act;
      if (act === 'graze' && (r + L.seed * 7) % 16 > 12.5) out.anim = 'alert';   // 풀 뜯다 가끔 고개 들어 두리번
      return out;
    }
    const side = k === 1 ? 1 : -1;
    const fw = V(Math.sin(L.seed), 0, Math.cos(L.seed)), rt = V(Math.cos(L.seed), 0, -Math.sin(L.seed));
    if (act === 'nurse' && k === 1) {
      // 젖 먹기: 엄마 옆구리 밑에 고개를 넣고 꼬리를 살랑
      out.pos.addScaledVector(rt, 0.28).addScaledVector(fw, -0.05);
      out.yaw = L.seed + Math.PI;
      out.anim = 'nurse';
      return out;
    }
    if (act === 'lie') {
      out.pos.addScaledVector(rt, side * 0.7).addScaledVector(fw, -0.3);
      out.yaw = L.seed + side * 0.6;
      out.anim = r > 10 ? 'sleep' : 'lie';
      return out;
    }
    // 풀 뜯는 동안 아기는 가끔 엄마 둘레를 깡충깡충 뛰어다님
    const play = (r + k * 9 + L.seed * 5) % 22;
    if (act === 'graze' && play < 5 && r > 3 && L.rest - r > 4) {
      const w = 1.6, R = 1.3 + k * 0.3, ang = L.seed + play * w * side;
      out.pos.add(V(Math.cos(ang) * R, 0, Math.sin(ang) * R));
      out.yaw = Math.atan2(-Math.sin(ang) * side, Math.cos(ang) * side);
      out.anim = 'run'; out.speed = R * w; out.hop = 1;
      return out;
    }
    out.pos.addScaledVector(rt, side * 0.75).addScaledVector(fw, 0.25);
    out.yaw = L.seed + side * 0.3;
    out.anim = act === 'alert' ? 'alert' : (r + k * 4) % 13 < 9 ? 'graze' : 'idle';
    return out;
  }

  hitObjects() { const l = []; for (const F of this.families) for (const m of F.members) if (m.model.root.visible) l.push(m.hit); return l; }
  find(id) {
    const [fid, i] = String(id).split(':');
    const F = this.families.find((f) => f.def.id === fid);
    return F ? { F, m: F.members[+i] } : null;
  }
  // 내 화면에서만: 누르면 쳐다보고, 아기는 깡충
  pet(id, fromPos) {
    const f = this.find(id);
    if (!f) return null;
    for (const m of f.F.members) {
      m.hold = 4;
      m.holdYaw = fromPos ? Math.atan2(fromPos.x - m.shown.x, fromPos.z - m.shown.z) : m.yaw;
    }
    this.fx.hearts(f.m.model.headWorld(), 3);
    return f;
  }

  update(dt) {
    const T = Date.now() / 1000;
    const me = this.listener, cam = this.camera?.position;
    for (const F of this.families) {
      if (!F.legs) this.build(F);
      for (const m of F.members) {
        const far = !F.legs.length || (cam && Math.hypot(cam.x - m.shown.x, cam.z - m.shown.z) > FAR && m.placed);
        m.model.root.visible = !far || !m.placed;
        if (!F.legs.length) { m.model.root.visible = false; continue; }
        const s = this.at(F, T, m.i);
        pushOut(this.room, s.pos, 0.3, true);
        if (far) { m.shown.copy(s.pos); m.yaw = s.yaw; m.pos.copy(s.pos); continue; }   // 멀면 자리만 맞추고 그리지 않음
        let anim = s.anim, speed = s.speed, wantYaw = s.yaw, hop = s.hop;
        if (!m.placed) { m.shown.copy(s.pos); m.yaw = s.yaw; m.placed = true; }
        // 내 반응: 5 m 안이면 고개 들어 쳐다보고, 1.8 m 안으로 다가오면 몇 걸음 달아났다가 돌아옴
        let look = 0;
        if (me && me.y < 0.6) {
          const dx = me.x - m.shown.x, dz = me.z - m.shown.z, dist = Math.hypot(dx, dz);
          if (dist < 1.8 && m.flee <= 0 && m.hold <= 0) { m.flee = 2.2; m.fleeDir.set(-dx, 0, -dz).normalize(); }
          if (dist < 5 && m.flee <= 0 && speed < 0.1 && anim !== 'sleep') {
            look = THREE.MathUtils.clamp(((Math.atan2(dx, dz) - m.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
            if (anim === 'graze' || anim === 'idle') anim = 'alert';
          }
        }
        if (m.flee > 0) {
          m.flee -= dt;
          m.shown.addScaledVector(m.fleeDir, RUN * 1.3 * dt);
          pushOut(this.room, m.shown, 0.3, true);
          wantYaw = Math.atan2(m.fleeDir.x, m.fleeDir.z); anim = 'run'; speed = RUN; hop = m.fawn ? 1 : 0;
        } else if (m.hold > 0) {
          m.hold -= dt;
          wantYaw = m.holdYaw; speed = 0; anim = m.fawn ? 'idle' : 'alert'; hop = m.fawn && m.hold > 2.5 ? 1 : 0;
        } else {
          const gap = m.shown.distanceTo(s.pos);
          if (gap > 10) m.shown.copy(s.pos);
          else if (gap > 0.5) {
            // 달아났다가 제 일정으로 걸어 돌아옴
            const dir = s.pos.clone().sub(m.shown).setY(0).normalize();
            m.shown.addScaledVector(dir, Math.min(gap, WALK * 1.6 * dt));
            wantYaw = Math.atan2(dir.x, dir.z); anim = 'walk'; speed = WALK * 1.6;
          } else m.shown.lerp(s.pos, 1 - Math.exp(-8 * dt));
        }
        m.yaw = angDamp(m.yaw, wantYaw, speed > 1 ? 9 : 5, dt);
        m.pos.copy(m.shown);
        m.model.lookYaw = look;
        m.model.hop = hop;
        m.model.root.position.copy(m.shown).setY(0);
        m.model.root.rotation.y = m.yaw;
        m.model.setAnim(anim);
        m.model.update(dt, speed);
      }
    }
  }
}

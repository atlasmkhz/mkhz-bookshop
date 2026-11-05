// 숲속 레서판다 한 마리 (단풍이) — 숲과 서점 안 곳곳을 바쁘게 돌아다니고, 뛰다가 빙글빙글 돌고, 가끔 나무 위에서 쉼
// 새 곳에 닿으면 「단풍이가 ○○ 근처에 나타났어요」 알림(main.js), 내가 가까이 있으면 가끔 먼저 달려와 「꾸잉!」(내 화면에서만)
//
// 진돗개처럼 서버 메시지를 하나도 쓰지 않습니다. 정해진 씨앗값으로 뽑은 일정(한 바퀴 약 40분)을 지금 시각에 맞춰
// 각 브라우저가 계산하므로 모든 손님이 같은 자리에서 봅니다. 찾았을 때의 반응 · 찾은 날 기록은 내 화면 · 이 기기에만.
import * as THREE from 'three';
import { RedPandaModel } from './pandaModel.js';
import { pushOut, findPath, insideObstacle, inCabin, levelOf, WORLD } from './nav.js';

// 들르는 땅 (서점 밖 · 일부러 눈에 덜 띄는 구석도). 막힌 곳은 시작할 때 가까운 빈 땅으로 옮기거나 뺌
// 서점 안 (1층 바닥만): 벽난로 곁 · 소파 앞 · 평대 · 둥근 탁자 · 책장 골목 · 캣타워 코너
const INDOOR = [[-12.0, 3.8], [-4.6, 6.6], [-3.4, 1.2], [3.6, -4.2], [-9.8, -3.6], [5.6, 5.6], [0.5, 7.6]];
const SPOTS = [
  [-20, -6], [-24, 10], [-12, -15], [8, -12], [16, -16], [28, -22], [34, -6], [46, -10], [52, -22], [58, 14],
  [44, 18], [30, 19], [6, 25], [-10, 24], [-27, 17], [-28, -20], [-16, -27], [22, 4], [40, -14], [14, 12],
  [-4, -20], [10, -26], [36, 28], [64, -16], [70, 18], [-22, -12], [26, -4], [50, 2],
];
const CYCLE_LEGS = 44;
const WALK = 0.9, RUN = 2.1;
// 쉬는 일: 나무 위는 가끔만, 빙글빙글 뛰기(zoom) · 뒷발로 서서 두리번(stand)을 자주
const RESTS = ['sniff', 'zoom', 'stand', 'eat', 'sit', 'zoom', 'sniff', 'stand', 'tree', 'eat', 'zoom', 'sleep', 'stand', 'sniff'];
const CLIMB = 3.2;   // 나무를 오르내리는 시간 (초)

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

export class RedPanda {
  constructor(scene, room, fx, sound, def) {
    this.scene = scene; this.room = room; this.fx = fx; this.sound = sound;
    this.def = def;
    this.listener = null;
    this.night = 0;
    this.model = new RedPandaModel(1.15);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.25;
    hit.userData.pandaId = def.id;
    this.model.root.add(hit);
    this.hit = hit;
    scene.add(this.model.root);
    this.pos = new THREE.Vector3(); this.shown = new THREE.Vector3(); this.yaw = 0; this.placed = false;
    this.hold = 0; this.holdYaw = 0;
    this.legs = null;
  }

  build() {
    const g = this.room.grids?.get(0);
    const ok = (p) => !inCabin(p, 0.8) && (!g || g.ok(g.cx(p.x), g.cz(p.z))) && !insideObstacle(this.room, p, 0.3)
      && p.x > WORLD.minX + 1 && p.x < WORLD.maxX - 1 && p.z > WORLD.minZ + 1 && p.z < WORLD.maxZ - 1;
    const near = (x, z) => {
      for (let r = 0; r <= 3; r += 0.5) {
        for (let k = 0; k < (r ? 12 : 1); k++) {
          const a = (k / 12) * Math.PI * 2;
          const p = new THREE.Vector3(x + Math.cos(a) * r, 0, z + Math.sin(a) * r);
          pushOut(this.room, p, 0.28, true);
          if (ok(p)) return p;
        }
      }
      return null;
    };
    const dests = [];
    for (const [x, z] of SPOTS) { const p = near(x, z); if (p) dests.push({ p }); }
    // 서점 안 자리: 집 안 1층 바닥에서 막히지 않은 곳
    const okIn = (p) => inCabin(p, 0.3) && !levelOf(p) && (!g || g.ok(g.cx(p.x), g.cz(p.z))) && !insideObstacle(this.room, p, 0.3);
    for (const [x, z] of INDOOR) {
      for (let r = 0, done = false; r <= 1.5 && !done; r += 0.5) {
        for (let k = 0; k < (r ? 8 : 1) && !done; k++) {
          const a = (k / 8) * Math.PI * 2;
          const p = new THREE.Vector3(x + Math.cos(a) * r, 0, z + Math.sin(a) * r);
          pushOut(this.room, p, 0.25, true);
          if (okIn(p)) { dests.push({ p, inside: true }); done = true; }
        }
      }
    }
    // 오를 나무: 활엽수 · 소나무 중 밑동 곁에 설 수 있는 것 (늘 같은 순서라 모든 화면이 같은 답)
    const trees = (this.room.trees || []).filter((t) => t.kind !== 'birch' && t.h > 1.4 && !inCabin(new THREE.Vector3(t.x, 0, t.z), 3));
    for (const t of trees) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const p = new THREE.Vector3(t.x + Math.cos(a) * (0.32 * t.s + 0.3), 0, t.z + Math.sin(a) * (0.32 * t.s + 0.3));
        if (ok(p)) { dests.push({ p, tree: t }); break; }
      }
    }
    this.dests = dests;
    const rnd = mulberry32(20261105);
    const legs = [];
    const spots = dests.filter((d) => !d.tree), treeD = dests.filter((d) => d.tree), insideD = dests.filter((d) => d.inside);
    if (spots.length < 3) { this.legs = []; return; }
    let cur = spots[0].p, at = 0, tries = 0;
    let act = null;   // 정한 일은 맞는 곳을 찾을 때까지 그대로 (나무가 많아 나무에만 몰리지 않게)
    while (legs.length < CYCLE_LEGS && tries < 900) {
      tries++;
      if (!act) act = RESTS[Math.floor(rnd() * RESTS.length)];
      if (act === 'tree' && !treeD.length) act = 'sit';
      // 여덟 번에 한 번쯤은 서점 안으로
      const pool = act === 'tree' ? treeD : insideD.length && rnd() < 0.12 ? insideD : spots;
      const d = pool[Math.floor(rnd() * pool.length)];
      const dist = d.p.distanceTo(cur);
      if (dist < 5 || dist > 34) continue;
      const path = [cur.clone(), ...findPath(this.room, cur, d.p).map((p) => p.clone().setY(0))];
      if (path.some((p) => levelOf(p))) continue;   // 2층 · 다락 · 루프탑으로는 안 감
      const cum = [0];
      for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + path[k].distanceTo(path[k - 1]));
      const len = cum[cum.length - 1];
      if (len > dist * 2.4) continue;
      const fast = rnd() < 0.4;   // 신나서 뛰어가는 일이 잦음
      const walkDur = len / (fast ? RUN : WALK);
      const rest = act === 'tree' ? 30 + rnd() * 25 : act === 'sleep' ? 25 + rnd() * 20 : act === 'zoom' ? 7 + rnd() * 5 : 7 + rnd() * 10;
      legs.push({ path, cum, len, fast, start: at, walkDur, rest, act, tree: act === 'tree' ? d.tree : null, inside: !!d.inside, seed: rnd() * 6.28 });
      act = null;
      at += walkDur + rest;
      cur = d.p;
    }
    if (legs.length) {
      const first = legs[0].path[0];
      const path = [cur.clone(), ...findPath(this.room, cur, first).map((p) => p.clone().setY(0))];
      const cum = [0];
      for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + path[k].distanceTo(path[k - 1]));
      const len = cum[cum.length - 1];
      legs.push({ path, cum, len, fast: false, start: at, walkDur: len / WALK, rest: 8, act: 'sit', tree: null, seed: 1 });
      at += len / WALK + 8;
    }
    this.legs = legs;
    this.cycle = at;
  }

  // 시각 T(초)에 있을 곳 · 하는 일
  at(T) {
    const legs = this.legs;
    const tc = ((T % this.cycle) + this.cycle) % this.cycle;
    let lo = 0, hi = legs.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (legs[mid].start <= tc) lo = mid; else hi = mid - 1; }
    const L = legs[lo];
    const u = tc - L.start;
    const out = { pos: new THREE.Vector3(), yaw: null, anim: 'idle', speed: 0, up: false };
    if (u < L.walkDur) {
      const s = u * (L.fast ? RUN : WALK);
      let k = 1;
      while (k < L.cum.length - 1 && L.cum[k] < s) k++;
      const a = L.path[k - 1], b = L.path[k];
      const seg = Math.max(1e-6, L.cum[k] - L.cum[k - 1]);
      out.pos.lerpVectors(a, b, Math.min(1, (s - L.cum[k - 1]) / seg));
      out.yaw = Math.atan2(b.x - a.x, b.z - a.z);
      out.anim = L.fast ? 'run' : 'walk';
      out.speed = L.fast ? RUN : WALK;
      // 가다가 멈춰 뒷발로 서서 두리번 (걷는 동안 30초에 한 번쯤, 3초)
      if (!L.fast && (u + L.seed * 5) % 30 < 2.2 && u > 4 && L.walkDur - u > 4) { out.anim = 'stand'; out.speed = 0; out.hold = true; }
      return out;
    }
    const r = u - L.walkDur;
    const end = L.path[L.path.length - 1];
    out.pos.copy(end);
    out.yaw = L.seed;
    out.leg = lo; out.arrived = true;
    if (L.act === 'tree' && L.tree) {
      // 밑동 → 줄기를 타고 오름 → 잎 사이 가지에 늘어져 쉼 → 내려옴
      const t = L.tree;
      const c = new THREE.Vector3(t.x, 0, t.z);
      const dir = end.clone().sub(c).setY(0).normalize();
      const face = Math.atan2(-dir.x, -dir.z);
      const top = Math.min(t.h * 0.92, 2.6);
      const onTrunk = c.clone().addScaledVector(dir, 0.2 * t.s + 0.12);
      const down = L.rest - r;
      if (r < CLIMB || down < CLIMB) {
        const k = r < CLIMB ? r / CLIMB : down / CLIMB;
        out.pos.copy(onTrunk).setY(top * k);
        out.yaw = face; out.anim = 'climb'; out.up = k > 0.2;
        return out;
      }
      out.pos.copy(c).addScaledVector(dir, 0.1).setY(top + 0.08);
      out.yaw = face + Math.PI / 2 + Math.sin(r * 0.05) * 0.4;
      out.anim = this.night > 0.6 || (r % 40) < 28 ? 'perch' : 'sit';
      out.up = true;
      return out;
    }
    const act = L.act;
    if (act === 'zoom') {
      // 신나서 제자리에서 빙글빙글 뛰기
      const R = 0.9, w = 2.6, ang = L.seed + r * w;
      out.pos.add(new THREE.Vector3(Math.cos(ang) * R, 0, Math.sin(ang) * R));
      out.yaw = Math.atan2(-Math.sin(ang), Math.cos(ang));
      out.anim = 'run'; out.speed = R * w;
      return out;
    }
    if (act === 'sleep' || (this.night > 0.6 && act !== 'stand')) out.anim = r < 3 ? 'sit' : 'sleep';
    else if (act === 'stand') out.anim = r % 9 < 4 ? 'stand' : 'sit';
    else if (act === 'eat') out.anim = r % 7 < 5 ? 'eat' : 'sit';
    else if (act === 'sniff') out.anim = r % 6 < 4 ? 'sniff' : 'idle';
    else out.anim = 'sit';
    return out;
  }

  // 내 화면에서만: 누르면 깜짝 놀라 뒷발로 서서 앞발을 번쩍 (레서판다의 「위협」 자세 — 사실은 귀여움)
  pet(fromPos) {
    this.hold = 3.5;
    this.holdYaw = fromPos ? Math.atan2(fromPos.x - this.shown.x, fromPos.z - this.shown.z) : this.yaw;
    this.fx.hearts(this.model.headWorld(), 3);
    this.fx.text(this.model.headWorld(), '꾸잉?', '#b9481f');
  }
  get up() { return this.shown.y > 0.3; }

  update(dt) {
    if (!this.legs) this.build();
    if (!this.legs.length) { this.model.root.visible = false; return; }
    const T = Date.now() / 1000;
    const s = this.at(T);
    if (!s.up) pushOut(this.room, s.pos, 0.18, true);
    let anim = s.anim, speed = s.speed, wantYaw = s.yaw ?? this.yaw;
    if (!this.placed) { this.shown.copy(s.pos); this.yaw = wantYaw; this.placed = true; }
    // 새 곳에 닿으면 알림 (main.js 가 가장 가까운 곳 이름으로 「나타났어요」)
    if (s.arrived && s.leg !== this.lastLeg) {
      const first = this.lastLeg === undefined;
      this.lastLeg = s.leg;
      if (!first) this.onArrive?.(s.pos.clone(), this.legs[s.leg]);
    }
    // 깜짝 등장: 내가 14 m 안에 있으면 가끔(3분에 한 번까지) 먼저 쪼르르 달려와 뒷발로 서서 「꾸잉!」 → 제 일정으로 돌아감
    const me = this.listener;
    if (me && !this.visit && !s.up && !this.up && this.hold <= 0 && me.y < 0.6 && T - (this.visitAt || 0) > 180) {
      const d = Math.hypot(me.x - this.shown.x, me.z - this.shown.z);
      if (d < 14 && d > 2.5 && Math.random() < dt * 0.05) { this.visit = { t: 0 }; this.visitAt = T; }
    }
    if (this.visit) {
      const v = this.visit;
      v.t += dt;
      const to = new THREE.Vector3(me.x, 0, me.z);
      const dir = to.clone().sub(this.shown).setY(0);
      const dist = dir.length();
      if (!v.stood && dist > 0.9 && v.t < 10) {
        dir.normalize();
        this.shown.addScaledVector(dir, Math.min(dist - 0.85, (RUN + 0.5) * dt));
        pushOut(this.room, this.shown, 0.18, true);
        wantYaw = Math.atan2(dir.x, dir.z); anim = 'run'; speed = RUN;
      } else {
        if (!v.stood) { v.stood = v.t; this.fx.text(this.model.headWorld(), '꾸잉!', '#b9481f'); this.fx.hearts(this.model.headWorld(), 2); this.onVisit?.(); }
        wantYaw = Math.atan2(me.x - this.shown.x, me.z - this.shown.z); anim = 'stand'; speed = 0;
        if (v.t - v.stood > 2.8) this.visit = null;
      }
    } else if (this.hold > 0) {
      this.hold -= dt;
      if (!this.up) { anim = 'stand'; speed = 0; wantYaw = this.holdYaw; }
    } else {
      // 깜짝 등장 · 쓰다듬기 뒤에는 땅으로 뛰어서 제 일정을 따라잡음 (아주 멀면 바로 옮김)
      const flat = Math.hypot(s.pos.x - this.shown.x, s.pos.z - this.shown.z);
      if (flat > 25) this.shown.copy(s.pos);
      else if (flat > 0.6 && !this.up) {
        const dir = new THREE.Vector3(s.pos.x - this.shown.x, 0, s.pos.z - this.shown.z).normalize();
        this.shown.addScaledVector(dir, Math.min(flat, (RUN + 0.5) * dt));
        this.shown.y = 0;
        pushOut(this.room, this.shown, 0.18, true);
        wantYaw = Math.atan2(dir.x, dir.z); anim = 'run'; speed = RUN;
      } else this.shown.lerp(s.pos, 1 - Math.exp(-(s.up || this.up ? 12 : 10) * dt));
    }
    // 가까이 서 있으면 고개를 돌려 쳐다봄 (내 화면에서만)
    let look = 0;
    
    if (me && speed < 0.1 && anim !== 'sleep' && anim !== 'climb') {
      const dx = me.x - this.shown.x, dz = me.z - this.shown.z;
      if (Math.hypot(dx, dz) < 3.5) look = THREE.MathUtils.clamp(((Math.atan2(dx, dz) - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
    }
    this.yaw = angDamp(this.yaw, wantYaw, speed > 1 ? 10 : 6, dt);
    this.pos.copy(this.shown);
    this.model.lookYaw = look;
    this.model.root.position.copy(this.shown);
    this.model.root.rotation.y = this.yaw;
    this.model.setAnim(anim);
    this.model.update(dt, speed);
  }
}

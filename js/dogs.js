// 서점 밖을 돌아다니는 진돗개 강아지 두 마리 (백구 · 황구)
//
// 서버 메시지를 하나도 쓰지 않습니다. 영화관 「함께 보기」처럼, 정해진 씨앗값으로 뽑은 산책 일정(한 바퀴 약 15분)을
// 지금 시각(Date.now)에 맞춰 각 브라우저가 계산합니다. 그래서 모든 손님이 같은 자리에서 같은 강아지를 봅니다.
// 쓰다듬기 · 짖기 · 나를 쳐다보기는 내 화면에서만 일어나는 반응이라 보낼 것이 없습니다.
import * as THREE from 'three';
import { DogModel } from './dogModel.js';
import { pushOut, findPath, insideObstacle, inCabin, levelOf } from './nav.js';

// 강아지가 들르는 곳 (모두 집 밖 땅 위). 실제로 갈 수 없는 곳은 시작할 때 빠집니다.
const SPOTS = [
  [11.2, 1.8], [12.5, -3.2], [10.5, 6.5],            // 정원 문 앞 마당
  [15.6, -2.6], [19.2, -8.4], [14.5, -9.5],          // 캠핑장 둘레
  [18.2, 8.6], [24.5, 14.2], [20.0, 16.5],           // 숲속 영화관 옆
  [9.5, 22.8], [16.8, 25.8], [22.5, 24.0],           // 바닷가
  [-4.5, 13.2], [1.8, 14.2], [5.5, 12.5],            // 현관 앞
  [38.5, 4.6], [43.2, 9.2], [36.0, -3.6],            // 들꽃 언덕 · 정자
  [25.2, -14.8], [30.5, -10.5],                      // 폭포 아래 · 계곡 가
  [-22.5, 1.2], [-6.5, -27.6], [48.6, -19.5], [55.5, 7.6], [-22, 24.6], // 둘레길 (서 · 북 · 연못 · 억새 · 남서)
];
const CYCLE_LEGS = 28;          // 한 바퀴에 들르는 곳 수
const WALK = 1.05, RUN = 2.3;   // 걷는 · 뛰는 빠르기 (m/s)
const FOLLOW_LAG = 2.2;         // 둘째는 첫째를 몇 초 뒤에서 따라감
const RESTS = ['sniff', 'sit', 'lie', 'play', 'dig', 'sleep', 'sniff', 'play', 'sit', 'chase'];

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

export class Puppies {
  constructor(scene, room, fx, sound, defs) {
    this.scene = scene; this.room = room; this.fx = fx; this.sound = sound;
    this.defs = defs;
    this.night = 0;
    this.listener = null;   // 내 위치 (가까이 오면 쳐다보고 꼬리 흔들기)
    this.dogs = defs.map((d, i) => {
      const model = new DogModel(d.coat, i + 2, d.size || 1.15);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.3;
      hit.userData.dogId = d.id;
      model.root.add(hit);
      scene.add(model.root);
      return { def: d, i, model, hit, pos: new THREE.Vector3(), shown: new THREE.Vector3(), yaw: 0, placed: false, hold: 0, holdPos: null, holdYaw: 0, yipT: -99, near: false };
    });
    this.legs = null;
  }

  // 길찾기 판이 만들어진 뒤에 부름 (buildNav 다음)
  build() {
    const g = this.room.grids?.get(0);
    const ok = (p) => !inCabin(p, 0.6) && (!g || g.ok(g.cx(p.x), g.cz(p.z))) && !insideObstacle(this.room, p, 0.35);
    const spots = [];
    this.dropped = [];
    for (const [x, z] of SPOTS) {
      // 그 자리가 막혀 있으면 둘레를 조금씩 넓혀 가며 가장 가까운 빈 땅을 찾음 (늘 같은 순서라 모든 화면이 같은 답)
      let found = null;
      for (let r = 0; r <= 3 && !found; r += 0.5) {
        for (let k = 0; k < (r ? 12 : 1) && !found; k++) {
          const a = (k / 12) * Math.PI * 2;
          const p = new THREE.Vector3(x + Math.cos(a) * r, 0, z + Math.sin(a) * r);
          pushOut(this.room, p, 0.3, true);
          if (ok(p)) found = p;
        }
      }
      if (found) spots.push(found); else this.dropped.push([x, z]);
    }
    this.spots = spots;
    if (spots.length < 3) { this.legs = []; return; }
    const rnd = mulberry32(20261103);
    const legs = [];
    let at = 0;
    let cur = spots[0];
    let tries = 0;
    while (legs.length < CYCLE_LEGS && tries < 400) {
      tries++;
      const j = Math.floor(rnd() * spots.length);
      const to = spots[j];
      const dist = to.distanceTo(cur);
      if (dist < 4 || dist > 26) continue;
      const path = [cur.clone(), ...findPath(this.room, cur, to).map((p) => p.clone().setY(0))];
      // 집 안을 가로지르거나 2층으로 올라가는 길은 쓰지 않음
      if (path.some((p) => inCabin(p, 0.3) || levelOf(p))) continue;
      const cum = [0];
      for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + path[k].distanceTo(path[k - 1]));
      const len = cum[cum.length - 1];
      if (len > dist * 2.2) continue;    // 너무 빙 돌아가는 길은 건너뜀
      const fast = rnd() < 0.3;          // 가끔은 신나서 뛰어감
      const walkDur = len / (fast ? RUN : WALK);
      const act = RESTS[Math.floor(rnd() * RESTS.length)];
      const rest = act === 'sleep' ? 26 + rnd() * 20 : act === 'chase' || act === 'play' ? 9 + rnd() * 6 : 7 + rnd() * 12;
      legs.push({ path, cum, len, fast, start: at, walkDur, rest, act, seed: rnd() * 10 });
      at += walkDur + rest;
      cur = to;
    }
    // 마지막 곳에서 처음 곳으로 돌아오는 길 (한 바퀴가 이어지도록)
    if (legs.length) {
      const first = legs[0].path[0];
      const path = [cur.clone(), ...findPath(this.room, cur, first).map((p) => p.clone().setY(0))];
      const cum = [0];
      for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + path[k].distanceTo(path[k - 1]));
      const len = cum[cum.length - 1];
      legs.push({ path, cum, len, fast: false, start: at, walkDur: len / WALK, rest: 6, act: 'sit', seed: 1 });
      at += len / WALK + 6;
    }
    this.legs = legs;
    this.cycle = at;
  }

  // 시각 T(초)에 첫째 강아지가 있을 곳 · 하는 일
  at(T, who) {
    const legs = this.legs;
    const tc = ((T % this.cycle) + this.cycle) % this.cycle;
    let lo = 0, hi = legs.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (legs[mid].start <= tc) lo = mid; else hi = mid - 1; }
    const L = legs[lo];
    const u = tc - L.start;
    const out = { pos: new THREE.Vector3(), yaw: null, anim: 'idle', speed: 0 };
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
      // 둘째는 옆으로 조금 비켜서 걸음
      if (who === 1) out.pos.add(new THREE.Vector3(Math.cos(out.yaw) * 0.45, 0, -Math.sin(out.yaw) * 0.45));
      return out;
    }
    const r = u - L.walkDur;
    const end = L.path[L.path.length - 1];
    out.pos.copy(end);
    const sideYaw = L.seed;
    const act = L.act;
    if (act === 'chase' || (act === 'play' && r > 2 && r < L.rest - 1.5)) {
      // 서로 빙글빙글 쫓아다니기 (둘이 원 위에서 마주 봄)
      const w = act === 'chase' ? 2.2 : 1.4;
      const R = act === 'chase' ? 1.1 : 0.6;
      const ang = sideYaw + r * w + (who ? Math.PI : 0);
      out.pos.add(new THREE.Vector3(Math.cos(ang) * R, 0, Math.sin(ang) * R));
      out.yaw = Math.atan2(-Math.sin(ang), Math.cos(ang));   // 원의 접선 방향
      out.anim = 'run';
      out.speed = R * w;
      return out;
    }
    // 쉬는 자리: 둘이 나란히
    out.pos.add(new THREE.Vector3(Math.cos(sideYaw) * (who ? 0.5 : -0.5), 0, Math.sin(sideYaw) * (who ? 0.5 : -0.5)));
    out.yaw = sideYaw + (who ? 0.9 : -0.6);
    if (act === 'play') out.anim = r <= 2 ? 'bow' : 'sit';
    else if (act === 'sleep') out.anim = r < 3 ? 'lie' : 'sleep';
    else if (act === 'dig') out.anim = who ? 'sit' : (r % 6 < 4 ? 'dig' : 'sniff');
    else if (act === 'sniff') out.anim = (r + who * 2) % 7 < 4 ? 'sniff' : 'idle';
    else out.anim = act === 'lie' ? 'lie' : (who && r > 5 ? 'lie' : 'sit');
    return out;
  }

  hitObjects() { return this.dogs.map((d) => d.hit); }
  find(id) { return this.dogs.find((d) => d.def.id === id); }

  // 내 화면에서만: 쓰다듬으면 잠깐 멈춰 앉아 꼬리를 흔들고 왈!
  pet(id, fromPos) {
    const d = this.find(id);
    if (!d) return;
    d.hold = 3.5;
    d.holdPos = d.shown.clone();
    d.holdYaw = fromPos ? Math.atan2(fromPos.x - d.shown.x, fromPos.z - d.shown.z) : d.yaw;
    this.fx.hearts(d.model.headWorld(), 4);
    this.sound.yip?.(2);
  }

  update(dt) {
    if (!this.legs) this.build();
    if (!this.legs.length) return;
    const T = Date.now() / 1000;
    const me = this.listener;
    for (const d of this.dogs) {
      const s = this.at(T - d.i * FOLLOW_LAG, d.i);
      pushOut(this.room, s.pos, 0.18, true);
      let anim = s.anim, speed = s.speed;
      // 밤에는 쉬는 자리에서 더 잘 잠
      if (this.night > 0.6 && (anim === 'sit' || anim === 'idle' || anim === 'sniff')) anim = 'lie';
      if (!d.placed) { d.shown.copy(s.pos); d.yaw = s.yaw ?? 0; d.placed = true; }
      let wantYaw = s.yaw ?? d.yaw;
      if (d.hold > 0) {
        d.hold -= dt;
        d.shown.lerp(d.holdPos, 1 - Math.exp(-6 * dt));
        wantYaw = d.holdYaw;
        anim = 'happy'; speed = 0;
      } else {
        const gap = d.shown.distanceTo(s.pos);
        if (gap > 8) d.shown.copy(s.pos);
        else if (gap > 0.6) {
          // 쓰다듬은 뒤 자기 일정으로 뛰어서 따라잡기
          const dir = s.pos.clone().sub(d.shown).setY(0).normalize();
          d.shown.addScaledVector(dir, Math.min(gap, (RUN + 0.6) * dt));
          wantYaw = Math.atan2(dir.x, dir.z);
          anim = 'run'; speed = RUN;
        } else d.shown.lerp(s.pos, 1 - Math.exp(-10 * dt));
      }
      // 내가 가까이 서 있으면 쳐다보고 꼬리를 흔듦 (내 화면에서만)
      let look = 0;
      if (me && d.hold <= 0 && speed < 0.1) {
        const dx = me.x - d.shown.x, dz = me.z - d.shown.z, dist = Math.hypot(dx, dz);
        const near = dist < 2.6 && me.y < 0.6;
        if (near) {
          look = THREE.MathUtils.clamp(((Math.atan2(dx, dz) - d.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -0.9, 0.9);
          if (anim !== 'sleep') anim = anim === 'lie' ? 'lie' : 'happy';
          if (!d.near && T - d.yipT > 45 && anim !== 'lie') { d.yipT = T; this.sound.yip?.(1); }
        }
        d.near = near;
      }
      d.yaw = angDamp(d.yaw, wantYaw, speed > 1.5 ? 10 : 6, dt);
      d.pos.copy(d.shown);
      d.model.lookYaw = look;
      d.model.root.position.copy(d.shown).setY(0);
      d.model.root.rotation.y = d.yaw;
      d.model.setAnim(anim);
      d.model.update(dt, speed);
    }
  }
}

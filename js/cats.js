// 서점 고양이 일곱 마리: 책장 위에서 자고, 캣타워를 오르내리고, 정원 바위에서 햇볕 쬐고, 손님 곁에 와서 앉음
// 돌발행동: 우다다(zoom), 평대 위 책 떨어뜨리기(knock), 나비 쫓기(chase), 벽 보기(stare), 다른 고양이에게 덮치기(pounce),
//          문 앞에서 야옹(meow), 물 보고 깜짝(splash), 텐트 들어가기(box), 스크린 앞에 앉기(screen),
//          둘이 술래잡기(tag), 제자리 빙글빙글(spin), 손님 발치 기습(ambush), 혼자 깜짝 놀라 튀기(scare), 발라당(roll)
// 마중: 손님이 들어오면 눈송이가 다가와 한동안 졸졸 따라다님(follow). 따라가는 모습도 각자 화면이 손님 자리를 보고 그림
// 행동(계획)은 고양이 담당 브라우저 한 곳에서만 세우고 "어디로 간다 · 무엇을 한다"만 나눠 줌. 걷는 모습은 모두가 각자 그림
import * as THREE from 'three';
import { CatModel } from './catModel.js';
import { CONFIG } from './config.js';
import { WORLD, CABIN, DOOR, pushOut, randomFloorPoint, findPath, isOutdoor } from './nav.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const angDamp = (a, b, k, dt) => {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-k * dt));
};
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// 모든 고양이에게 깔리는 돌발행동 · 따라가기 기본값 (아래 TRAITS 가 덮어씀)
const BASE = { follow: 0.5, tag: 0.7, spin: 0.5, ambush: 0.6, scare: 0.6, roll: 0.6 };
const TRAITS = {
  cheese:   { climb: 0.8, box: 1.2, spot: 1.4, wander: 1, guest: 2.4, stretch: 0.7, stove: 1.2, sun: 1.6, garden: 1.0, birds: 0.7, zoom: 1.4, knock: 0.6, chase: 0.8, stare: 0.4, pounce: 0.8, meow: 0.8, splash: 0.4, screen: 0.6 },
  tuxedo:   { climb: 2.6, box: 0.6, spot: 0.9, wander: 1, guest: 1.4, stretch: 0.8, stove: 0.8, sun: 1.0, garden: 0.9, birds: 1.2, zoom: 0.6, knock: 0.4, chase: 0.5, stare: 1.2, pounce: 0.5, meow: 0.4, splash: 0.3, screen: 0.8 },
  calico:   { climb: 0.9, box: 0.8, spot: 1.6, wander: 0.8, guest: 1.2, stretch: 0.7, stove: 1.3, sun: 1.4, garden: 1.2, birds: 0.5, zoom: 0.7, knock: 1.8, chase: 0.4, stare: 0.6, pounce: 0.6, meow: 0.6, splash: 0.3, screen: 0.5 },
  mackerel: { climb: 2.2, box: 0.5, spot: 0.7, wander: 1.1, guest: 0.9, stretch: 0.8, stove: 0.6, sun: 0.9, garden: 1.4, birds: 1.5, zoom: 1.0, knock: 0.5, chase: 1.8, stare: 0.5, pounce: 1.0, meow: 0.5, splash: 0.9, screen: 0.5 },
  // 까망이: 우다다 대장 (밤에 더)
  black:    { climb: 1.0, box: 0.7, spot: 0.6, wander: 1.0, guest: 0.8, stretch: 0.6, stove: 0.6, sun: 0.6, garden: 1.0, birds: 0.8, zoom: 2.8, knock: 0.8, chase: 1.2, stare: 0.6, pounce: 1.6, meow: 0.4, splash: 0.5, screen: 0.4, tag: 1.6, spin: 1.2, ambush: 1.0, scare: 1.2 },
  // 눈송이: 마중 고양이 (손님 따라다니기)
  white:    { climb: 0.6, box: 0.6, spot: 0.8, wander: 0.8, guest: 2.6, stretch: 0.7, stove: 1.0, sun: 1.0, garden: 0.8, birds: 0.5, zoom: 0.7, knock: 0.3, chase: 0.6, stare: 0.4, pounce: 0.5, meow: 0.9, splash: 0.2, screen: 0.6, follow: 3.0, roll: 1.4 },
  // 구름이: 숨었다 덮치기 · 상자 좋아함
  blue:     { climb: 1.2, box: 2.0, spot: 0.7, wander: 0.9, guest: 0.8, stretch: 0.7, stove: 0.7, sun: 0.7, garden: 1.0, birds: 0.9, zoom: 1.2, knock: 1.0, chase: 1.0, stare: 0.8, pounce: 1.2, meow: 0.3, splash: 0.6, screen: 0.4, ambush: 2.2, scare: 1.4, spin: 0.8 },
};

export class BookCats {
  constructor(scene, room, fx, sound) {
    this.scene = scene;
    this.room = room;
    this.fx = fx;
    this.sound = sound;
    this.isHost = true;
    this.cats = [];
    this.reserved = new Set();
    this.getGuests = () => [];
    this.night = 0;
    const starts = [V(-13.6, 0, 2.6), V(5.4, 4.83, -9.75), V(-2.0, 0, 5.0), V(4.4, 0, 6.2), V(-6.0, 0, 4.5), V(-1.2, 0, 8.4), V(11.5, 0, 3.0)];
    for (const p of starts) if (p.y < 0.05) pushOut(room, p, 0.15, true);
    this.greeted = new Set();   // 마중을 받은 손님 (이 방문 동안)
    this.greetAt = 0;
    CONFIG.cats.forEach((def, i) => {
      const model = new CatModel(def.pattern, null, i + 1, 1.3);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.25;
      hit.userData.catId = def.id;
      model.root.add(hit);
      scene.add(model.root);
      const cat = {
        def, model, hit, idx: i,
        pos: starts[i % starts.length].clone(), yaw: Math.random() * 6.28,
        queue: [], step: null, loc: { kind: 'floor' }, speed: 0, anim: 'idle',
        zzz: 0, traits: { ...BASE, ...(TRAITS[def.pattern] || TRAITS.cheese) },
      };
      if (i === 1) {
        const c = room.climbs.find((x) => x.key === 'ladder');
        if (c) { cat.loc = { kind: 'path', p: c, index: c.path.length - 2, key: 'ladder:' + (c.path.length - 2) }; this.reserved.add(cat.loc.key); cat.pos.copy(c.path[c.path.length - 2]); }
        cat.queue.push({ type: 'pose', anim: 'sleep', dur: rand(20, 40) });
      } else cat.queue.push({ type: 'pose', anim: pick(['loaf', 'sleep', 'groom']), dur: rand(4, 9) });
      this.cats.push(cat);
    });
  }

  find(id) { return this.cats.find((c) => c.def.id === id); }
  hitObjects() { return this.cats.map((c) => c.hit); }

  // ---------------- 행동 고르기 ----------------
  plan(cat) {
    const q = cat.queue;
    if (cat.loc.kind !== 'floor') { this.exitSteps(cat); return; }
    const t = cat.traits;
    const guests = this.getGuests().filter((g) => g.pos.y < 0.3);
    const bad = this.night > 0.5 || this.rain;
    const choices = [
      ['wander', t.wander], ['climb', t.climb], ['box', t.box], ['spot', t.spot], ['stretch', t.stretch],
      ['guest', guests.length ? t.guest : 0],
      ['stove', t.stove * (0.4 + this.night * 1.5)],
      ['sun', (this.room.sunRocks?.length ? t.sun : 0) * (1 - this.night) * (this.rain ? 0 : 1)],
      ['garden', t.garden * (this.rain ? 0.05 : 1 - this.night * 0.7)],
      ['birds', this.birdsPresent?.() ? t.birds : 0],
      // 돌발행동
      ['zoom', t.zoom * 0.6], ['knock', t.knock * 0.5], ['chase', (this.night < 0.5 && !this.rain ? t.chase : 0) * 0.6],
      ['stare', t.stare * 0.4], ['pounce', this.cats.length > 1 ? t.pounce * 0.4 : 0], ['meow', t.meow * 0.3],
      ['splash', (!bad ? t.splash : 0) * 0.4], ['screen', (this.night > 0.5 && this.room.screen && !this.rain ? t.screen : 0) * 0.8],
      // 더 자주 보이는 돌발행동 (2026-11-05: 우다다 · 돌발을 자주) — 밤에는 우다다가 두 배
      ['zoom2', t.zoom * (0.5 + this.night * 0.9)], ['tag', this.cats.length > 1 ? t.tag * 0.6 : 0], ['spin', t.spin * 0.5],
      ['ambush', guests.length ? t.ambush * 0.7 : 0], ['scare', t.scare * 0.5], ['roll', t.roll * 0.5],
      ['follow', guests.length ? t.follow * 0.6 : 0],
    ];
    const sum = choices.reduce((s, c) => s + c[1], 0);
    let r = Math.random() * sum, choice = 'wander';
    for (const [k, w] of choices) { if ((r -= w) <= 0) { choice = k; break; } }
    const out = isOutdoor(cat.pos);

    if (choice === 'zoom2') choice = 'zoom';
    if (choice === 'wander') {
      q.push({ type: 'walk', to: randomFloorPoint(this.room, 0.2, bad ? 'in' : undefined) });
      q.push({ type: 'pose', anim: pick(['sit', 'idle', 'groom', 'sit']), dur: rand(3, 7) });
    } else if (choice === 'garden') {
      const spots = this.room.gardenSpots;
      const to = spots.length && Math.random() < 0.5 ? pick(spots).clone().setY(0) : randomFloorPoint(this.room, 0.2, 'out');
      q.push({ type: 'walk', to });
      q.push({ type: 'pose', anim: pick(['sit', 'loaf', 'groom', 'loaf', 'stretch']), dur: rand(8, 20) });
    } else if (choice === 'birds') {
      const f = this.room.birdFeeder;
      const to = f.clone().add(V(rand(-1.4, -0.9), 0, rand(0.7, 1.3)));
      pushOut(this.room, to, 0.15, true);
      q.push({ type: 'walk', to });
      q.push({ type: 'face', yaw: yawTo(to, f) });
      q.push({ type: 'pose', anim: 'sit', dur: rand(6, 12) });
    } else if (choice === 'stretch') {
      q.push({ type: 'pose', anim: 'stretch', dur: 2.6 });
      q.push({ type: 'pose', anim: 'idle', dur: 0.8 });
      q.push({ type: 'walk', to: randomFloorPoint(this.room, 0.2, bad ? 'in' : undefined) });
    } else if (choice === 'climb') {
      const c = pick(this.room.climbs);
      const P = c.path;
      const free = [];
      for (let i = P.length - 1; i >= 1; i--) if (P[i].y > 0.3 && !this.reserved.has(`${c.key}:${i}`)) free.push(i);
      if (!free.length) return this.plan_wander(cat);
      const target = free[Math.floor(Math.random() * Math.min(3, free.length))];
      const key = `${c.key}:${target}`;
      this.reserved.add(key);
      q.push({ type: 'walk', to: P[0].clone() });
      for (let i = 1; i <= target; i++) q.push({ type: 'hop', to: P[i].clone() });
      q.push({ type: 'face', yaw: c.rotY + rand(-0.8, 0.8) });
      q.push({ type: 'pose', anim: pick(['loaf', 'sleep', 'sleep', 'loaf', 'groom']), dur: rand(14, 30) });
      q.push({ type: 'loc', loc: { kind: 'path', p: c, index: target, key } });
    } else if (choice === 'box') {
      const free = this.room.boxes.filter((b) => !this.reserved.has(b.key) && !(b.lv) && !(b.outdoor && bad));
      if (!free.length) return this.plan_wander(cat);
      const b = pick(free);
      this.reserved.add(b.key);
      q.push({ type: 'walk', to: b.floor.clone() });
      q.push({ type: 'face', yaw: b.rotY + Math.PI });
      q.push({ type: 'hop', to: b.inside.clone(), keepYaw: true, low: true });
      q.push({ type: 'pose', anim: 'sleep', dur: rand(14, 30) });
      q.push({ type: 'loc', loc: { kind: 'box', b, key: b.key } });
    } else if (choice === 'spot') {
      const spots = this.room.benchSpots.map((s, i) => ({ s, key: `spot${i}` })).filter((x) => !this.reserved.has(x.key) && !(isOutdoor(x.s) && bad) && x.s.y < 2.5);
      if (!spots.length) return this.plan_wander(cat);
      const { s, key } = pick(spots);
      this.reserved.add(key);
      const floorPt = this.floorNear(s);
      q.push({ type: 'walk', to: floorPt });
      if (s.y > 0.15) q.push({ type: 'hop', to: s.clone() });
      else q.push({ type: 'walk', to: V(s.x, 0, s.z), noCollide: true });
      q.push({ type: 'face', yaw: rand(-3, 3) });
      q.push({ type: 'pose', anim: pick(['loaf', 'sleep', 'loaf', 'sit']), dur: rand(10, 24) });
      q.push({ type: 'loc', loc: { kind: 'spot', s, floorPt, key } });
    } else if (choice === 'sun') {
      const rocks = this.room.sunRocks.map((k, i) => ({ k, key: `rock${i}` })).filter((x) => !this.reserved.has(x.key));
      if (!rocks.length) return this.plan_wander(cat);
      const { k, key } = pick(rocks);
      this.reserved.add(key);
      q.push({ type: 'walk', to: k.floor.clone() });
      q.push({ type: 'hop', to: k.top.clone() });
      q.push({ type: 'pose', anim: 'stretch', dur: 2.4 });
      q.push({ type: 'pose', anim: pick(['loaf', 'sleep', 'sleep']), dur: rand(16, 34) });
      q.push({ type: 'loc', loc: { kind: 'spot', s: k.top, floorPt: k.floor, key } });
    } else if (choice === 'guest') {
      const g = pick(guests);
      const d = cat.pos.clone().sub(g.pos).setY(0);
      if (d.lengthSq() < 0.01) d.set(1, 0, 0);
      d.normalize().multiplyScalar(0.55);
      const to = g.pos.clone().setY(0).add(d);
      pushOut(this.room, to, 0.14, true);
      q.push({ type: 'walk', to });
      q.push({ type: 'faceGuest', guest: g.id });
      q.push({ type: 'pose', anim: pick(['sit', 'loaf', 'sit', 'loaf']), dur: rand(10, 22) });
    } else if (choice === 'stove') {
      const s = this.room.stoveSpot.clone().add(V(rand(-0.2, 0.2), 0, rand(-0.5, 0.3)));
      q.push({ type: 'walk', to: s });
      q.push({ type: 'face', yaw: -Math.PI / 2 + rand(-0.6, 0.6) });
      q.push({ type: 'pose', anim: pick(['loaf', 'sleep']), dur: rand(14, 30) });
    } else if (choice === 'zoom') {
      // 우다다: 서너 곳을 전속력으로 찍고 멈춰서 멍하니
      const where = out ? 'out' : 'in';
      for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) q.push({ type: 'walk', to: randomFloorPoint(this.room, 0.2, where), fast: true });
      q.push({ type: 'pose', anim: 'idle', dur: 1.2 });
      q.push({ type: 'fx', k: 'puff' });
      q.push({ type: 'pose', anim: pick(['groom', 'sit']), dur: rand(3, 6) });
    } else if (choice === 'knock') {
      // 평대나 카운터에 올라가 앞발로 책을 톡 — 책이 떨어짐
      const tops = this.room.benchSpots.filter((s) => s.y > 0.7 && s.y < 1.2 && !isOutdoor(s));
      if (!tops.length) return this.plan_wander(cat);
      const s = pick(tops);
      const floorPt = this.floorNear(s);
      q.push({ type: 'walk', to: floorPt });
      q.push({ type: 'hop', to: s.clone() });
      q.push({ type: 'face', yaw: rand(-3, 3) });
      q.push({ type: 'pose', anim: 'sit', dur: 2.5 });
      q.push({ type: 'fx', k: 'knock' });
      q.push({ type: 'pose', anim: 'idle', dur: 1.5 });
      q.push({ type: 'hop', to: floorPt.clone() });
      q.push({ type: 'walk', to: randomFloorPoint(this.room, 0.2, 'in'), fast: true });
    } else if (choice === 'chase') {
      const bp = this.room.butterflyPos?.();
      if (!bp) return this.plan_wander(cat);
      const to = V(bp.x, 0, bp.z);
      pushOut(this.room, to, 0.15, true);
      q.push({ type: 'walk', to, fast: true });
      q.push({ type: 'pose', anim: 'jump', dur: 0.5 });
      q.push({ type: 'pose', anim: 'sit', dur: 0.8 });
      const to2 = to.clone().add(V(rand(-1.5, 1.5), 0, rand(-1.5, 1.5)));
      pushOut(this.room, to2, 0.15, true);
      q.push({ type: 'walk', to: to2, fast: true });
      q.push({ type: 'pose', anim: 'jump', dur: 0.5 });
      q.push({ type: 'pose', anim: 'groom', dur: rand(3, 6) });
    } else if (choice === 'stare') {
      // 벽을 한참 바라보기
      const walls = [V(CABIN.minX + 0.5, 0, rand(-4, 0)), V(rand(-11, -8), 0, CABIN.minZ + 0.5), V(CABIN.maxX - 0.5, 0, rand(-4, -1.5))];
      const to = pick(walls);
      pushOut(this.room, to, 0.15, true);
      q.push({ type: 'walk', to });
      q.push({ type: 'face', yaw: to.x < CABIN.minX + 1 ? -Math.PI / 2 : to.z < CABIN.minZ + 1 ? Math.PI : Math.PI / 2 });
      q.push({ type: 'pose', anim: 'sit', dur: rand(10, 20) });
      q.push({ type: 'fx', k: 'question' });
      q.push({ type: 'pose', anim: 'sit', dur: 3 });
    } else if (choice === 'pounce') {
      const other = pick(this.cats.filter((c) => c !== cat && c.loc.kind === 'floor'));
      if (!other) return this.plan_wander(cat);
      const to = other.pos.clone().setY(0).add(V(rand(-0.4, 0.4), 0, rand(-0.4, 0.4)));
      pushOut(this.room, to, 0.15, true);
      q.push({ type: 'walk', to, fast: true });
      q.push({ type: 'face', yaw: yawTo(to, other.pos) });
      q.push({ type: 'pose', anim: 'jump', dur: 0.6 });
      q.push({ type: 'fx', k: 'puff' });
      q.push({ type: 'walk', to: randomFloorPoint(this.room, 0.2, out ? 'out' : 'in'), fast: true });
      q.push({ type: 'pose', anim: 'groom', dur: rand(3, 6) });
    } else if (choice === 'meow') {
      const to = out ? V(DOOR.x + 1.0, 0, 0) : V(DOOR.x - 1.0, 0, 0);
      q.push({ type: 'walk', to });
      q.push({ type: 'face', yaw: out ? -Math.PI / 2 : Math.PI / 2 });
      q.push({ type: 'pose', anim: 'sit', dur: 1.5 });
      q.push({ type: 'fx', k: 'meow' });
      q.push({ type: 'pose', anim: 'sit', dur: 2 });
      q.push({ type: 'fx', k: 'meow' });
      q.push({ type: 'pose', anim: 'sit', dur: rand(4, 10) });
    } else if (choice === 'splash') {
      const sx = this.room.stream?.x;
      if (!sx) return this.plan_wander(cat);
      const z = rand(1, 16);
      const to = V(sx(z) - 1.6, 0, z);
      pushOut(this.room, to, 0.15, true);
      q.push({ type: 'walk', to });
      q.push({ type: 'face', yaw: Math.PI / 2 });
      q.push({ type: 'pose', anim: 'stretch', dur: 2 });
      q.push({ type: 'fx', k: 'splash' });
      q.push({ type: 'pose', anim: 'jump', dur: 0.5 });
      q.push({ type: 'walk', to: to.clone().add(V(-2.5, 0, 0)), fast: true });
      q.push({ type: 'pose', anim: 'groom', dur: rand(4, 8) });
    } else if (choice === 'screen') {
      const s = this.room.screen;
      const to = V(s.x + rand(-2, 2), 0, s.z + 1.4);
      pushOut(this.room, to, 0.15, true);
      q.push({ type: 'walk', to });
      q.push({ type: 'face', yaw: yawTo(to, s) });
      q.push({ type: 'pose', anim: pick(['sit', 'loaf']), dur: rand(20, 40) });
    } else if (choice === 'tag') {
      // 술래잡기: 내가 먼저 우다다 달아나고, 다른 고양이가 같은 길로 쫓아옴
      const other = pick(this.cats.filter((c) => c !== cat && c.loc.kind === 'floor' && c.step?.type !== 'hop' && c.pos.distanceTo(cat.pos) < 9));
      if (!other) return this.plan_wander(cat);
      const where = out ? 'out' : 'in';
      const pts = [0, 1, 2, 3].map(() => randomFloorPoint(this.room, 0.2, where));
      q.push({ type: 'pose', anim: 'jump', dur: 0.4 });
      for (const p of pts) q.push({ type: 'walk', to: p.clone(), fast: true });
      q.push({ type: 'pose', anim: 'sit', dur: 1.0 });
      q.push({ type: 'fx', k: 'puff' });
      q.push({ type: 'pose', anim: 'groom', dur: rand(3, 6) });
      this.interrupt(other);
      const oq = other.queue;
      oq.push({ type: 'face', yaw: yawTo(other.pos, cat.pos) });
      oq.push({ type: 'pose', anim: 'stretch', dur: 0.7 });
      oq.push({ type: 'walk', to: cat.pos.clone().setY(0), fast: true });
      for (const p of pts) oq.push({ type: 'walk', to: p.clone(), fast: true });
      oq.push({ type: 'pose', anim: 'jump', dur: 0.5 });
      oq.push({ type: 'pose', anim: pick(['sit', 'loaf']), dur: rand(3, 6) });
      this.routeWalks(other);
      this.emit(other);
    } else if (choice === 'spin') {
      // 제 꼬리 잡으려 빙글빙글 → 어질어질
      const c0 = cat.pos.clone().setY(0);
      q.push({ type: 'pose', anim: 'stretch', dur: 0.6 });
      for (let k = 0; k < 10; k++) {
        const a = cat.yaw + k * 1.25;
        q.push({ type: 'walk', to: c0.clone().add(V(Math.sin(a) * 0.32, 0, Math.cos(a) * 0.32)), fast: true, noCollide: true });
      }
      q.push({ type: 'fx', k: 'dizzy' });
      q.push({ type: 'pose', anim: 'sit', dur: 2.2 });
      q.push({ type: 'pose', anim: 'groom', dur: rand(2, 4) });
    } else if (choice === 'ambush') {
      // 숨어서 살금살금 → 손님 발치로 와락 → 후다닥 도망
      const g = pick(guests);
      const d = cat.pos.clone().sub(g.pos).setY(0);
      if (d.lengthSq() < 0.01) d.set(1, 0, 0);
      d.normalize();
      const hide = g.pos.clone().setY(0).addScaledVector(d, 2.4);
      pushOut(this.room, hide, 0.15, true);
      const hit = g.pos.clone().setY(0).addScaledVector(d, 0.45);
      pushOut(this.room, hit, 0.14, true);
      const away = g.pos.clone().setY(0).addScaledVector(d.clone().applyAxisAngle(V(0, 1, 0), rand(1.8, 2.6) * (Math.random() < 0.5 ? 1 : -1)), 3.2);
      pushOut(this.room, away, 0.15, true);
      q.push({ type: 'walk', to: hide });
      q.push({ type: 'faceGuest', guest: g.id });
      q.push({ type: 'pose', anim: 'stretch', dur: rand(2, 3.5) });
      q.push({ type: 'walk', to: hit, fast: true });
      q.push({ type: 'pose', anim: 'jump', dur: 0.55 });
      q.push({ type: 'fx', k: 'boo' });
      q.push({ type: 'walk', to: away, fast: true });
      q.push({ type: 'faceGuest', guest: g.id });
      q.push({ type: 'pose', anim: 'sit', dur: rand(3, 6) });
    } else if (choice === 'scare') {
      // 아무것도 없는데 혼자 깜짝 → 옆으로 튀어 달아남
      const to = cat.pos.clone().setY(0).add(V(rand(-2.8, 2.8), 0, rand(-2.8, 2.8)));
      pushOut(this.room, to, 0.15, true);
      q.push({ type: 'pose', anim: 'jump', dur: 0.5 });
      q.push({ type: 'fx', k: 'eek' });
      q.push({ type: 'walk', to, fast: true });
      q.push({ type: 'pose', anim: 'sit', dur: 1.6 });
      q.push({ type: 'fx', k: 'question' });
      q.push({ type: 'pose', anim: 'groom', dur: rand(3, 5) });
    } else if (choice === 'roll') {
      // 발라당: 바닥에 몸을 비비며 뒹굴
      q.push({ type: 'pose', anim: 'stretch', dur: 1.4 });
      q.push({ type: 'pose', anim: 'petted', dur: rand(4, 7) });
      q.push({ type: 'pose', anim: 'loaf', dur: rand(3, 6) });
    } else if (choice === 'follow') {
      const g = pick(guests);
      q.push({ type: 'follow', guest: g.id, dur: rand(20, 35) });
      q.push({ type: 'pose', anim: pick(['sit', 'loaf']), dur: rand(3, 6) });
    }
  }
  // 마중: 새로 온 손님에게 따라가기 잘하는 고양이가 다가와 야옹, 한동안 졸졸 (고양이 담당 브라우저만 계획)
  greet(guest) {
    const now = performance.now();
    if (now - this.greetAt < 15000) return;
    const cands = this.cats.filter((c) => c.step?.type !== 'hop' && c.step?.type !== 'follow').sort((a, b) => b.traits.follow - a.traits.follow);
    const cat = cands[0];
    if (!cat) return;
    this.greetAt = now;
    this.interrupt(cat);
    if (cat.loc.kind !== 'floor') this.exitSteps(cat);
    cat.queue.push({ type: 'follow', guest: guest.id, dur: 6, greet: true });
    cat.queue.push({ type: 'fx', k: 'meow' });
    cat.queue.push({ type: 'pose', anim: 'petted', dur: 2.5 });   // 발치에 몸을 비빔
    cat.queue.push({ type: 'follow', guest: guest.id, dur: rand(45, 70) });
    cat.queue.push({ type: 'pose', anim: 'loaf', dur: rand(4, 8) });
    this.routeWalks(cat);
    this.emit(cat);
  }
  plan_wander(cat) {
    cat.queue.push({ type: 'walk', to: randomFloorPoint(this.room, 0.2, 'in') });
    cat.queue.push({ type: 'pose', anim: 'sit', dur: rand(2, 5) });
  }

  floorNear(s) {
    const p = V(s.x, 0, s.z);
    pushOut(this.room, p, 0.2, true);
    return p;
  }

  exitSteps(cat) {
    const q = cat.queue;
    const loc = cat.loc;
    if (loc.key) this.reserved.delete(loc.key);
    if (loc.kind === 'path') {
      const P = loc.p.path;
      // 양 끝이 바닥인 길(오르미 · 커스텀B)은 가까운 쪽으로 내려감
      const ends = [0, P.length - 1].filter((i) => P[i].y < 0.05);
      const end = ends.length > 1 ? (Math.abs(loc.index - ends[0]) <= Math.abs(loc.index - ends[1]) || Math.random() < 0.3 ? ends[0] : ends[1]) : 0;
      const dir = end > loc.index ? 1 : -1;
      for (let i = loc.index + dir; ; i += dir) { q.push({ type: 'hop', to: P[i].clone() }); if (i === end) break; }
      if (Math.random() < 0.5) q.push({ type: 'pose', anim: 'stretch', dur: 2.4 });
    } else if (loc.kind === 'box') {
      q.push({ type: 'pose', anim: 'loaf', dur: 1.5 });
      q.push({ type: 'hop', to: loc.b.floor.clone(), low: true });
      q.push({ type: 'pose', anim: 'stretch', dur: 2.6 });
    } else if (loc.kind === 'spot') {
      if (loc.s.y > 0.15) q.push({ type: 'hop', to: loc.floorPt.clone() });
      else q.push({ type: 'walk', to: loc.floorPt.clone(), noCollide: true });
    } else if (loc.kind === 'air') {
      const p = cat.pos.clone().setY(0);
      pushOut(this.room, p, 0.16, true);
      q.push({ type: 'hop', to: p });
    }
    q.push({ type: 'loc', loc: { kind: 'floor' } });
  }

  // ---------------- 손님의 손길 ----------------
  pet(id, fromPos, local = true) {
    const cat = this.find(id);
    if (!cat) return;
    this.fx.hearts(cat.model.headWorld(), 3);
    if (local) this.sound.purr(4.5);
    if (!this.isHost) return;
    this.interrupt(cat);
    if (fromPos && cat.loc.kind === 'floor') cat.queue.push({ type: 'face', yaw: yawTo(cat.pos, fromPos) });
    cat.queue.push({ type: 'pose', anim: 'petted', dur: 4.5 });
    this.emit(cat);
  }

  treat(id, fromPos, local = true) {
    const cat = this.find(id);
    if (!cat) return;
    if (local) this.sound.meow();
    setTimeout(() => { this.fx.text(cat.model.headWorld(), '냠냠', '#c66b3d'); if (local) this.sound.crunch(); }, 700);
    setTimeout(() => this.fx.hearts(cat.model.headWorld(), 4), 2400);
    if (!this.isHost) return;
    this.interrupt(cat);
    if (fromPos && cat.loc.kind === 'floor' && fromPos.y < 0.3) {
      const d = cat.pos.clone().sub(fromPos).setY(0);
      if (d.length() > 0.6) {
        const to = fromPos.clone().setY(0).add(d.normalize().multiplyScalar(0.5));
        pushOut(this.room, to, 0.14, true);
        cat.queue.push({ type: 'walk', to, fast: true });
      }
    }
    if (fromPos) cat.queue.push({ type: 'face', yaw: yawTo(cat.pos, fromPos) });
    cat.queue.push({ type: 'pose', anim: 'eat', dur: 3.2 });
    cat.queue.push({ type: 'pose', anim: 'petted', dur: 2.5 });
    cat.queue.push({ type: 'pose', anim: 'sit', dur: 4 });
    this.emit(cat);
  }

  // 장난감으로 놀아 주기. 고양이 담당 브라우저만 계획을 세우고(cq 로 퍼짐), 나머지는 소리 · 효과만
  play(id, fromPos, toy, local = true) {
    const cat = this.find(id);
    if (!cat) return;
    if (local && Math.random() < 0.6) setTimeout(() => this.sound.meow(), 400);
    setTimeout(() => this.fx.hearts(cat.model.headWorld(), 3), 2600);
    if (!this.isHost || !fromPos) return;
    this.interrupt(cat);
    if (cat.loc.kind !== 'floor') this.exitSteps(cat);
    const me = fromPos.clone().setY(0);
    const near = (r, a) => { const v = me.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r)); pushOut(this.room, v, 0.15, true); return v; };
    const a0 = Math.atan2(cat.pos.z - me.z, cat.pos.x - me.x);
    const q = cat.queue;
    if (toy === 'wand') {
      // 깃털 낚싯대: 앞에 와서 펄쩍펄쩍, 앞발로 휘휘
      const at = near(0.9, a0);
      q.push({ type: 'walk', to: at, fast: true });
      q.push({ type: 'face', yaw: yawTo(at, me) });
      for (let i = 0; i < 3; i++) { q.push({ type: 'pose', anim: 'stretch', dur: 0.5 }); q.push({ type: 'pose', anim: 'jump', dur: 0.55 }); q.push({ type: 'fx', k: 'puff' }); }
      q.push({ type: 'pose', anim: 'sit', dur: 1.2 });
      q.push({ type: 'pose', anim: 'jump', dur: 0.6 });
      q.push({ type: 'pose', anim: 'groom', dur: 4 });
    } else if (toy === 'laser') {
      // 레이저: 빨간 점을 따라 이리저리 우다다, 마지막에 덮치기
      for (let i = 0; i < 4; i++) q.push({ type: 'walk', to: near(1.2 + Math.random() * 1.4, a0 + (i - 1.5) * 1.1), fast: true });
      q.push({ type: 'pose', anim: 'stretch', dur: 0.6 });
      q.push({ type: 'pose', anim: 'jump', dur: 0.6 });
      q.push({ type: 'fx', k: 'question' });
      q.push({ type: 'pose', anim: 'sit', dur: 3 });
    } else if (toy === 'ball') {
      // 방울 공: 굴러간 쪽으로 쫓아가 앞발로 톡톡
      const roll = near(2.2, a0 + Math.PI + 0.4);
      q.push({ type: 'walk', to: roll, fast: true });
      q.push({ type: 'pose', anim: 'stretch', dur: 0.7 });
      q.push({ type: 'pose', anim: 'jump', dur: 0.5 });
      const roll2 = near(1.6, a0 + Math.PI - 0.5);
      q.push({ type: 'walk', to: roll2, fast: true });
      q.push({ type: 'pose', anim: 'jump', dur: 0.5 });
      q.push({ type: 'pose', anim: 'loaf', dur: 3 });
    } else if (toy === 'mouse') {
      // 쥐 인형: 던진 곳으로 몸을 낮추고 살금살금 → 덮쳐서 꼭 끌어안기
      const toss = near(1.8, a0 + 0.6);
      const crouch = toss.clone().lerp(cat.pos.clone().setY(0), 0.35);
      pushOut(this.room, crouch, 0.15, true);
      q.push({ type: 'walk', to: crouch });
      q.push({ type: 'face', yaw: yawTo(crouch, toss) });
      q.push({ type: 'pose', anim: 'stretch', dur: 1.2 });
      q.push({ type: 'walk', to: toss, fast: true });
      q.push({ type: 'pose', anim: 'jump', dur: 0.6 });
      q.push({ type: 'fx', k: 'puff' });
      q.push({ type: 'pose', anim: 'petted', dur: 4 });
    } else {
      // 캣닢 쿠션: 곁에 와서 킁킁, 뒹굴뒹굴, 꾸벅
      const at = near(0.7, a0);
      q.push({ type: 'walk', to: at });
      q.push({ type: 'face', yaw: yawTo(at, me) });
      q.push({ type: 'pose', anim: 'eat', dur: 1.6 });
      q.push({ type: 'pose', anim: 'petted', dur: 4 });
      q.push({ type: 'pose', anim: 'stretch', dur: 1.5 });
      q.push({ type: 'pose', anim: 'sleep', dur: 10 });
    }
    this.routeWalks(cat);
    this.emit(cat);
  }

  // 캣타워 놀이터: 가장 가까운 고양이를 불러 캣타워를 오르게 하고, 꼭대기 근처에서 장난감을 향해 펄쩍
  playTower(key, fromPos, toy, local = true) {
    const climb = this.room.climbs.find((c) => c.key === key);
    if (!climb) return null;
    const base = climb.path[0];
    const free = this.cats.filter((c) => c.step?.type !== 'hop');
    const cat = free.sort((a, b) => a.pos.distanceTo(base) - b.pos.distanceTo(base))[0];
    if (!cat) return null;
    if (local) setTimeout(() => this.sound.meow(), 900);
    if (!this.isHost) return cat;
    this.interrupt(cat);
    if (cat.loc.kind !== 'floor') this.exitSteps(cat);
    const P = climb.path;
    let target = P.length - 1;
    while (target > 1 && this.reserved.has(`${key}:${target}`)) target--;
    const lk = `${key}:${target}`;
    this.reserved.add(lk);
    const q = cat.queue;
    q.push({ type: 'walk', to: P[0].clone(), fast: true });
    for (let i = 1; i <= target; i++) {
      q.push({ type: 'hop', to: P[i].clone() });
      if (toy && i === Math.ceil(target / 2)) { q.push({ type: 'face', yaw: yawTo(P[i], fromPos) }); q.push({ type: 'pose', anim: 'jump', dur: 0.55 }); }
    }
    q.push({ type: 'face', yaw: fromPos ? yawTo(P[target], fromPos) : climb.rotY });
    if (toy) for (let i = 0; i < 3; i++) { q.push({ type: 'pose', anim: 'stretch', dur: 0.5 }); q.push({ type: 'pose', anim: 'jump', dur: 0.55 }); }
    q.push({ type: 'pose', anim: toy === 'catnip' ? 'petted' : 'loaf', dur: 14 });
    q.push({ type: 'loc', loc: { kind: 'path', p: climb, index: target, key: lk } });
    this.routeWalks(cat);
    this.emit(cat);
    return cat;
  }

  interrupt(cat) {
    const pendingLoc = cat.queue.filter((s) => s.type === 'loc').pop();
    const hop = cat.step && cat.step.type === 'hop' ? cat.step : null;
    cat.queue = [];
    if (hop) cat.queue.push(hop);
    if (pendingLoc) cat.queue.push(pendingLoc);
    cat.step = null;
  }

  adopt() {
    this.reserved.clear();
    for (const cat of this.cats) {
      cat.queue = []; cat.step = null;
      if (cat.pos.y < 0.05) { cat.loc = { kind: 'floor' }; cat.pos.y = 0; continue; }
      let best = null, bd = 0.4;
      for (const c of this.room.climbs) c.path.forEach((pt, i) => { const d = pt.distanceTo(cat.pos); if (d < bd && pt.y > 0.05) { bd = d; best = { kind: 'path', p: c, index: i, key: `${c.key}:${i}` }; } });
      this.room.boxes.forEach((b) => { const d = b.inside.distanceTo(cat.pos); if (d < bd) { bd = d; best = { kind: 'box', b, key: b.key }; } });
      this.room.benchSpots.forEach((s, i) => { const d = s.distanceTo(cat.pos); if (d < bd) { bd = d; best = { kind: 'spot', s, floorPt: this.floorNear(s), key: `spot${i}` }; } });
      (this.room.sunRocks || []).forEach((k, i) => { const d = k.top.distanceTo(cat.pos); if (d < bd) { bd = d; best = { kind: 'spot', s: k.top, floorPt: k.floor, key: `rock${i}` }; } });
      cat.loc = best || { kind: 'air' };
      if (best?.key) this.reserved.add(best.key);
      cat.queue.push({ type: 'pose', anim: cat.anim === 'walk' ? 'sit' : cat.anim, dur: rand(2, 6) });
    }
  }

  update(dt) {
    if (this.isHost) {
      for (const g of this.getGuests()) {
        if (this.greeted.has(g.id)) continue;
        this.greeted.add(g.id);
        if (g.pos.y < 0.3) this.greet(g);
      }
    }
    for (const cat of this.cats) {
      this.simulate(cat, dt);
      cat.model.root.position.copy(cat.pos);
      cat.model.root.rotation.y = cat.yaw;
      cat.model.setAnim(cat.anim);
      cat.model.update(dt, cat.speed);
      if (cat.anim === 'sleep') {
        cat.zzz -= dt;
        if (cat.zzz < 0) { cat.zzz = 2.4; this.fx.zzz(cat.model.headWorld()); }
      }
    }
  }

  simulate(cat, dt) {
    if (!cat.step) {
      if (!cat.queue.length && this.isHost) { this.plan(cat); this.routeWalks(cat); this.emit(cat); }
      cat.step = cat.queue.shift() || { type: 'pose', anim: 'idle', dur: 1 };
      cat.step.t = 0;
      if (cat.step.type === 'walk' && !cat.step.routed && !cat.step.noCollide) {
        const wps = findPath(this.room, V(cat.pos.x, 0, cat.pos.z), V(cat.step.to.x, 0, cat.step.to.z));
        const last = { ...cat.step, routed: true, to: wps.pop() || cat.step.to };
        cat.queue.unshift(...wps.map((w) => ({ type: 'walk', to: w, routed: true, fast: cat.step.fast })), last);
        cat.step = cat.queue.shift();
        cat.step.t = 0;
      }
      if (cat.step.type === 'hop') {
        cat.step.from = cat.pos.clone();
        const d = cat.step.from.distanceTo(cat.step.to);
        cat.step.dur = 0.42 + d * 0.22;
        const dy = cat.step.to.y - cat.step.from.y;
        cat.step.arc = cat.step.low ? 0.12 : Math.max(0.16, dy > 0 ? 0.2 : 0.12);
        if (!cat.step.keepYaw && Math.hypot(cat.step.to.x - cat.pos.x, cat.step.to.z - cat.pos.z) > 0.05) cat.step.yaw = yawTo(cat.pos, cat.step.to);
      }
      if (cat.step.type === 'fx') { this.playFx(cat, cat.step.k); cat.step = null; return this.simulate(cat, dt); }
    }
    const s = cat.step;
    s.t += dt;
    cat.speed = 0;
    switch (s.type) {
      case 'walk': {
        const d = s.to.clone().sub(cat.pos).setY(0);
        const dist = d.length();
        const sp = s.fast ? 2.2 : 0.6;
        if (dist < 0.06 || s.t > 25) { cat.step = null; cat.anim = 'idle'; break; }
        const want = Math.atan2(d.x, d.z);
        cat.yaw = angDamp(cat.yaw, want, s.fast ? 14 : 8, dt);
        const facing = Math.cos(want - cat.yaw);
        const v = sp * Math.max(0, facing) * Math.min(1, dist / 0.25 + 0.3);
        cat.pos.addScaledVector(d.normalize(), v * dt);
        if (!s.noCollide) pushOut(this.room, cat.pos, 0.12, true);
        cat.pos.y = 0;
        cat.speed = v;
        cat.anim = 'walk';
        break;
      }
      case 'hop': {
        const k = Math.min(1, s.t / s.dur);
        if (s.yaw !== undefined) cat.yaw = angDamp(cat.yaw, s.yaw, 14, dt);
        if (k < 0.2) { cat.anim = 'sit'; break; }
        const u = (k - 0.2) / 0.8;
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        cat.pos.lerpVectors(s.from, s.to, e);
        cat.pos.y += s.arc * 4 * u * (1 - u);
        cat.anim = 'jump';
        if (k >= 1) { cat.pos.copy(s.to); cat.step = null; cat.anim = 'idle'; }
        break;
      }
      case 'face':
        cat.yaw = angDamp(cat.yaw, s.yaw, 6, dt);
        if (s.t > 0.5) cat.step = null;
        break;
      case 'follow': {
        // 손님을 졸졸: 1.2초마다 길을 다시 찾고, 가까우면 곁에 앉아 올려다봄. 2층 · 다락에 오르면 아래서 기다림
        const g = this.getGuests().find((x) => x.id === s.guest);
        if (!g || s.t > s.dur) { cat.step = null; cat.anim = 'idle'; break; }
        const gp = g.pos;
        const dist = Math.hypot(gp.x - cat.pos.x, gp.z - cat.pos.z);
        const near = s.greet ? 0.75 : 1.05;
        if (gp.y > 0.3 || dist < near) {
          cat.yaw = angDamp(cat.yaw, yawTo(cat.pos, gp), 6, dt);
          cat.anim = dist < near + 0.3 ? (s.t % 14 < 9 ? 'sit' : 'loaf') : 'sit';
          s.route = null;
          if (s.greet && dist < near) { cat.step = null; }
          break;
        }
        s.re = (s.re || 0) - dt;
        if (!s.route || !s.route.length || s.re <= 0) {
          s.route = findPath(this.room, V(cat.pos.x, 0, cat.pos.z), V(gp.x, 0, gp.z));
          s.re = 1.2;
        }
        let tgt = s.route[0];
        while (tgt && Math.hypot(tgt.x - cat.pos.x, tgt.z - cat.pos.z) < 0.15 && s.route.length > 1) { s.route.shift(); tgt = s.route[0]; }
        if (!tgt) break;
        const d = V(tgt.x - cat.pos.x, 0, tgt.z - cat.pos.z);
        const want = Math.atan2(d.x, d.z);
        cat.yaw = angDamp(cat.yaw, want, 12, dt);
        const sp = dist > 3.2 ? 2.5 : dist > 1.8 ? 1.5 : 0.8;
        const v = sp * Math.max(0.2, Math.cos(want - cat.yaw));
        cat.pos.addScaledVector(d.normalize(), Math.min(v * dt, Math.hypot(tgt.x - cat.pos.x, tgt.z - cat.pos.z) + 0.01));
        pushOut(this.room, cat.pos, 0.12, true);
        cat.pos.y = 0;
        cat.speed = v;
        cat.anim = 'walk';
        break;
      }
      case 'faceGuest': {
        const g = this.getGuests().find((x) => x.id === s.guest);
        if (g) cat.yaw = angDamp(cat.yaw, yawTo(cat.pos, g.pos), 6, dt);
        if (s.t > 0.5) cat.step = null;
        break;
      }
      case 'pose':
        cat.anim = s.anim;
        if (s.t > s.dur) cat.step = null;
        break;
      case 'loc':
        cat.loc = s.loc;
        cat.step = null;
        break;
      default:
        cat.step = null;
    }
    cat.model.lookYaw = 0;
    if (cat.anim === 'sit' || cat.anim === 'idle' || cat.anim === 'loaf') {
      const g = this.getGuests()[0];
      if (g) {
        const rel = ((yawTo(cat.pos, g.pos) - cat.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        if (Math.abs(rel) < 1.2 && cat.pos.distanceTo(g.pos) < 3) cat.model.lookYaw = rel * 0.6;
      }
    }
    cat.pos.x = THREE.MathUtils.clamp(cat.pos.x, WORLD.minX + 0.15, WORLD.maxX - 0.15);
    cat.pos.z = THREE.MathUtils.clamp(cat.pos.z, WORLD.minZ + 0.15, WORLD.maxZ - 0.15);
    if (this.room.birdFeeder && cat.pos.distanceTo(this.room.birdFeeder) < 0.6) this.room.scareBirds?.();
  }

  // 돌발행동 효과 (모든 손님 화면에서 각자 재생)
  playFx(cat, k) {
    const head = cat.model.headWorld();
    if (k === 'knock') { this.fx.drop(cat.pos.clone().add(V(Math.sin(cat.yaw) * 0.3, 0, Math.cos(cat.yaw) * 0.3))); this.sound.thud?.(); }
    else if (k === 'puff') this.fx.puff(cat.pos.clone().setY(cat.pos.y + 0.1));
    else if (k === 'question') this.fx.text(head, '?', '#7d6553');
    else if (k === 'meow') { this.fx.text(head, '야옹', '#c66b3d'); if (cat.pos.distanceTo(this.listener || cat.pos) < 12) this.sound.meow(); }
    else if (k === 'splash') { this.fx.splash(cat.pos.clone().add(V(1.0, 0, 0))); this.fx.text(head, '!', '#4a6a8a'); }
    else if (k === 'dizzy') this.fx.text(head, '빙글빙글', '#7d6553');
    else if (k === 'boo') { this.fx.text(head, '냥!', '#c66b3d'); this.fx.puff(cat.pos.clone().setY(cat.pos.y + 0.1)); if (cat.pos.distanceTo(this.listener || cat.pos) < 8) this.sound.meow(); }
    else if (k === 'eek') this.fx.text(head, '!', '#c0503a');
  }

  // 담당 브라우저: 걸어갈 길을 미리 계산해 계획에 넣음 → 다른 손님도 같은 길로 걷는 모습을 그림
  routeWalks(cat) {
    const q = cat.queue;
    let from = cat.pos.clone().setY(0);
    for (let i = 0; i < q.length; i++) {
      const st = q[i];
      if (st.type === 'hop') { from = st.to.clone().setY(0); continue; }
      if (st.type !== 'walk' || st.routed || st.noCollide) { if (st.to) from = st.to.clone().setY(0); continue; }
      const wps = findPath(this.room, from, V(st.to.x, 0, st.to.z));
      const last = wps.pop() || st.to;
      const add = wps.slice(0, 12).map((w) => ({ type: 'walk', to: w, routed: true, fast: st.fast }));
      st.routed = true; st.to = last;
      q.splice(i, 0, ...add);
      i += add.length;
      from = last.clone();
    }
  }

  // ---------------- 네트워크: 좌표 대신 "계획"만 ----------------
  emit(cat) { if (this.isHost) this.onPlan?.(this.planMsg(cat)); }

  planMsg(cat) {
    const r2 = (v) => Math.round(v * 100) / 100;
    const q = [];
    for (const st of cat.queue) {
      if (st.type === 'loc') continue;
      const o = { k: st.type };
      if (st.to) o.to = [r2(st.to.x), r2(st.to.y), r2(st.to.z)];
      if (st.anim) o.a = st.anim;
      if (st.dur !== undefined && (st.type === 'pose' || st.type === 'follow')) o.d = Math.round(st.dur * 10) / 10;
      if (st.yaw !== undefined && st.type === 'face') o.y = r2(st.yaw);
      if (st.guest) o.g = st.guest;
      if (st.type === 'fx') o.x = st.k;
      const f = (st.keepYaw ? 1 : 0) | (st.low ? 2 : 0) | (st.fast ? 4 : 0) | (st.noCollide ? 8 : 0) | (st.routed ? 16 : 0) | (st.greet ? 32 : 0);
      if (f) o.f = f;
      q.push(o);
      if (q.length >= 36) break;
    }
    return { i: cat.idx, p: [r2(cat.pos.x), r2(cat.pos.y), r2(cat.pos.z)], y: r2(cat.yaw), q };
  }

  applyPlan(m) {
    const cat = this.cats[m.i];
    if (!cat || !Array.isArray(m.q) || !Array.isArray(m.p)) return;
    const p = V(+m.p[0] || 0, +m.p[1] || 0, +m.p[2] || 0);
    if (cat.pos.distanceTo(p) > 0.3) { cat.pos.copy(p); cat.yaw = +m.y || 0; }
    cat.queue = m.q.slice(0, 40).map((o) => {
      const st = { type: String(o.k) };
      if (Array.isArray(o.to)) st.to = V(+o.to[0] || 0, +o.to[1] || 0, +o.to[2] || 0);
      if (o.a) st.anim = String(o.a);
      if (o.d !== undefined) st.dur = Math.min(120, +o.d || 1);
      if (o.y !== undefined) st.yaw = +o.y || 0;
      if (o.g) st.guest = String(o.g);
      if (o.x) st.k = String(o.x).slice(0, 12);
      const f = +o.f || 0;
      if (f & 1) st.keepYaw = true;
      if (f & 2) st.low = true;
      if (f & 4) st.fast = true;
      if (f & 8) st.noCollide = true;
      if (f & 16) st.routed = true;
      if (f & 32) st.greet = true;
      return st;
    }).filter((st) => ['walk', 'hop', 'face', 'faceGuest', 'pose', 'fx', 'follow'].includes(st.type) && (['pose', 'face', 'faceGuest', 'fx'].includes(st.type) || st.to || (st.type === 'follow' && st.guest)));
    cat.step = null;
  }

  syncMsg() { return this.cats.map((c) => this.planMsg(c)); }
}

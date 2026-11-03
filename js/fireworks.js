// 바닷가 폭죽 놀이 (밤에만). 바다 위로 쏘아 올려 터뜨림
// - 다른 손님에게는 쏠 때만 'fw' 한 건 {k: 종류, s: 씨앗값, x: 쏘는 자리}. 같은 씨앗값이라 모두 같은 모양 · 같은 색으로 터집니다.
// - 불꽃막대(sparkler)는 그 손님 손에서 40초 동안 타닥거림
import * as THREE from 'three';

export const FW_KINDS = [
  { id: 'peony', ico: '🌼', name: '국화', note: '둥글게 활짝 — 가장 기본' },
  { id: 'willow', ico: '🌾', name: '버드나무', note: '금빛 꼬리가 길게 늘어져 내려옴' },
  { id: 'heart', ico: '💗', name: '하트', note: '분홍 하트가 바다 위에' },
  { id: 'star', ico: '⭐', name: '별', note: '별 모양으로 터지고 반짝반짝' },
  { id: 'ring', ico: '💫', name: '고리', note: '토성 같은 고리 두 겹' },
  { id: 'multi', ico: '🎆', name: '연발 다섯 발', note: '여러 색이 연달아' },
  { id: 'sparkler', ico: '🎇', name: '불꽃막대', note: '손에 들고 40초 동안 타닥타닥' },
];
const COLORS = ['#ff5a5a', '#ffd34d', '#7bdcff', '#a98bff', '#7dffb0', '#ff8fd0', '#ffffff', '#ffa040'];
const CAP = 6000;
const LAUNCH_Z = 28.6, SEA_FAR = 43;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function sparkTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// 불티 묶음 하나 (같은 크기 점들을 한 번에 그림)
class Pool {
  constructor(scene, cap, size, tex) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3); this.base = new Float32Array(cap * 3);
    this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.drag = new Float32Array(cap); this.grav = new Float32Array(cap); this.flick = new Uint8Array(cap);
    for (let i = 0; i < cap; i++) this.pos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.pts.frustumCulled = false;
    this.pts.userData.noHit = true;
    this.pts.visible = false;
    scene.add(this.pts);
    this.next = 0;
  }
  spawn(x, y, z, vx, vy, vz, color, life, drag = 1.2, grav = 3.2, flick = 0) {
    const i = this.next; this.next = (this.next + 1) % this.cap;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.base[i * 3] = color.r; this.base[i * 3 + 1] = color.g; this.base[i * 3 + 2] = color.b;
    this.life[i] = life; this.max[i] = life; this.drag[i] = drag; this.grav[i] = grav; this.flick[i] = flick;
  }
  update(dt) {
    const P = this.pos, V = this.vel, C = this.col, B = this.base;
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { P[i * 3 + 1] = -999; C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = 0; continue; }
      const k = Math.exp(-this.drag[i] * dt);
      V[i * 3] *= k; V[i * 3 + 1] = V[i * 3 + 1] * k - this.grav[i] * dt; V[i * 3 + 2] *= k;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      let f = Math.min(1, this.life[i] / this.max[i] * 1.6);
      if (this.flick[i] && Math.random() < 0.35) f *= 0.25;
      C[i * 3] = B[i * 3] * f; C[i * 3 + 1] = B[i * 3 + 1] * f; C[i * 3 + 2] = B[i * 3 + 2] * f;
    }
    this.pts.visible = any;
    if (any) { this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true; }
    return any;
  }
}

export class Fireworks {
  constructor(scene, sound) {
    this.scene = scene; this.sound = sound;
    const tex = sparkTex();
    this.big = new Pool(scene, CAP, 0.42, tex);     // 터지는 불꽃
    this.tiny = new Pool(scene, 1600, 0.07, tex);   // 솟는 꼬리 · 불꽃막대
    this.rockets = [];
    this.pending = [];
    this.flash = new THREE.PointLight('#ffd9a0', 0, 70, 1.4);
    scene.add(this.flash);
    this.flashT = 0;
    this.sparklers = [];
    this.listener = null;
  }

  spawn(...a) { this.big.spawn(...a); }
  spark(...a) { this.tiny.spawn(...a); }
  busy() { return this.rockets.length > 0 || this.pending.length > 0 || this.big.pts.visible; }

  // 쏘기: kind, seed, 쏘는 자리 x. local = 내가 쏜 것
  launch(kind, seed, x, local = true) {
    if (kind === 'multi') {
      const r = mulberry32(seed);
      const ks = ['peony', 'willow', 'heart', 'star', 'ring'];
      for (let i = 0; i < 5; i++) this.pending.push({ t: i * 0.55, kind: ks[Math.floor(r() * ks.length)], seed: (seed + i * 101) >>> 0, x: x + (r() - 0.5) * 6, local });
      return;
    }
    const r = mulberry32(seed);
    const from = new THREE.Vector3(x, 0.3, LAUNCH_Z);
    const to = new THREE.Vector3(x + (r() - 0.5) * 8, 9 + r() * 4, SEA_FAR + (r() - 0.5) * 5);
    this.rockets.push({ kind, seed, r, from, to, t: 0, dur: 1.5 + r() * 0.4, local });
    this.sound.fwLaunch?.(this.vol(from));
  }

  vol(p) { return this.listener ? Math.max(0.15, 1 - this.listener.distanceTo(p) / 70) : 0.6; }

  burst(rk) {
    const { kind, r } = rk;
    const P = rk.to;
    const c1 = new THREE.Color(COLORS[Math.floor(r() * COLORS.length)]);
    const c2 = new THREE.Color(COLORS[Math.floor(r() * COLORS.length)]);
    const gold = new THREE.Color('#ffc46a');
    const n = kind === 'willow' ? 150 : 190;
    const sp = 9 + r() * 3;
    const v = new THREE.Vector3();
    if (kind === 'heart' || kind === 'star') {
      // 북쪽(서점 쪽)에서 바라보는 평면에 모양을 그림
      const pink = new THREE.Color(kind === 'heart' ? '#ff6fae' : '#fff3a0');
      for (let i = 0; i < n; i++) {
        const t = i / n * Math.PI * 2;
        let x, y;
        if (kind === 'heart') { x = 16 * Math.sin(t) ** 3; y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); x /= 17; y /= 17; }
        else { const k = (i % (n / 5)) / (n / 5); const a0 = Math.floor(i / (n / 5)) * Math.PI * 2 / 5 - Math.PI / 2; const a1 = a0 + Math.PI * 2 / 5; const pa = [Math.cos(a0), Math.sin(a0)], pm = [Math.cos(a0 + Math.PI / 5) * 0.42, Math.sin(a0 + Math.PI / 5) * 0.42], pb = [Math.cos(a1), Math.sin(a1)]; const q = k < 0.5 ? [pa[0] + (pm[0] - pa[0]) * k * 2, pa[1] + (pm[1] - pa[1]) * k * 2] : [pm[0] + (pb[0] - pm[0]) * (k - 0.5) * 2, pm[1] + (pb[1] - pm[1]) * (k - 0.5) * 2]; x = q[0]; y = -q[1]; }
        this.spawn(P.x, P.y, P.z, -x * sp * 0.9, y * sp * 0.9, (r() - 0.5) * 0.6, pink, 1.9 + r() * 0.4, 1.6, 1.2, kind === 'star' ? 1 : 0);
      }
      for (let i = 0; i < 40; i++) { v.randomDirection().multiplyScalar(sp * 0.35); this.spawn(P.x, P.y, P.z, v.x, v.y, v.z, c1, 1.2, 1.8, 2.5, 1); }
    } else if (kind === 'ring') {
      const tilt = r() * 0.8 - 0.4;
      for (let ring = 0; ring < 2; ring++) for (let i = 0; i < n / 2; i++) {
        const a = i / (n / 2) * Math.PI * 2;
        v.set(Math.cos(a), Math.sin(a) * Math.sin(tilt + ring * 0.9), Math.sin(a) * Math.cos(tilt + ring * 0.9)).multiplyScalar(sp * (ring ? 0.7 : 1));
        this.spawn(P.x, P.y, P.z, v.x, v.y, v.z, ring ? c2 : c1, 2.0, 1.4, 2.0);
      }
      for (let i = 0; i < 30; i++) { v.randomDirection().multiplyScalar(sp * 0.2); this.spawn(P.x, P.y, P.z, v.x, v.y, v.z, gold, 1.6, 1.4, 2.0, 1); }
    } else if (kind === 'willow') {
      for (let i = 0; i < n; i++) { v.randomDirection().multiplyScalar(sp * (0.7 + r() * 0.3)); this.spawn(P.x, P.y, P.z, v.x, v.y * 0.9 + 1.5, v.z, gold, 3.6 + r() * 0.8, 0.9, 2.6, 1); }
    } else {
      for (let i = 0; i < n; i++) { v.randomDirection().multiplyScalar(sp * (0.85 + r() * 0.15)); this.spawn(P.x, P.y, P.z, v.x, v.y, v.z, i % 3 ? c1 : c2, 1.8 + r() * 0.5, 1.3, 3.0); }
      for (let i = 0; i < 50; i++) { v.randomDirection().multiplyScalar(sp * 0.45); this.spawn(P.x, P.y, P.z, v.x, v.y, v.z, new THREE.Color('#ffffff'), 1.1, 1.6, 3.0, 1); }
    }
    this.flash.position.copy(P);
    this.flash.color.copy(c1).lerp(new THREE.Color('#ffffff'), 0.4);
    this.flashT = 1;
    const d = this.listener ? this.listener.distanceTo(P) : 40;
    setTimeout(() => { this.sound.fwBoom?.(this.vol(P)); if (kind === 'willow' || kind === 'star' || kind === 'ring') setTimeout(() => this.sound.fwCrackle?.(this.vol(P)), 700); }, Math.min(1800, d / 340 * 1000));
  }

  // 불꽃막대: avatar 의 sparkTip 에서 불티가 튐
  addSparkler(avatar, sec = 40) { avatar.restoreToy = avatar.toy === 'sparkler' ? avatar.restoreToy : avatar.toy; avatar.sparkler(sec); this.sparklers.push({ avatar, t: sec }); this.sound.sizzle?.(sec); }

  update(dt) {
    // 연발 대기열
    for (let i = this.pending.length - 1; i >= 0; i--) { const p = this.pending[i]; p.t -= dt; if (p.t <= 0) { this.pending.splice(i, 1); this.launch(p.kind, p.seed, p.x, p.local); } }
    // 솟아오르는 폭죽 (꼬리 불티)
    const gold = new THREE.Color('#ffcf8a'), white = new THREE.Color('#ffffff');
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const rk = this.rockets[i];
      rk.t += dt / rk.dur;
      const u = Math.min(1, rk.t), e = 1 - (1 - u) * (1 - u);
      const x = rk.from.x + (rk.to.x - rk.from.x) * e, y = rk.from.y + (rk.to.y - rk.from.y) * e, z = rk.from.z + (rk.to.z - rk.from.z) * e;
      for (let k = 0; k < 4; k++) this.spark(x, y, z, (Math.random() - 0.5) * 0.6, -1 - Math.random(), (Math.random() - 0.5) * 0.6, gold, 0.5 + Math.random() * 0.3, 2, 1, 1);
      if (rk.t >= 1) { this.rockets.splice(i, 1); this.burst(rk); }
    }
    // 불꽃막대
    for (let i = this.sparklers.length - 1; i >= 0; i--) {
      const s = this.sparklers[i];
      s.t -= dt;
      const tip = s.avatar.sparkTip;
      if (s.t <= 0 || !tip || s.avatar.toy !== 'sparkler') { this.sparklers.splice(i, 1); continue; }
      const w = tip.getWorldPosition(new THREE.Vector3());
      for (let k = 0; k < 7; k++) { const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.2; this.spark(w.x, w.y, w.z, Math.cos(a) * sp, Math.random() * 1.2 - 0.2, Math.sin(a) * sp, Math.random() < 0.5 ? gold : white, 0.25 + Math.random() * 0.3, 2.5, 2.5, 1); }
    }
    this.big.update(dt);
    this.tiny.update(dt);
    this.flashT = Math.max(0, this.flashT - dt * 2.2);
    this.flash.intensity = this.flashT * this.flashT * 40;
  }
}

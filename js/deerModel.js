// 꽃사슴 모델 — 적갈색 몸에 흰 점무늬, 흰 엉덩이 털, 가는 다리 (엄마는 뿔 없음, 아기는 점이 더 많고 작음)
// 휴대폰이 무겁지 않게 움직이는 부위(몸 · 목과 머리 · 다리 넷 · 꼬리)마다 조각을 하나로 합쳐 그림 (사슴 한 마리에 7번)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const lerp = THREE.MathUtils.lerp;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const SPH = new THREE.SphereGeometry(1, 12, 9), CYL = new THREE.CylinderGeometry(1, 0.8, 1, 7), CONE = new THREE.ConeGeometry(1, 1, 7);
const C = { coat: '#a8643a', back: '#8e5230', belly: '#ecdcc2', spot: '#f6ecda', white: '#f8f3ea', dark: '#2a1c16', hoof: '#3a2a22', ear: '#d9a88a', nose: '#1e1614' };

// 조각 목록 [모양, 색, 크기, 자리, 기울기] → 꼭짓점 색을 칠해 하나로 합친 메시
function part(list) {
  const geos = list.map(([g, col, s, p, r]) => {
    const geo = g.clone();
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...(p || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(r || [0, 0, 0]))), new THREE.Vector3(...s));
    geo.applyMatrix4(m);
    const c = new THREE.Color(col), n = geo.attributes.position.count, cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return geo.index ? geo.toNonIndexed() : geo;
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos, false), MAT);
  mesh.castShadow = true;
  return mesh;
}

// 자세: bodyY 몸 높이 · neck 목 숙임(+ 아래) · fold 다리 접기 · ears 귀 세우기 · tail 꼬리 들기
const POSES = {
  idle:  { bodyY: 0, neck: 0.05, fold: 0, ears: 0.3, tail: 0.1, pitch: 0 },
  walk:  { bodyY: 0, neck: 0.3, fold: 0, ears: 0.3, tail: 0.1, pitch: 0 },
  run:   { bodyY: 0.02, neck: 0.15, fold: 0, ears: 0.6, tail: 0.9, pitch: 0 },
  graze: { bodyY: -0.02, neck: 2.05, fold: 0, ears: 0.1, tail: 0.2, pitch: 0.22 },   // 몸 앞을 숙이고 목을 땅까지
  alert: { bodyY: 0.01, neck: -0.3, fold: 0, ears: 1, tail: 0.7, pitch: -0.05 },
  lie:   { bodyY: -0.4, neck: 0.15, fold: 1, ears: 0.3, tail: 0, pitch: 0 },
  sleep: { bodyY: -0.42, neck: 1.2, fold: 1, ears: 0, tail: 0, pitch: 0 },
  nurse: { bodyY: -0.02, neck: 0.6, fold: 0, ears: 0.4, tail: 0.6, pitch: 0.05 },   // 아기가 엄마 배 밑에 고개를 넣음
};

export class DeerModel {
  constructor(fawn = false, seed = 1) {
    this.fawn = fawn;
    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    this.root.scale.setScalar(fawn ? 0.58 : 1);
    this.anim = 'idle'; this.t = seed * 3.7; this.lookYaw = 0; this.hop = 0;
    this.cur = { ...POSES.idle };
    const H = 0.66;   // 등 높이
    const r = (k) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    // 몸: 적갈색, 등줄기 짙게, 배 밝게, 흰 점 두 줄 (아기는 점이 더 많음), 흰 엉덩이
    const body = [
      [SPH, C.coat, [0.15, 0.16, 0.36], [0, H, 0]],
      [SPH, C.back, [0.07, 0.04, 0.3], [0, H + 0.13, -0.02]],
      [SPH, C.belly, [0.12, 0.08, 0.28], [0, H - 0.09, 0.02]],
      [SPH, C.white, [0.1, 0.11, 0.06], [0, H + 0.02, -0.34]],
    ];
    const nSpots = fawn ? 22 : 14;
    for (let i = 0; i < nSpots; i++) {
      const side = i % 2 ? 1 : -1, row = (i >> 1) % 2;
      const z = -0.26 + r(i) * 0.5, y = H + 0.06 + row * 0.045 - Math.abs(z) * 0.08;
      body.push([SPH, C.spot, [0.018, 0.018, 0.024], [side * (0.14 - row * 0.035), y, z]]);
    }
    this.body = part(body);
    this.inner.add(this.body);
    // 목과 머리 (목 밑동에서 숙였다 들었다)
    this.neckG = new THREE.Group();
    this.neckG.position.set(0, H - 0.01, 0.29);   // 가슴께에서 목을 숙였다 들었다
    this.neckG.add(part([
      [CYL, C.coat, [0.06, 0.44, 0.075], [0, 0.21, 0.07], [0.4, 0, 0]],
      [SPH, C.belly, [0.045, 0.13, 0.04], [0, 0.14, 0.12], [0.4, 0, 0]],
      [SPH, C.coat, [0.07, 0.07, 0.11], [0, 0.42, 0.17]],
      [SPH, C.coat, [0.045, 0.045, 0.08], [0, 0.39, 0.27]],
      [SPH, C.belly, [0.04, 0.03, 0.05], [0, 0.37, 0.31]],
      [SPH, C.nose, [0.022, 0.018, 0.015], [0, 0.395, 0.345]],
      [SPH, C.dark, [0.014, 0.016, 0.012], [0.058, 0.44, 0.21]],
      [SPH, C.dark, [0.014, 0.016, 0.012], [-0.058, 0.44, 0.21]],
    ]));
    this.ears = [-1, 1].map((s) => {
      const e = new THREE.Group();
      e.position.set(s * 0.055, 0.48, 0.14);
      e.add(part([[SPH, C.coat, [0.022, 0.06, 0.013], [s * 0.02, 0.045, 0]], [SPH, C.ear, [0.014, 0.045, 0.006], [s * 0.02, 0.045, 0.008]]]));
      this.neckG.add(e);
      return e;
    });
    this.inner.add(this.neckG);
    // 다리 넷: 엉덩이 · 어깨에서 흔들림, 가늘고 길게 (아기는 몸에 비해 더 길게)
    const legLen = fawn ? 0.62 : 0.56;
    this.legs = [[-0.075, 0.24], [0.075, 0.24], [-0.08, -0.24], [0.08, -0.24]].map(([x, z], i) => {
      const hip = new THREE.Group();
      hip.position.set(x, H - 0.04, z);
      hip.add(part([
        [CYL, C.coat, [0.035, legLen * 0.5, 0.04], [0, -legLen * 0.25, 0]],
        [CYL, i < 2 ? C.coat : C.belly, [0.022, legLen * 0.5, 0.024], [0, -legLen * 0.72, 0]],
        [CYL, C.hoof, [0.024, 0.04, 0.03], [0, -legLen + 0.0, 0.005]],
      ]));
      this.inner.add(hip);
      return hip;
    });
    this.legLen = legLen;
    // 꼬리: 짧고 흰 털, 끝이 검은 줄
    this.tail = new THREE.Group();
    this.tail.position.set(0, H + 0.07, -0.37);
    this.tail.add(part([[SPH, C.white, [0.03, 0.07, 0.025], [0, -0.05, -0.01]], [SPH, C.dark, [0.012, 0.05, 0.01], [0, -0.04, -0.03]]]));
    this.inner.add(this.tail);
  }
  setAnim(a) { if (POSES[a]) this.anim = a; }
  headWorld() { return this.neckG.localToWorld(new THREE.Vector3(0, 0.58, 0.2)); }
  update(dt, speed = 0) {
    this.t += dt;
    const P = POSES[this.anim] || POSES.idle, c = this.cur;
    for (const k in P) c[k] = damp(c[k], P[k], 5, dt);
    const moving = speed > 0.05 && (this.anim === 'walk' || this.anim === 'run');
    const f = this.t * (this.anim === 'run' ? 11 : 6.5);
    // 아기 사슴 깡충 (hop 이 켜지면 네 발을 모아 통통 튐)
    const hopY = this.hop > 0 ? Math.abs(Math.sin(this.t * 9)) * 0.12 : 0;
    this.inner.position.y = c.bodyY * this.legLen / 0.56 + (moving ? Math.abs(Math.sin(f)) * 0.012 : 0) + hopY;
    this.inner.rotation.x = c.pitch;
    this.legs.forEach((L, i) => {
      const swing = moving ? Math.sin(f + (i === 0 || i === 3 ? 0 : Math.PI)) * (this.anim === 'run' ? 0.75 : 0.45) : 0;
      const tuck = c.fold * (i < 2 ? 1.45 : -1.45) + (this.hop > 0 ? (i < 2 ? 0.5 : -0.5) * Math.abs(Math.sin(this.t * 9)) : 0);
      L.rotation.x = damp(L.rotation.x, swing + tuck - c.pitch, 10, dt);   // 몸을 숙여도 다리는 곧게
      L.scale.y = 1 - c.fold * 0.55;   // 누우면 다리를 몸 밑으로 접어 넣음
    });
    const chew = this.anim === 'graze' ? Math.sin(this.t * 3) * 0.06 : 0;
    this.neckG.rotation.x = damp(this.neckG.rotation.x, c.neck + chew, 4, dt);
    this.neckG.rotation.y = damp(this.neckG.rotation.y, this.lookYaw, 4, dt);
    // 귀: 가끔 쫑긋 돌림
    this.ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * (0.9 - c.ears * 0.6) + Math.sin(this.t * 0.7 + i * 2) * 0.12 * (1 - c.ears); });
    this.tail.rotation.x = damp(this.tail.rotation.x, -c.tail * 1.1 + (this.anim === 'nurse' ? Math.sin(this.t * 14) * 0.4 : 0), 8, dt);
  }
}

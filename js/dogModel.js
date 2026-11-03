// 진돗개 강아지 모델 — 쫑긋 선 세모 귀, 등 위로 동그랗게 말린 꼬리, 통통한 몸
// 털색은 꼭짓점 색으로 칠합니다(배 · 가슴 · 주둥이 · 다리 안쪽이 밝은 '우라지로' 무늬).
import * as THREE from 'three';
import { fbm3 } from './kit.js';

export const COATS = {
  white: { base: '#f4eee3', dark: '#e6dccb', light: '#fffdf8', ear: '#f2c8b8', eye: '#2e1f14', nose: '#2a2220' },  // 백구
  fawn:  { base: '#d6974a', dark: '#b8722e', light: '#f7e6c6', ear: '#e9b48c', eye: '#2a1a10', nose: '#231b18' },  // 황구
};

const tmp = new THREE.Color();
function painter(coat, seed) {
  const base = new THREE.Color(coat.base), dark = new THREE.Color(coat.dark), light = new THREE.Color(coat.light);
  return (part, p, out) => {
    out.copy(base);
    const n = fbm3(p.x * 2.4 + seed, p.y * 2.4, p.z * 2.4 - seed);
    let w = 0;
    if (part === 'body') {
      // 등은 살짝 진하고, 배 · 가슴은 밝게
      out.lerp(dark, THREE.MathUtils.smoothstep(p.y, 0.35, 0.95) * 0.55);
      w = THREE.MathUtils.smoothstep(-p.y + Math.max(0, p.z) * 0.6, 0.25, 0.7);
    } else if (part === 'chest') w = THREE.MathUtils.smoothstep(-p.y + p.z * 0.8, -0.2, 0.5);
    else if (part === 'head') {
      out.lerp(dark, THREE.MathUtils.smoothstep(p.y - p.z * 0.4, 0.45, 0.9) * 0.45);
      w = THREE.MathUtils.smoothstep(p.z * 0.8 - p.y * 0.9, 0.55, 0.95);
    } else if (part === 'muzzle') w = THREE.MathUtils.smoothstep(-p.y, -0.6, 0.4);
    else if (part === 'leg') w = THREE.MathUtils.smoothstep(-p.y, -0.1, 0.6) * 0.8;
    else if (part === 'paw') w = 0.85;
    else if (part === 'tail') w = THREE.MathUtils.smoothstep(-p.y, 0.0, 0.8) * 0.6;
    if (w > 0) out.lerp(light, Math.min(1, w));
    out.offsetHSL(0, 0, (n - 0.5) * 0.05);
    return out;
  };
}

function paint(geo, part, paintFn) {
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const c = new THREE.Vector3(); bb.getCenter(c);
  const sz = new THREE.Vector3(); bb.getSize(sz);
  const cols = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.set((pos.getX(i) - c.x) / (sz.x / 2 || 1), (pos.getY(i) - c.y) / (sz.y / 2 || 1), (pos.getZ(i) - c.z) / (sz.z / 2 || 1));
    paintFn(part, p, tmp);
    cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

function m(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

const lerp = THREE.MathUtils.lerp;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const whiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const tongueMat = new THREE.MeshStandardMaterial({ color: '#e57f86', roughness: 0.6 });

// 자세별 목표값 — bodyY 몸 높이, pitch 앞뒤 기울기(음수 = 엉덩이 내림), rear 뒷다리 접기, fold 네 다리 접기,
// head 고개 숙임, wag 꼬리 흔들기 세기, bow 앞다리 내리기(놀자 자세), tongue 혀, roll 옆으로 눕기
const POSES = {
  idle:  { bodyY: 0.27, pitch: 0, rear: 0, fold: 0, head: -0.05, wag: 0.35, bow: 0, tongue: 0.4, roll: 0, eyes: 1 },
  walk:  { bodyY: 0.27, pitch: 0, rear: 0, fold: 0, head: 0.05, wag: 0.5, bow: 0, tongue: 0.2, roll: 0, eyes: 1 },
  run:   { bodyY: 0.28, pitch: 0.05, rear: 0, fold: 0, head: 0.1, wag: 0.8, bow: 0, tongue: 1, roll: 0, eyes: 1 },
  sit:   { bodyY: 0.27, pitch: -0.6, rear: 1, fold: 0, head: -0.25, wag: 0.25, bow: 0, tongue: 0.5, roll: 0, eyes: 1 },
  lie:   { bodyY: 0.14, pitch: 0, rear: 0, fold: 1, head: -0.1, wag: 0.1, bow: 0, tongue: 0, roll: 0, eyes: 0.8 },
  sleep: { bodyY: 0.12, pitch: 0, rear: 0, fold: 1, head: 0.5, wag: 0, bow: 0, tongue: 0, roll: 0.25, eyes: 0 },
  sniff: { bodyY: 0.25, pitch: 0.25, rear: 0, fold: 0, head: 0.85, wag: 0.6, bow: 0, tongue: 0, roll: 0, eyes: 1 },
  bow:   { bodyY: 0.22, pitch: 0.45, rear: 0, fold: 0, head: -0.45, wag: 1, bow: 1, tongue: 1, roll: 0, eyes: 1 },
  happy: { bodyY: 0.27, pitch: -0.6, rear: 1, fold: 0, head: -0.45, wag: 1.2, bow: 0, tongue: 1, roll: 0, eyes: 0.35 },
  dig:   { bodyY: 0.24, pitch: 0.35, rear: 0, fold: 0, head: 0.6, wag: 0.7, bow: 0, tongue: 0.3, roll: 0, eyes: 1 },
};
export const DOG_ANIMS = Object.keys(POSES);

export class DogModel {
  constructor(coatName = 'white', seed = 1, size = 1) {
    const coat = COATS[coatName] || COATS.white;
    const paintFn = painter(coat, seed * 3.1);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const earInMat = new THREE.MeshStandardMaterial({ color: coat.ear, roughness: 0.8 });
    const noseMat = new THREE.MeshStandardMaterial({ color: coat.nose, roughness: 0.35 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: coat.eye, roughness: 0.2 });
    this.root = new THREE.Group();
    this.root.scale.setScalar(size);
    this.bodyPivot = new THREE.Group();
    this.root.add(this.bodyPivot);

    // 몸통 (강아지라 짧고 통통) + 가슴 털 + 엉덩이
    this.body = m(paint(new THREE.SphereGeometry(1, 28, 20).scale(0.13, 0.125, 0.2), 'body', paintFn), mat);
    this.bodyPivot.add(this.body);
    this.body.add(m(paint(new THREE.SphereGeometry(1, 20, 16).scale(0.12, 0.13, 0.1), 'chest', paintFn), mat, 0, -0.005, 0.12));
    this.body.add(m(paint(new THREE.SphereGeometry(1, 20, 16).scale(0.125, 0.12, 0.11), 'body', paintFn), mat, 0, 0.0, -0.11));

    // 머리 (몸에 비해 크게 — 강아지)
    this.neck = new THREE.Group();
    this.neck.position.set(0, 0.11, 0.17);
    this.body.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.set(0, 0.06, 0.03);
    this.neck.add(this.head);
    this.head.add(m(paint(new THREE.SphereGeometry(1, 28, 20).scale(0.115, 0.105, 0.11), 'head', paintFn), mat));
    // 볼살
    const cheek = paint(new THREE.SphereGeometry(1, 14, 10).scale(0.06, 0.05, 0.055), 'muzzle', paintFn);
    for (const s of [-1, 1]) this.head.add(m(cheek, mat, s * 0.055, -0.035, 0.05));
    // 주둥이 (앞으로 뭉툭하게) + 코
    const muzzle = m(paint(new THREE.SphereGeometry(1, 18, 14).scale(0.055, 0.045, 0.07), 'muzzle', paintFn), mat, 0, -0.035, 0.1);
    this.head.add(muzzle);
    this.head.add(m(new THREE.SphereGeometry(0.022, 12, 10).scale(1.25, 0.85, 0.9), noseMat, 0, -0.018, 0.163));
    // 혀 (헥헥)
    this.tongue = m(new THREE.SphereGeometry(0.022, 10, 8).scale(0.9, 0.35, 1.3), tongueMat, 0, -0.07, 0.125);
    this.head.add(this.tongue);
    // 눈 (진돗개 특유의 아몬드형 · 검은 눈)
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eg = new THREE.Group();
      eg.position.set(s * 0.045, 0.018, 0.093);
      eg.rotation.set(0, s * 0.4, s * -0.25);
      const ball = m(new THREE.SphereGeometry(0.019, 12, 10), eyeMat);
      ball.scale.set(1.25, 0.95, 0.5);
      eg.add(ball);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), whiteMat);
      hl.position.set(-s * 0.004 + 0.003, 0.007, 0.01);
      eg.add(hl);
      this.head.add(eg);
      this.eyes.push(eg);
    }
    // 귀 — 세모로 쫑긋 (강아지라 끝이 살짝 앞으로)
    const earGeo = paint(new THREE.ConeGeometry(0.045, 0.095, 4, 1).rotateY(Math.PI / 4).translate(0, 0.047, 0), 'head', paintFn);
    const earIn = new THREE.ConeGeometry(0.028, 0.065, 4, 1).rotateY(Math.PI / 4).translate(0, 0.034, 0);
    this.ears = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(s * 0.06, 0.075, -0.015);
      e.rotation.set(0.12, 0, -s * 0.22);
      const o = m(earGeo, mat); o.scale.z = 0.45; e.add(o);
      const i = m(earIn, earInMat, 0, 0.004, 0.012); i.scale.z = 0.3; e.add(i);
      this.head.add(e);
      this.ears.push(e);
    }

    // 다리 (짧고 굵게)
    const legGeo = paint(new THREE.CapsuleGeometry(0.036, 0.1, 4, 10).translate(0, -0.065, 0), 'leg', paintFn);
    const pawGeo = paint(new THREE.SphereGeometry(0.042, 12, 10).scale(1, 0.65, 1.2), 'paw', paintFn);
    this.legs = [];
    for (const [x, z, k] of [[-0.065, 0.12, 'f'], [0.065, 0.12, 'f'], [-0.07, -0.12, 'b'], [0.07, -0.12, 'b']]) {
      const hip = new THREE.Group();
      hip.position.set(x, -0.04, z);
      hip.add(m(legGeo, mat));
      hip.add(m(pawGeo, mat, 0, -0.15, 0.014));
      this.body.add(hip);
      this.legs.push({ hip, kind: k, side: Math.sign(x) });
    }

    // 꼬리 — 등 위로 동그랗게 말림 (마디를 이어 붙여 고리 모양)
    this.tailBase = new THREE.Group();
    this.tailBase.position.set(0, 0.075, -0.19);
    this.body.add(this.tailBase);
    this.tail = [];
    let parent = this.tailBase;
    const N = 7;
    for (let i = 0; i < N; i++) {
      const r = 0.034 - i * 0.0022;
      const g = paint(new THREE.CapsuleGeometry(r, 0.03, 3, 8).translate(0, 0.026, 0), 'tail', paintFn);
      const seg = new THREE.Group();
      if (i > 0) seg.position.y = 0.04;
      seg.add(m(g, mat));
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }

    this.cur = { ...POSES.idle };
    this.anim = 'idle';
    this.t = Math.random() * 10;
    this.phase = 0;
    this.blink = 0;
    this.lookYaw = 0;
  }

  setAnim(a) { if (POSES[a]) this.anim = a; }

  update(dt, speed = 0) {
    const P = POSES[this.anim] || POSES.idle;
    const c = this.cur;
    for (const k in P) c[k] = damp(c[k], P[k], 8, dt);
    this.t += dt;
    const moving = speed > 0.05 && (this.anim === 'walk' || this.anim === 'run');
    const running = this.anim === 'run';
    this.phase += dt * (moving ? (running ? 12 : 7) + speed * 4 : 0);
    const sw = moving ? Math.sin(this.phase) : 0;

    // 몸: 뛸 땐 통통 튀고, 숨쉬기
    const pant = c.tongue > 0.5 ? Math.sin(this.t * 14) * 0.003 : Math.sin(this.t * 2.4) * 0.003;
    const bounce = running ? Math.abs(sw) * 0.03 : Math.abs(sw) * 0.01;
    this.bodyPivot.position.y = c.bodyY + bounce + pant;
    this.bodyPivot.rotation.x = c.pitch * 0.55 + (running ? sw * 0.08 : 0);
    this.bodyPivot.rotation.z = c.roll * 0.9;
    this.body.position.z = -c.rear * 0.035;
    // 놀자 자세(bow)일 때 엉덩이를 씰룩
    this.bodyPivot.rotation.y = c.bow * Math.sin(this.t * 7) * 0.12;

    // 머리
    const digBob = this.anim === 'dig' ? Math.sin(this.t * 12) * 0.12 : 0;
    const sniffBob = this.anim === 'sniff' ? Math.sin(this.t * 9) * 0.05 : 0;
    this.neck.rotation.x = c.head - c.pitch * 0.5 + digBob + sniffBob;
    const tilt = this.anim === 'happy' || this.anim === 'idle' ? Math.sin(this.t * 0.9) * 0.18 : 0;
    this.neck.rotation.z = tilt * (this.anim === 'happy' ? 1.4 : 0.6) - c.roll * 0.6;
    this.neck.rotation.y = damp(this.neck.rotation.y, this.lookYaw, 4, dt);
    this.neck.position.y = 0.11 - c.fold * 0.03;

    // 혀 · 눈 · 귀
    this.tongue.scale.set(0.9, 0.35, 1.3 * Math.max(0.01, c.tongue));
    this.tongue.visible = c.tongue > 0.08;
    this.blink -= dt;
    if (this.blink < -2.5 - Math.random() * 3) this.blink = 0.13;
    const open = c.eyes * (this.blink > 0 ? 0.1 : 1);
    for (const e of this.eyes) e.scale.y = Math.max(0.08, open);
    const flick = Math.sin(this.t * 0.8 + 1) > 0.97 ? 0.35 : 0;
    this.ears.forEach((e, i) => {
      e.rotation.x = 0.12 + (this.anim === 'happy' ? -0.45 : 0) + (i ? flick : 0);   // 쓰다듬으면 귀를 뒤로 눕힘
    });

    // 다리
    for (const L of this.legs) {
      const front = L.kind === 'f';
      const offs = running ? (front ? 0 : Math.PI * 0.6) + (L.side > 0 ? 0.5 : 0) : (front ? 0 : Math.PI) + (L.side > 0 ? Math.PI : 0);
      let rx = moving ? Math.sin(this.phase + offs) * (running ? 0.8 : 0.55) : 0;
      if (this.anim === 'dig' && front) rx = Math.sin(this.t * 14 + (L.side > 0 ? Math.PI : 0)) * 0.7 - 0.4;
      if (front) rx += c.pitch * 0.55 - c.bow * 1.25;
      else rx += c.pitch * 0.55 - c.rear * 1.35;
      L.hip.rotation.x = rx;
      L.hip.scale.y = 1 - c.fold * 0.6;
      L.hip.position.y = -0.04 + c.fold * 0.06 + (front ? 0 : c.rear * 0.04);
      L.hip.rotation.z = !front && c.rear > 0.5 ? L.side * 0.25 * c.rear : 0;
    }

    // 꼬리: 말린 고리 + 좌우로 살랑 (기분 좋으면 크게)
    const wag = Math.sin(this.t * (8 + c.wag * 10)) * c.wag * 0.6;
    this.tailBase.rotation.x = -0.35 - c.rear * 0.4;
    this.tailBase.rotation.z = wag * 0.5;
    this.tail.forEach((s, i) => {
      if (i === 0) { s.rotation.x = -0.1; return; }
      s.rotation.x = -0.62 * (1 - c.fold * 0.3);
      s.rotation.z = wag * 0.18 + (i > 3 ? 0.12 : 0);
    });
  }

  headWorld(out = new THREE.Vector3()) { return this.head.getWorldPosition(out); }
}

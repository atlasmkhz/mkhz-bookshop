// 레서판다 모델 — 적갈색 털, 흰 얼굴 무늬 · 귀 테두리, 까만 다리와 배, 굵은 줄무늬 꼬리
// 꼭짓점 색 대신 부위마다 단색 재질 (작고 가벼움). 자세는 코드로 움직임
import * as THREE from 'three';

const lerp = THREE.MathUtils.lerp;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const RUST = mat('#b9481f'), RUST2 = mat('#9c3a19'), DARK = mat('#2a1712'), WHITE = mat('#f6efe4', 0.9), PALE = mat('#e6b27a'), NOSE = mat('#1a1210', 0.4), EYE = mat('#120c0a', 0.25);
const SPH = new THREE.SphereGeometry(1, 14, 10), CYL = new THREE.CylinderGeometry(1, 1, 1, 8), CONE = new THREE.ConeGeometry(1, 1, 8);

function m(geo, material, sx, sy, sz, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, material);
  o.scale.set(sx, sy, sz);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

// 자세: bodyY 몸 높이 · pitch 앞뒤 기울기(음수 = 앞이 들림) · fold 다리 접기 · head 고개 숙임 · curl 웅크림 · climb 나무에 매달림 · stand 뒷발로 서기
const POSES = {
  idle:  { bodyY: 0.2, pitch: 0, fold: 0, head: 0, curl: 0, climb: 0, stand: 0 },
  walk:  { bodyY: 0.2, pitch: 0, fold: 0, head: 0.08, curl: 0, climb: 0, stand: 0 },
  run:   { bodyY: 0.21, pitch: 0.05, fold: 0, head: 0.12, curl: 0, climb: 0, stand: 0 },
  sit:   { bodyY: 0.2, pitch: -0.7, fold: 0.3, head: -0.25, curl: 0, climb: 0, stand: 0 },
  stand: { bodyY: 0.2, pitch: -1.35, fold: 0, head: -0.45, curl: 0, climb: 0, stand: 1 },
  sniff: { bodyY: 0.18, pitch: 0.25, fold: 0, head: 0.7, curl: 0, climb: 0, stand: 0 },
  eat:   { bodyY: 0.2, pitch: -0.7, fold: 0.3, head: 0.25, curl: 0, climb: 0, stand: 0 },
  sleep: { bodyY: 0.1, pitch: 0, fold: 1, head: 0.45, curl: 1, climb: 0, stand: 0 },
  climb: { bodyY: 0.2, pitch: -1.5, fold: 0.2, head: -0.6, curl: 0, climb: 1, stand: 0 },
  perch: { bodyY: 0.12, pitch: 0, fold: 1, head: 0.2, curl: 0.4, climb: 0, stand: 0 },   // 나뭇가지 위에 늘어져 쉼
};

export class RedPandaModel {
  constructor(size = 1) {
    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    this.root.scale.setScalar(size);
    this.anim = 'idle';
    this.t = Math.random() * 10;
    this.lookYaw = 0;
    this.cur = { ...POSES.idle };
    const body = this.body = new THREE.Group();
    this.inner.add(body);
    // 몸통: 등은 적갈색, 배는 까맣게
    body.add(m(SPH, RUST, 0.13, 0.11, 0.21, 0, 0, 0));
    body.add(m(SPH, DARK, 0.11, 0.07, 0.17, 0, -0.045, 0.01));
    // 다리 네 개 (엉덩이 · 어깨에서 흔들림)
    this.legs = [];
    for (const [x, z] of [[-0.075, 0.12], [0.075, 0.12], [-0.08, -0.12], [0.08, -0.12]]) {
      const hip = new THREE.Group();
      hip.position.set(x, -0.02, z);
      hip.add(m(CYL, DARK, 0.032, 0.17, 0.032, 0, -0.085, 0));
      hip.add(m(SPH, DARK, 0.036, 0.026, 0.045, 0, -0.17, 0.012));
      body.add(hip);
      this.legs.push(hip);
    }
    // 머리
    const neck = this.neck = new THREE.Group();
    neck.position.set(0, 0.06, 0.2);
    body.add(neck);
    const head = this.head = new THREE.Group();
    neck.add(head);
    head.add(m(SPH, RUST, 0.105, 0.09, 0.095, 0, 0.02, 0.04));
    head.add(m(SPH, WHITE, 0.05, 0.04, 0.045, 0, -0.012, 0.11));          // 주둥이
    head.add(m(SPH, NOSE, 0.017, 0.012, 0.012, 0, 0.004, 0.152));
    for (const s of [-1, 1]) {
      head.add(m(SPH, WHITE, 0.04, 0.035, 0.03, s * 0.058, -0.005, 0.09));   // 흰 볼
      head.add(m(SPH, WHITE, 0.022, 0.012, 0.012, s * 0.035, 0.06, 0.112)); // 흰 눈썹
      head.add(m(SPH, RUST2, 0.012, 0.035, 0.008, s * 0.042, 0.0, 0.128));  // 눈 밑 눈물 줄
      head.add(m(SPH, EYE, 0.014, 0.016, 0.01, s * 0.042, 0.032, 0.122));
      const ear = new THREE.Group();
      ear.position.set(s * 0.075, 0.09, 0.02);
      ear.rotation.z = -s * 0.35;
      ear.add(m(CONE, WHITE, 0.04, 0.06, 0.02, 0, 0, 0));
      ear.add(m(CONE, DARK, 0.026, 0.042, 0.012, 0, -0.006, 0.006));
      head.add(ear);
    }
    // 꼬리: 굵은 마디 일곱, 적갈색 · 연한 줄이 번갈아
    this.tail = [];
    let parent = body;
    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i ? 0 : 0.02, i ? -0.05 : -0.2);
      seg.add(m(SPH, i % 2 ? PALE : RUST, 0.055 - i * 0.002, 0.055 - i * 0.002, 0.04, 0, 0, -0.02));
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }
    this.hit = null;
  }
  setAnim(a) { if (POSES[a]) this.anim = a; }
  headWorld() { return this.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0)); }
  update(dt, speed = 0) {
    this.t += dt;
    const P = POSES[this.anim] || POSES.idle, c = this.cur;
    for (const k in P) c[k] = damp(c[k], P[k], 6, dt);
    const walking = speed > 0.05 && (this.anim === 'walk' || this.anim === 'run');
    const f = this.t * (this.anim === 'run' ? 13 : 8);
    const bob = walking ? Math.abs(Math.sin(f)) * 0.012 : Math.sin(this.t * 2.2) * 0.003;
    this.inner.position.y = c.bodyY * (1 - c.climb * 0.2) + bob;
    this.inner.rotation.x = c.pitch;
    // 다리: 걸을 때 엇갈려 흔들고, 앉거나 자면 접음. 서기 · 매달리기는 앞발을 앞으로
    this.legs.forEach((L, i) => {
      const front = i < 2;
      const swing = walking ? Math.sin(f + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7 : 0;
      let rx = swing - c.fold * (front ? 1.2 : -1.0);
      if (front) rx -= c.stand * 0.9 + c.climb * 1.3;
      else rx += c.pitch < -0.5 ? -c.pitch * 0.9 : 0;   // 앉으면 뒷다리를 바닥에
      L.rotation.x = damp(L.rotation.x, rx, 10, dt);
    });
    this.neck.rotation.x = damp(this.neck.rotation.x, c.head - c.pitch * 0.85 + (this.anim === 'eat' ? Math.sin(this.t * 5) * 0.12 : 0), 6, dt);
    this.neck.rotation.y = damp(this.neck.rotation.y, this.lookYaw + c.curl * 0.8, 4, dt);
    // 꼬리: 느리게 살랑, 웅크리면 몸을 감싸고, 서거나 매달리면 아래로 늘어뜨림
    const wave = this.t * (walking ? 3.5 : 1.3);
    this.tail.forEach((s, i) => {
      s.rotation.x = 0.12 + c.curl * 0.1 + (c.stand + c.climb) * 0.25 - (walking ? 0.05 : 0);
      s.rotation.y = Math.sin(wave - i * 0.6) * 0.12 + c.curl * 0.42;
    });
  }
}

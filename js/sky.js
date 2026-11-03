// 밤하늘: 별 · 은하수 · 달 · 별자리 · 별똥별 (밤 모드에서만 보임)
// - 별똥별은 지금 시각으로 정해지므로(9초 칸마다 씨앗값) 모든 손님이 같은 순간에 같은 별똥별을 봅니다. 메시지 0건.
// - 방향: 북쪽 = -z (서점 북쪽 벽), 남쪽 = +z (바다)
import * as THREE from 'three';
import { textSprite } from './kit.js';

const R = 150;
const D2R = Math.PI / 180;
function dir(azDeg, altDeg, out = new THREE.Vector3()) {
  const az = azDeg * D2R, al = altDeg * D2R;
  return out.set(Math.cos(al) * Math.sin(az), Math.sin(al), -Math.cos(al) * Math.cos(az));
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let _dot;
function dotTex() {
  if (_dot) return _dot;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return (_dot = new THREE.CanvasTexture(c));
}

// 별자리 (가운데 방위 · 고도, 별 자리는 도 단위로 x 오른쪽 · y 위)
const CONST = [
  { name: '북두칠성', az: -28, alt: 52, stars: [[-14, 4], [-9, 6], [-5, 6], [0, 5], [0, 0], [6, -1], [6, 5]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { name: '북극성', az: 0, alt: 37, stars: [[0, 0]], lines: [] },
  { name: '카시오페이아', az: 30, alt: 33, stars: [[-8, 0], [-4, 4], [0, 1], [4, 5], [8, 2]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { name: '오리온', az: 172, alt: 34, stars: [[-5, 9], [4, 8], [-1.5, 0], [0, 0.6], [1.5, 1.2], [-4, -8], [5, -8]], lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] },
  { name: '직녀성', az: 292, alt: 52, stars: [[0, 0], [2, -3], [3.5, -2]], lines: [[0, 1], [1, 2], [2, 0]] },
  { name: '견우성', az: 236, alt: 38, stars: [[0, 0], [-1.5, 1.4], [1.5, -1.4]], lines: [[1, 0], [0, 2]] },
];

export class Sky {
  constructor(scene, dpr = 1) {
    this.g = new THREE.Group();
    this.g.renderOrder = -2;
    scene.add(this.g);
    this.dpr = dpr;
    this.showConst = 0;   // 0 ~ 1 (별멍 때 천천히 나타남)
    this.wantConst = false;
    this.onMeteor = null;
    this.seenMeteor = -1;
    const rnd = mulberry32(1103);
    const v = new THREE.Vector3();
    // 별 세 겹 (작은 별 · 보통 · 밝은 별)
    this.layers = [];
    for (const [n, size] of [[1300, 1.3], [380, 2.1], [70, 3.2]]) {
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), base = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let y;
        do { y = rnd() * 2 - 1; } while (y < -0.03);
        const a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y);
        pos.set([Math.cos(a) * r * R, y * R, Math.sin(a) * r * R], i * 3);
        const tint = rnd();
        const c = tint < 0.15 ? [1, 0.86, 0.7] : tint < 0.35 ? [0.75, 0.85, 1] : [1, 1, 1];
        base[i] = 0.55 + rnd() * 0.45;
        col.set(c.map((x) => x * base[i]), i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size: size * dpr, sizeAttenuation: false, map: dotTex(), vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.userData.noHit = true;
      this.g.add(pts);
      this.layers.push({ pts, mat, col, base, n, tints: col.slice() });
    }
    // 은하수: 직녀성 · 견우성 사이와 카시오페이아를 지나는 큰 띠
    {
      const A = dir(264, 46), B = dir(28, 31);
      const p = new THREE.Vector3().crossVectors(A, B).normalize();
      const u = A.clone().normalize(), w = new THREE.Vector3().crossVectors(p, u).normalize();
      const n = 5200;
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      let k = 0;
      for (let i = 0; i < n * 3 && k < n; i++) {
        const th = rnd() * Math.PI * 2;
        const g = (rnd() + rnd() + rnd() - 1.5) * 0.16;
        v.copy(u).multiplyScalar(Math.cos(th)).addScaledVector(w, Math.sin(th)).addScaledVector(p, g).normalize();
        if (v.y < 0.02) continue;
        pos.set([v.x * R, v.y * R, v.z * R], k * 3);
        const b = 0.25 + rnd() * 0.35;
        col.set([b * 0.85, b * 0.9, b], k * 3);
        k++;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, k * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col.slice(0, k * 3), 3));
      this.milky = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.1 * dpr, sizeAttenuation: false, map: dotTex(), vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      this.milky.frustumCulled = false;
      this.g.add(this.milky);
      // 뿌연 빛 (큰 점 몇 십 개)
      this.haze = [];
      for (let i = 0; i < 46; i++) {
        const th = i / 46 * Math.PI * 2 + rnd() * 0.1;
        v.copy(u).multiplyScalar(Math.cos(th)).addScaledVector(w, Math.sin(th)).addScaledVector(p, (rnd() - 0.5) * 0.1).normalize();
        if (v.y < 0.05) continue;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: '#9fb2e0', transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
        s.position.copy(v).multiplyScalar(R * 0.98);
        s.scale.setScalar(R * (0.16 + rnd() * 0.1));
        s.userData.noHit = true;
        this.g.add(s); this.haze.push(s);
      }
    }
    // 달 (초승달)
    {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(84, 54, 40, 0, Math.PI * 2); g.fill();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      this.moon.position.copy(dir(118, 28)).multiplyScalar(R * 0.95);
      this.moon.scale.setScalar(13);
      this.g.add(this.moon);
      this.moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: '#ffe9b8', transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      this.moonGlow.position.copy(this.moon.position);
      this.moonGlow.scale.setScalar(34);
      this.g.add(this.moonGlow);
    }
    // 별자리 선 · 이름
    {
      const seg = [], bright = [];
      this.labels = [];
      for (const c of CONST) {
        const cosA = Math.cos(c.alt * D2R);
        const pts = c.stars.map(([x, y]) => dir(c.az + x / Math.max(0.3, cosA), c.alt + y).multiplyScalar(R * 0.97));
        pts.forEach((q) => bright.push(q.x, q.y, q.z));
        for (const [a, b] of c.lines) seg.push(pts[a].x, pts[a].y, pts[a].z, pts[b].x, pts[b].y, pts[b].z);
        const lab = textSprite(c.name, { height: 4.2, bg: 'rgba(0,0,0,0)', color: '#cfe0ff', font: '500 40px "Gowun Dodum", sans-serif' });
        lab.material.fog = false; lab.material.opacity = 0;
        const lp = dir(c.az, c.alt - (c.stars.length > 1 ? 9 : 4)).multiplyScalar(R * 0.96);
        lab.position.copy(lp);
        lab.userData.noHit = true;
        this.g.add(lab); this.labels.push(lab);
      }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
      this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#8fb0ff', transparent: true, opacity: 0, depthWrite: false, fog: false }));
      this.lines.frustumCulled = false;
      this.g.add(this.lines);
      // 별자리 별은 늘 조금 더 밝게
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bright, 3));
      this.cstars = new THREE.Points(bg, new THREE.PointsMaterial({ size: 3.6 * dpr, sizeAttenuation: false, map: dotTex(), color: '#fffaf0', transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      this.cstars.frustumCulled = false;
      this.g.add(this.cstars);
    }
    // 별똥별
    {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0, 0, 0]), 3));
      this.meteor = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      this.meteor.frustumCulled = false;
      this.meteor.visible = false;
      this.g.add(this.meteor);
      this.mHead = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: '#ffffff', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      this.mHead.scale.setScalar(2.2); this.mHead.visible = false;
      this.g.add(this.mHead);
    }
    this.t = 0;
  }

  // 지금 칸의 별똥별 (없으면 null). 9초 칸마다 55% 확률
  meteorAt(T) {
    for (const slot of [Math.floor(T / 9), Math.floor(T / 9) - 1]) {
      const r = mulberry32(slot * 7919 + 13);
      if (r() > 0.55) continue;
      const start = slot * 9 + r() * 6, dur = 0.7 + r() * 0.5;
      if (T < start || T > start + dur) continue;
      const az = r() * 360, alt = 38 + r() * 40;
      const daz = (r() - 0.5) * 34, dalt = -(10 + r() * 12);
      return { id: slot, u: (T - start) / dur, a: dir(az, alt), b: dir(az + daz, alt + dalt) };
    }
    return null;
  }

  update(dt, n, camPos, clear = true) {
    this.t += dt;
    this.g.position.copy(camPos);
    const vis = clear ? THREE.MathUtils.smoothstep(n, 0.35, 0.9) : 0;
    this.g.visible = vis > 0.01;
    if (!this.g.visible) { this.meteor.visible = this.mHead.visible = false; return; }
    this.showConst += ((this.wantConst ? 1 : 0) - this.showConst) * (1 - Math.exp(-1.5 * dt));
    this.layers.forEach((L, i) => {
      L.mat.opacity = vis * (0.75 + i * 0.1);
      // 반짝임: 몇 개씩 밝기를 바꿈
      for (let k = 0; k < 24; k++) {
        const j = Math.floor(Math.random() * L.n);
        const f = 0.45 + Math.random() * 0.75;
        L.col[j * 3] = L.tints[j * 3] * f; L.col[j * 3 + 1] = L.tints[j * 3 + 1] * f; L.col[j * 3 + 2] = L.tints[j * 3 + 2] * f;
      }
      L.pts.geometry.attributes.color.needsUpdate = true;
    });
    this.milky.material.opacity = vis * 0.8;
    for (const h of this.haze) h.material.opacity = vis * 0.07;
    this.moon.material.opacity = vis;
    this.moonGlow.material.opacity = vis * 0.35;
    this.cstars.material.opacity = vis * (0.55 + this.showConst * 0.45);
    this.lines.material.opacity = vis * this.showConst * 0.45;
    for (const l of this.labels) { l.material.opacity = vis * this.showConst * 0.9; l.visible = this.showConst > 0.02; }
    // 별똥별
    const m = this.meteorAt(Date.now() / 1000);
    if (m) {
      const head = new THREE.Vector3().lerpVectors(m.a, m.b, m.u).normalize().multiplyScalar(R * 0.9);
      const tail = new THREE.Vector3().lerpVectors(m.a, m.b, Math.max(0, m.u - 0.4)).normalize().multiplyScalar(R * 0.9);
      const pa = this.meteor.geometry.attributes.position;
      pa.setXYZ(0, head.x, head.y, head.z); pa.setXYZ(1, tail.x, tail.y, tail.z); pa.needsUpdate = true;
      const fade = Math.sin(Math.min(1, m.u) * Math.PI);
      this.meteor.material.opacity = vis * fade;
      this.mHead.position.copy(head); this.mHead.material.opacity = vis * fade;
      this.meteor.visible = this.mHead.visible = true;
      if (m.id !== this.seenMeteor) { this.seenMeteor = m.id; if (vis > 0.5) this.onMeteor?.(); }
    } else this.meteor.visible = this.mHead.visible = false;
  }
}

// 앉을 자리 · 가구 (실내와 정원에서 같이 씀)
import * as THREE from 'three';
import { M, rbox, mesh, plank, footprint, glowSprite } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 앉을 자리 하나: pos = 엉덩이 자리, rotY = 앉아서 바라보는 쪽, fy = 그 층 바닥 높이
export function addSeat(room, x, y, z, rotY, o = {}) {
  const fy = o.fy || 0;
  const f = V(Math.sin(rotY), 0, Math.cos(rotY));
  const off = o.appr ?? 0.58;
  const s = {
    pos: V(x, y, z), rotY, fy, lv: o.lv || 0, kind: o.kind || 'chair', nook: !!o.nook,
    name: o.name || '', taken: null, cinema: !!o.cinema,
    desk: o.desk || null,   // 책상 있는 자리: { h: 책상 윗면 높이, d: 자리에서 책상(공책 놓을 곳)까지 } → 필사하기
    appr: V(x + f.x * off, fy, z + f.z * off),
  };
  room.seats.push(s);
  return s;
}

function place(scene, g, x, z, rotY, fy) {
  g.position.set(x, fy || 0, z);
  g.rotation.y = rotY;
  scene.add(g);
  return g;
}
const obst = (room, r, lv) => { if (lv) r.lv = lv; room.obstacles.push(r); return r; };

// 푹신한 1인 의자
export function armchair(scene, room, x, z, rotY, color = '#a7865f', o = {}) {
  const g = new THREE.Group();
  const fab = M.fabric(color);
  const fab2 = M.fabric(new THREE.Color(color).offsetHSL(0, 0, -0.06).getStyle());
  plank(g, 0.78, 0.28, 0.74, 0, 0.24, 0, fab2, 0.08);
  g.add(mesh(rbox(0.56, 0.12, 0.56, 0.05, 3), fab, 0, 0.43, 0.06));
  const back = mesh(rbox(0.76, 0.62, 0.2, 0.08, 3), fab2, 0, 0.7, -0.28);
  back.rotation.x = -0.12;
  g.add(back);
  for (const s of [-1, 1]) plank(g, 0.14, 0.4, 0.72, s * 0.36, 0.48, 0, fab2, 0.06);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.1, 8), M.woodDark(), sx * 0.32, 0.05, sz * 0.3));
  if (o.blanket) {
    const b = mesh(rbox(0.5, 0.04, 0.6, 0.02), M.fabric(o.blanket), 0.2, 0.62, -0.05);
    b.rotation.z = 0.5;
    g.add(b);
  }
  place(scene, g, x, z, rotY, o.fy);
  obst(room, footprint(x, z, 0.8, 0.76, rotY), o.lv);
  return addSeat(room, x, (o.fy || 0) + 0.5, z, rotY, { ...o, appr: 0.62 });
}

// 바닥 방석
export function cushion(scene, room, x, z, rotY, color = '#c98f6b', o = {}) {
  const g = new THREE.Group();
  g.add(mesh(rbox(0.52, 0.1, 0.52, 0.05, 3), M.fabric(color), 0, 0.05, 0));
  g.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), M.fabric(color), 0, 0.105, 0));
  place(scene, g, x, z, rotY, o.fy);
  return addSeat(room, x, (o.fy || 0) + 0.12, z, rotY, { ...o, kind: 'floor', appr: o.appr ?? 0.45 });
}

// 빈백
export function beanbag(scene, room, x, z, rotY, color = '#9db38e', o = {}) {
  const g = new THREE.Group();
  const b = mesh(new THREE.SphereGeometry(0.42, 18, 12), M.fabric(color), 0, 0.26, 0);
  b.scale.set(1, 0.62, 1);
  g.add(b);
  const back = mesh(new THREE.SphereGeometry(0.3, 14, 10), M.fabric(color), 0, 0.45, -0.22);
  back.scale.set(1.2, 0.9, 0.7);
  g.add(back);
  place(scene, g, x, z, rotY, o.fy);
  obst(room, footprint(x, z, 0.62, 0.62, rotY), o.lv);
  return addSeat(room, x, (o.fy || 0) + 0.34, z + 0, rotY, { ...o, appr: 0.6 });
}

// 둥근 걸상 (높이 h)
export function stool(scene, room, x, z, rotY, h = 0.46, color = '#c98f6b', o = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.05, 18), M.wood(), 0, h - 0.04, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.05, 18), M.fabric(color), 0, h + 0.005, 0));
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const leg = mesh(new THREE.CylinderGeometry(0.02, 0.025, h, 8), M.woodMid(), Math.cos(a) * 0.12, h / 2 - 0.03, Math.sin(a) * 0.12);
    leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
    g.add(leg);
  }
  place(scene, g, x, z, rotY, o.fy);
  obst(room, footprint(x, z, 0.32, 0.32, 0), o.lv);
  return addSeat(room, x, (o.fy || 0) + h + 0.05, z, rotY, { ...o, kind: 'stool', appr: o.appr ?? 0.45 });
}

// 긴 의자 (n 자리, back: 등받이)
export function bench(scene, room, x, z, rotY, L = 1.5, n = 2, o = {}) {
  const g = new THREE.Group();
  const wm = o.mat || M.woodMid();
  plank(g, L, 0.06, 0.44, 0, 0.43, 0, wm, 0.02);
  for (const s of [-1, 1]) plank(g, 0.06, 0.42, 0.38, s * (L / 2 - 0.12), 0.2, 0, M.woodDark(), 0.015);
  if (o.back !== false) {
    plank(g, L, 0.08, 0.04, 0, 0.82, -0.2, wm, 0.015);
    plank(g, L, 0.08, 0.04, 0, 0.66, -0.2, wm, 0.015);
    for (const s of [-1, 1]) plank(g, 0.05, 0.42, 0.05, s * (L / 2 - 0.12), 0.65, -0.2, M.woodDark(), 0.012);
  }
  if (o.cushion) g.add(mesh(rbox(L - 0.1, 0.06, 0.38, 0.03, 3), M.fabric(o.cushion), 0, 0.49, 0.01));
  place(scene, g, x, z, rotY, o.fy);
  obst(room, footprint(x, z, L, 0.46, rotY), o.lv);
  const seats = [];
  const ax = new THREE.Vector3(Math.cos(rotY), 0, -Math.sin(rotY));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (L - 0.5);
    seats.push(addSeat(room, x + ax.x * t, (o.fy || 0) + 0.5, z + ax.z * t, rotY, { ...o, appr: 0.55 }));
  }
  return seats;
}

// 스탠드 조명 (light: 진짜 빛을 켤지 — 폰 부담 때문에 몇 개만)
export function floorLamp(scene, room, x, z, o = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.04, 18), M.woodDark(), 0, 0.02, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.4, 8), M.color('#3e3029', 0.5, { metalness: 0.3 }), 0, 0.72, 0));
  const shadeMat = new THREE.MeshStandardMaterial({ color: o.shade || '#f3dcb6', roughness: 0.9, emissive: '#ffbf66', emissiveIntensity: 0, side: THREE.DoubleSide });
  g.add(mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.3, 20, 1, true), shadeMat, 0, 1.5, 0, { cast: false }));
  const glow = glowSprite('#ffc979', 1.4);
  glow.position.y = 1.45;
  g.add(glow);
  let light = null;
  if (o.light) {
    light = new THREE.PointLight('#ffb766', 0, 6, 1.6);
    light.position.set(0, 1.4, 0);
    g.add(light);
  }
  place(scene, g, x, z, 0, o.fy);
  obst(room, footprint(x, z, 0.36, 0.36, 0), o.lv);
  room.nightParts.push((dt, t, n) => {
    shadeMat.emissiveIntensity = 0.15 + n * 0.85;
    glow.material.opacity = 0.12 + n * 0.55;
    if (light) light.intensity = 0.4 + n * 7;
  });
  return g;
}

// 작은 탁상 등 (책상 위)
export function deskLamp(parent, room, x, y, z) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 14), M.color('#4b5a3a', 0.5), 0, 0.01, 0));
  const arm = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6), M.color('#4b5a3a', 0.5), 0, 0.15, 0);
  g.add(arm);
  const sm = new THREE.MeshStandardMaterial({ color: '#4b5a3a', emissive: '#ffcc77', emissiveIntensity: 0 });
  const sh = mesh(new THREE.ConeGeometry(0.09, 0.1, 14, 1, true), sm, 0.03, 0.3, 0, { cast: false });
  sh.rotation.z = -0.5;
  g.add(sh);
  const glow = glowSprite('#ffd38a', 0.8);
  glow.position.set(0.05, 0.25, 0);
  g.add(glow);
  g.position.set(x, y, z);
  parent.add(g);
  room.nightParts.push((dt, t, n) => { sm.emissiveIntensity = 0.2 + n; glow.material.opacity = 0.1 + n * 0.6; });
}

// 러그
export function rug(scene, x, z, w, d, colors = ['#c98f6b', '#e9d6b9'], o = {}) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * d / w);
  const g = c.getContext('2d');
  g.fillStyle = colors[0]; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = colors[1]; g.lineWidth = 8;
  for (let i = 1; i <= 3; i++) g.strokeRect(i * 12, i * 12, c.width - i * 24, c.height - i * 24);
  g.fillStyle = colors[1];
  for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(c.width / 2 + Math.cos(i) * c.width * 0.18, c.height / 2 + Math.sin(i * 1.7) * c.height * 0.18, 4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = mesh(new THREE.BoxGeometry(w, 0.012, d), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }), x, (o.fy || 0) + 0.006, z, { cast: false });
  m.rotation.y = o.rotY || 0;
  scene.add(m);
  return m;
}

// 낮은 탁자 (찻상 · 책상)
export function lowTable(scene, room, x, z, rotY, w = 0.9, d = 0.55, h = 0.4, o = {}) {
  const g = new THREE.Group();
  plank(g, w, 0.05, d, 0, h - 0.025, 0, M.wood(), 0.02);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) plank(g, 0.05, h - 0.05, 0.05, sx * (w / 2 - 0.06), (h - 0.05) / 2, sz * (d / 2 - 0.06), M.woodMid(), 0.012);
  if (o.cup) {
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.08, 12), M.color('#f6efe4', 0.35), w * 0.2, h + 0.04, 0));
  }
  if (o.book) {
    const b = mesh(rbox(0.2, 0.035, 0.28, 0.008), M.color(o.book), -w * 0.18, h + 0.02, 0);
    b.rotation.y = 0.35;
    g.add(b);
  }
  place(scene, g, x, z, rotY, o.fy);
  obst(room, footprint(x, z, w, d, rotY), o.lv);
  return g;
}

// 의자 (등받이 나무 의자)
export function chair(scene, room, x, z, rotY, color = '#c98f6b', o = {}) {
  const g = new THREE.Group();
  plank(g, 0.42, 0.05, 0.42, 0, 0.44, 0, M.wood(), 0.02);
  g.add(mesh(rbox(0.38, 0.04, 0.38, 0.02, 3), M.fabric(color), 0, 0.48, 0));
  plank(g, 0.4, 0.42, 0.04, 0, 0.68, -0.19, M.woodMid(), 0.015);
  for (const lx of [-0.17, 0.17]) for (const lz of [-0.17, 0.17]) plank(g, 0.035, 0.42, 0.035, lx, 0.21, lz, M.woodMid(), 0.01);
  place(scene, g, x, z, rotY, o.fy);
  obst(room, footprint(x, z, 0.44, 0.44, rotY), o.lv);
  return addSeat(room, x, (o.fy || 0) + 0.5, z, rotY, { ...o, appr: o.appr ?? 0.5 });
}

export { V };

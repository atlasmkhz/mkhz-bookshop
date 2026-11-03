// 오두막 밖: 집 둘레 마당, 캠핑장, 해먹 숲, 폭포가 있는 계곡, 숲속 영화관, 들꽃 언덕, 정자, 나무 위 오두막, 남쪽 바닷가
// 오솔길이 갈래로 나뉘고 끝마다 숨은 자리. 낮엔 햇살 · 나비 · 새, 밤엔 등불 · 반딧불 · 풀벌레 · 모닥불
import * as THREE from 'three';
import { M, rbox, mesh, plank, mulberry, footprint, glowSprite, stoneTexture, textSprite } from './kit.js';
import { CABIN, WORLD, SEA_Z, PLATFORMS } from './nav.js';
import { armchair, cushion, beanbag, stool, bench, addSeat, lowTable } from './furniture.js';
import { campChair, hammock, firebowl, woodpile, readingTent } from './cabin.js';
import { buildCinema } from './cinema.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const TREEHOUSE = PLATFORMS[1];

// 오솔길 (갈래)
const PATHS = [
  [[8.3, 0], [11, 0.2], [14, 0]],                                         // 정원 문 → 갈림길
  [[14, 0], [15, -4], [17, -8], [18.5, -11.5]],                            // → 캠핑장
  [[17, -8], [13.5, -10.5], [11, -14.5]],                                  // 캠핑장 → 해먹 숲
  [[18.5, -11.5], [22, -15], [26, -18.5], [28.5, -20]],                     // 캠핑장 → 계곡 · 폭포
  [[14, 0], [19, -1], [24, -2], [27.2, -2.8]],                              // → 다리(북)
  [[31.2, -2.8], [35, -4.5], [39, -5.5]],                                  // 다리 → 정자
  [[35, -4.5], [39.5, -9], [43.5, -10.8]],                                 // → 나무 위 오두막
  [[14, 0], [15.5, 4.5], [17.5, 8.5], [19.5, 11.5]],                        // → 영화관 입구
  [[19.5, 11.5], [24, 10.5], [27.2, 9.8]],                                 // 영화관 → 다리(가운데)
  [[31.2, 9.8], [36, 8], [40.5, 7]],                                       // 다리 → 들꽃 언덕
  [[14, 0], [13, 5], [12, 10], [11.5, 15], [12, 20], [12.5, 24.5]],          // → 바닷가
  [[26, 16], [25, 20], [24.5, 24.5]],                                      // 영화관 뒤 → 바닷가
  [[2, 25.5], [8, 25.2], [12.5, 24.5], [18, 25.2], [24.5, 24.5], [30, 25.3], [36, 25.5], [40, 26.0], [46, 26.2]], // 바닷길
  [[-1.75, 10.3], [-1.75, 12.2], [3, 13], [8.5, 11.5], [11, 6], [11, 0.2]],  // 현관 → 동쪽으로 돌아 정원 문 앞
  [[-1.75, 12.2], [-8, 13], [-14, 12.5], [-19, 9], [-19.5, 0], [-18.5, -8], [-16, -12.5], [-9, -13.5], [-2, -13.5], [5, -13], [9.5, -10], [11, -5], [11, 0.2]], // 집 둘레 한 바퀴
  [[-14, 12.5], [-12, 16], [-6, 19], [-1, 22], [2, 25.5]],                   // 서쪽 마당 → 바닷가
  [[12, 20], [16, 19.5]],                                                    // → 큰 나무 그네
  [[22, -15], [19, -18], [15, -20]],                                         // 계곡 → 숲 안쪽 숨은 자리
];
// 시내 (계곡): 북쪽 폭포에서 남쪽 바다로
export const streamX = (z) => 30 + Math.sin(z * 0.22) * 1.4 + Math.sin(z * 0.5) * 0.4;
const streamW = (z) => (z < -8 ? 0.7 + Math.sin(z * 0.9) * 0.1 : 0.95 + Math.sin(z * 0.8) * 0.12);
const BRIDGES = [[-3.6, -2.0], [9.0, 10.6], [19.8, 21.4]];
const STEPPING = [-12.3, -11.9];

function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
function distPaths(x, z) {
  let d = Infinity;
  for (const P of PATHS) for (let i = 0; i < P.length - 1; i++) d = Math.min(d, distSeg(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]));
  return d;
}

function grassTexture(base = '#9dbb74', seed = 21) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  const r = mulberry(seed);
  for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? 'rgba(110,150,70,0.25)' : 'rgba(190,210,130,0.2)'; g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 60, 12 + r() * 30, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 9000; i++) { const x = r() * 512, y = r() * 512; g.strokeStyle = r() < 0.5 ? 'rgba(70,110,45,0.35)' : 'rgba(200,225,150,0.3)'; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function sandTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8dbb3'; g.fillRect(0, 0, 256, 256);
  const r = mulberry(9);
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(170,140,90,0.25)' : 'rgba(255,250,230,0.35)'; const s = 1 + r() * 2; g.fillRect(r() * 256, r() * 256, s, s); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function dirtTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c9ab7f'; g.fillRect(0, 0, 256, 256);
  const r = mulberry(5);
  for (let i = 0; i < 1800; i++) { g.fillStyle = r() < 0.5 ? 'rgba(120,90,55,0.25)' : 'rgba(240,225,195,0.3)'; const s = 1 + r() * 3; g.fillRect(r() * 256, r() * 256, s, s); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function waterTexture(r) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7fb3c4'; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.25})`; g.fillRect(r() * 64, r() * 256, 2 + r() * 10, 1.5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildForest(scene, room, program) {
  const r = mulberry(77);
  const obst = (x0, x1, z0, z1, lv) => { const o = { minX: x0, maxX: x1, minZ: z0, maxZ: z1 }; if (lv) o.lv = lv; room.obstacles.push(o); return o; };
  const anim = [];
  const excl = []; // [x, z, 반지름] 나무를 심지 않을 곳
  const rockMat = new THREE.MeshStandardMaterial({ map: stoneTexture('#a59a8c', 23), roughness: 1 });

  // ---------- 땅 (잔디 · 모래 · 바다) ----------
  const G0 = { minX: -34, maxX: 66, minZ: -36, maxZ: 23.5 };
  {
    const gw = G0.maxX - G0.minX, gd = G0.maxZ - G0.minZ;
    const grassMat = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 });
    grassMat.map.repeat.set(gw / 6, gd / 6);
    const ground = mesh(new THREE.BoxGeometry(gw, 0.1, gd), grassMat, (G0.minX + G0.maxX) / 2, -0.07, (G0.minZ + G0.maxZ) / 2, { cast: false });
    scene.add(ground);
    // 모래 띠 (잔디와 살짝 겹치게)
    const sandMat = new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 });
    sandMat.map.repeat.set(gw / 4, 2.2);
    const sand = mesh(new THREE.BoxGeometry(gw, 0.1, SEA_Z + 0.6 - 22.5), sandMat, (G0.minX + G0.maxX) / 2, -0.06, (22.5 + SEA_Z + 0.6) / 2, { cast: false });
    scene.add(sand);
    // 잔디 → 모래 경계를 부드럽게 (풀 언덕 띠)
    for (let x = G0.minX; x < G0.maxX; x += 1.8) {
      const d = mesh(new THREE.SphereGeometry(1.4 + r() * 0.5, 10, 6), grassMat, x + r(), -0.9, 22.6 + r() * 0.8, { cast: false });
      d.scale.y = 0.75;
      d.userData.noHit = true;
      scene.add(d);
    }
    // 디오라마 받침
    scene.add(mesh(rbox(gw + 0.8, 0.8, 42 + 0.8, 0.15, 3), M.woodDark(), (G0.minX + G0.maxX) / 2, -0.52, (G0.minZ + 42) / 2 - 18, { cast: false }));
  }
  // 바다
  const seaMat = new THREE.MeshStandardMaterial({ color: '#5fa3b8', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 });
  {
    const seaGeo = new THREE.PlaneGeometry(100, 24, 80, 20);
    seaGeo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.position.set(16, -0.02, SEA_Z + 12);
    sea.receiveShadow = true;
    scene.add(sea);
    const pos = seaGeo.attributes.position;
    const base = Float32Array.from(pos.array);
    anim.push((dt, t) => {
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], z = base[i * 3 + 2];
        pos.setY(i, Math.sin(x * 0.35 + t * 1.3) * 0.06 + Math.sin(z * 0.6 - t * 1.7) * 0.05);
      }
      pos.needsUpdate = true;
    });
    // 물가 거품 띠 (셋이 번갈아 밀려옴)
    const foams = [];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(100, 0.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f6fbfc', transparent: true, opacity: 0, depthWrite: false }));
      f.position.set(16, 0.01, SEA_Z);
      f.userData.noHit = true;
      scene.add(f);
      foams.push(f);
    }
    anim.push((dt, t) => {
      foams.forEach((f, i) => {
        const k = ((t * 0.18 + i / 3) % 1);
        f.position.z = SEA_Z + 2.2 - k * 2.6;
        f.material.opacity = Math.sin(k * Math.PI) * 0.55;
        f.scale.y = 0.8 + k * 1.4;
      });
    });
    // 바다 = 못 들어감
    obst(WORLD.minX - 2, WORLD.maxX + 2, SEA_Z, WORLD.maxZ + 5);
    room.seaZ = SEA_Z;
  }

  // ---------- 오솔길 ----------
  {
    const mat = new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 1, transparent: true, opacity: 0.95 });
    for (const P of PATHS) {
      const curve = new THREE.CatmullRomCurve3(P.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
      const len = curve.getLength();
      const n = Math.max(4, Math.ceil(len / 0.4));
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = curve.getPoint(t), tan = curve.getTangent(t);
        const nx = -tan.z, nz = tan.x;
        const w = 0.6 + Math.sin(i * 0.7) * 0.06;
        pos.push(p.x + nx * w, 0.012, p.z + nz * w, p.x - nx * w, 0.012, p.z - nz * w);
        uv.push(0, t * len / 2, 1, t * len / 2);
        if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      scene.add(m);
    }
  }

  // ---------- 이정표 ----------
  const signpost = (x, z, arrows) => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.0, 8), M.woodDark(), 0, 1.0, 0));
    arrows.forEach(([text, ang], i) => {
      const c = document.createElement('canvas'); c.width = 384; c.height = 80;
      const draw = () => { const p = c.getContext('2d'); p.clearRect(0, 0, 384, 80); p.fillStyle = '#e6d2a8'; p.beginPath(); p.moveTo(0, 8); p.lineTo(340, 8); p.lineTo(384, 40); p.lineTo(340, 72); p.lineTo(0, 72); p.closePath(); p.fill(); p.fillStyle = '#4a3426'; p.font = '700 36px "Gowun Batang", serif'; p.textBaseline = 'middle'; p.fillText(text, 18, 42); };
      draw();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.2), new THREE.MeshStandardMaterial({ map: t, transparent: true, side: THREE.DoubleSide, roughness: 0.9 }));
      b.position.set(Math.cos(ang) * 0.45, 1.85 - i * 0.26, -Math.sin(ang) * 0.45);
      b.rotation.y = ang;
      b.userData.noHit = true;
      g.add(b);
    });
    g.position.set(x, 0, z);
    scene.add(g);
    obst(x - 0.1, x + 0.1, z - 0.1, z + 0.1);
  };
  signpost(14.6, 0.9, [['캠핑장 · 해먹 숲', Math.PI / 2 - 0.3], ['계곡 · 폭포', Math.PI / 2 - 0.9], ['영화관', -0.4], ['바닷가', -Math.PI / 2 + 0.2], ['정자 · 들꽃 언덕', 0.1]]);
  signpost(20.3, 12.4, [['숲속 영화관', 0.2], ['바닷가', -Math.PI / 2 + 0.3], ['들꽃 언덕 · 다리', 0.0]]);
  signpost(13.2, 24.0, [['바닷가', -Math.PI / 2], ['서점으로', Math.PI / 2 + 0.2], ['모닥불 · 선착장', -0.2]]);
  signpost(-2.6, 12.6, [['루프탑 계단', Math.PI + 0.3], ['집 둘레 한 바퀴', Math.PI - 0.5], ['바닷가', -Math.PI / 2]]);
  signpost(19.2, -12.3, [['폭포', 0.4], ['해먹 숲', Math.PI - 0.2], ['숲 안쪽 숨은 자리', Math.PI / 2 + 0.4]]);

  // ---------- 데크 (정원 문 앞) · 새 모이대 ----------
  {
    const deck = new THREE.Group();
    for (let x = CABIN.maxX + 0.3; x < 11.0; x += 0.3) deck.add(mesh(rbox(0.28, 0.06, 5.6, 0.01), r() < 0.5 ? M.wood() : M.woodLight(), x, 0.03, 0, { cast: false }));
    scene.add(deck);
    armchair(scene, room, 10.2, -1.9, face(10.2, -1.9, 14, -3), '#c7a06b', { name: '데크 흔들의자' });
    armchair(scene, room, 10.2, 1.9, face(10.2, 1.9, 14, 3), '#a9bba0', { name: '데크 흔들의자' });
    bench(scene, room, 8.75, -2.2, Math.PI / 2, 1.3, 2, { cushion: '#d9a07a', name: '처마 밑 벤치' });
    room.gardenSpots.push(V(9.6, 0.05, 2.4), V(10.8, 0.05, -0.4));
    excl.push([9.8, 0, 3.6]);
  }
  const birds = [];
  {
    const x = 12.2, z = -3.2;
    scene.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.3, 8), M.woodMid(), x, 0.65, z));
    scene.add(mesh(rbox(0.5, 0.04, 0.5, 0.02), M.wood(), x, 1.32, z));
    const roof = mesh(new THREE.ConeGeometry(0.42, 0.25, 4), M.color('#c27c5c', 0.9), x, 1.62, z); roof.rotation.y = Math.PI / 4; scene.add(roof);
    obst(x - 0.15, x + 0.15, z - 0.15, z + 0.15);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group();
      const bc = ['#7d6a5a', '#c99a63', '#8aa0b8'][i];
      b.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), M.color(bc, 0.8), 0, 0, 0));
      b.add(mesh(new THREE.SphereGeometry(0.032, 8, 6), M.color(bc, 0.8), 0, 0.04, 0.035));
      const beak = mesh(new THREE.ConeGeometry(0.01, 0.025, 5), M.color('#e8b04a'), 0, 0.04, 0.07); beak.rotation.x = Math.PI / 2; b.add(beak);
      scene.add(b);
      birds.push({ b, home: V(x - 0.15 + i * 0.15, 1.39, z + (i - 1) * 0.08), ph: r() * 6, away: 0 });
    }
    room.birdFeeder = V(x, 0, z);
    excl.push([x, z, 1.5]);
  }

  // ---------- 집 둘레 마당 ----------
  {
    // 장작더미 (서쪽)
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5 - i; j++) g.add(mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.6, 8).rotateX(Math.PI / 2), M.woodMid(), -0.5 + j * 0.25 + i * 0.12, 0.12 + i * 0.2, 0));
    g.position.set(-19.2, 0, 3.5);
    scene.add(g);
    obst(-20.0, -18.4, 3.1, 3.9);
    excl.push([-19.2, 3.5, 1.4]);
    // 허브 텃밭 (서쪽)
    for (const [x, z] of [[-19.6, -3.5], [-19.6, -5.3]]) {
      scene.add(mesh(rbox(2.2, 0.3, 1.2, 0.03), M.woodDark(), x, 0.15, z));
      for (let i = 0; i < 12; i++) scene.add(mesh(new THREE.SphereGeometry(0.14, 8, 6), M.color(['#7ead6f', '#a0c88d', '#6e9c62'][i % 3], 1), x - 0.9 + (i % 6) * 0.36, 0.4, z - 0.25 + Math.floor(i / 6) * 0.5));
      obst(x - 1.15, x + 1.15, z - 0.65, z + 0.65);
      excl.push([x, z, 1.8]);
    }
    stool(scene, room, -18.2, -4.4, Math.PI / 2, 0.42, '#b88a5a', { name: '텃밭 옆 그루터기' });
    // 뒷마당 (북쪽): 빨랫줄 · 벤치
    bench(scene, room, -6, -12.4, Math.PI, 1.6, 2, { cushion: '#e3c79a', name: '뒷마당 벤치', nook: true });
    for (const x of [-11.5, -8.5]) scene.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.8, 6), M.woodDark(), x, 0.9, -12.6));
    scene.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 3.0, 4).rotateZ(Math.PI / 2), M.color('#d9c7a5'), -10, 1.72, -12.6));
    for (let i = 0; i < 4; i++) { const c = mesh(rbox(0.4, 0.5, 0.02, 0.01), M.fabric(['#f2a7a0', '#9cc3e6', '#e8c86a', '#ffffff'][i]), -11.1 + i * 0.7, 1.46, -12.6); c.rotation.z = 0.05; scene.add(c); anim.push((dt, t) => { c.rotation.x = Math.sin(t * 1.2 + i) * 0.12; }); }
    obst(-11.6, -8.4, -12.75, -12.45);
    excl.push([-10, -12.6, 2.2], [-6, -12.4, 1.8]);
    // 현관 앞 등불 · 우편함
    scene.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 8), M.woodDark(), -3.5, 0.6, 11.6));
    scene.add(mesh(rbox(0.22, 0.3, 0.2, 0.03), M.color('#b65d4c', 0.7), -3.5, 1.35, 11.6));
    obst(-3.65, -3.35, 11.45, 11.75);
    excl.push([-1.75, 12, 4.5], [-6, 13, 3], [-12, 13, 2.5]);
  }

  // ---------- 캠핑장 ----------
  const campTent = (x, z, rotY, color, name) => {
    const g = new THREE.Group();
    const fab = new THREE.MeshStandardMaterial({ map: M.fabric(color).map, roughness: 1, side: THREE.DoubleSide });
    const Lh = 2.2, Wd = 2.2, Hh = 1.5;
    // A자 천막 (양쪽 경사면 + 뒤판)
    for (const s of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(Lh, 0.03, Math.hypot(Wd / 2, Hh)), fab, 0, Hh / 2, s * Wd / 4); p.rotation.x = -s * Math.atan2(Hh, Wd / 2); g.add(p); }
    const backShape = new THREE.Shape(); backShape.moveTo(-Wd / 2, 0); backShape.lineTo(Wd / 2, 0); backShape.lineTo(0, Hh); backShape.closePath();
    const back = new THREE.Mesh(new THREE.ShapeGeometry(backShape), fab); back.rotation.y = Math.PI / 2; back.position.x = -Lh / 2; g.add(back);
    // 앞은 반쯤 열림
    const flap = new THREE.Mesh(new THREE.ShapeGeometry(backShape), fab); flap.rotation.y = Math.PI / 2; flap.position.x = Lh / 2; flap.scale.set(0.5, 1, 1); flap.position.z = Wd * 0.25; g.add(flap);
    for (const sx of [-Lh / 2, Lh / 2]) g.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, Hh, 6), M.woodDark(), sx, Hh / 2, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, Lh, 6).rotateZ(Math.PI / 2), M.woodDark(), 0, Hh, 0));
    g.add(mesh(rbox(Lh - 0.2, 0.08, Wd - 0.3, 0.04, 3), M.fabric('#efe0c7'), 0, 0.04, 0));
    g.add(mesh(rbox(0.6, 0.12, 0.4, 0.05, 3), M.fabric('#d9a07a'), -0.6, 0.12, 0.3));
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    obst(...Object.values(footprint(x, z, Lh, Wd, rotY)).slice(0, 4));
    const f = V(Math.cos(rotY), 0, -Math.sin(rotY));
    const s = addSeat(room, x - f.x * 0.2, 0.12, z - f.z * 0.2, rotY + Math.PI / 2, { name, kind: 'floor', nook: true });
    s.appr.set(x + f.x * 1.5, 0, z + f.z * 1.5);
    room.boxes.push({ floor: V(x + f.x * 1.5, 0, z + f.z * 1.5), inside: V(x - f.x * 0.3, 0.04, z - f.z * 0.3), rotY: rotY + Math.PI / 2, key: `tent:${name}`, outdoor: true });
    excl.push([x, z, 2.2]);
  };
  {
    const cxc = 18.5, czc = -7.5;
    firebowl(scene, room, cxc, czc, 0, { range: 9, power: 8, id: 'camp', name: '캠핑장 모닥불' });
    woodpile(scene, room, cxc + 0.2, czc + 2.55, 0, 0, 'camp');
    room.campfire = V(cxc, 0, czc);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; const sx = cxc + Math.cos(a) * 1.7, sz = czc + Math.sin(a) * 1.7; campChair(scene, room, sx, sz, face(sx, sz, cxc, czc), ['#d97c5c', '#5f6b4e', '#7f97a8', '#e8c86a'][k], { name: '캠핑 의자' }); }
    for (const a of [0, Math.PI]) { const lx = cxc + Math.cos(a) * 2.4, lz = czc + Math.sin(a) * 2.4; const rot = face(lx, lz, cxc, czc); const lg = mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.4, 10).rotateZ(Math.PI / 2), M.color('#8b6a4a', 1), lx, 0.2, lz); lg.rotation.y = rot; scene.add(lg); obst(...Object.values(footprint(lx, lz, 1.4, 0.44, rot)).slice(0, 4)); for (const s of [-0.35, 0.35]) addSeat(room, lx + Math.cos(rot) * s, 0.44, lz - Math.sin(rot) * s, rot, { name: '모닥불 통나무', appr: -0.55 }); }
    campTent(21.5, -10.5, -0.6, '#d97c5c', '주황 텐트');
    campTent(15.0, -11.5, 0.9, '#5f6b4e', '초록 텐트');
    campTent(22.8, -4.6, 2.2, '#7f97a8', '파랑 텐트');
    // 빈백 러그 · 피크닉 테이블 · 아이스박스 · 등불 기둥 · 전구 줄
    for (const [x, z, c] of [[14.6, -6.0, '#e8c86a'], [14.2, -7.6, '#c98f6b'], [15.9, -7.4, '#a9bba0']]) beanbag(scene, room, x, z, face(x, z, cxc, czc), c, { name: '캠핑장 빈백' });
    {
      const t = lowTable(scene, room, 21.8, -6.6, 0.3, 1.6, 0.8, 0.74, { cup: true });
      t.add(mesh(rbox(0.3, 0.22, 0.2, 0.04), M.color('#e9e2d6', 0.4), -0.5, 0.74 + 0.11, 0.1));
      const rr = 0.3;
      for (const s of [-1, 1]) bench(scene, room, 21.8 + Math.sin(rr) * 0.7 * s, -6.6 + Math.cos(rr) * 0.7 * s, rr + (s > 0 ? Math.PI : 0), 1.5, 2, { back: false, name: '피크닉 테이블', appr: 0.5 });
    }
    scene.add(mesh(rbox(0.6, 0.4, 0.4, 0.05), M.color('#7f97a8', 0.5), 17.0, 0.2, -4.8));
    obst(16.7, 17.3, -5.0, -4.6);
    for (const [x, z] of [[13.5, -9.0], [23.5, -8.5]]) { scene.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 8), M.woodDark(), x, 1.3, z)); obst(x - 0.08, x + 0.08, z - 0.08, z + 0.08); }
    const bulbs = [];
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(V(13.5 + 10 * t, 2.55 - Math.sin(t * Math.PI) * 0.4, -9.0 + 0.5 * t)); if (i > 0 && i < 16) { const m = new THREE.MeshStandardMaterial({ color: '#ffe3a0', emissive: '#ffcf7a', emissiveIntensity: 0.1 }); scene.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), m, pts[i].x, pts[i].y - 0.06, pts[i].z, { cast: false })); bulbs.push(m); } }
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.006, 4), M.color('#5a4636')));
    room.nightParts.push((dt, t, n) => bulbs.forEach((m, i) => { m.emissiveIntensity = 0.1 + n * (1.5 + Math.sin(t * 1.3 + i) * 0.3); }));
    room.gardenSpots.push(V(17.0, 0, -9.5), V(20.5, 0, -8.6));
    excl.push([cxc, czc, 4.5], [15, -6.8, 2.5], [21.8, -6.6, 2.4]);
  }

  // ---------- 해먹 숲 ----------
  const trees = []; // [x, z, kind, scale, outside]
  {
    const cxh = 11.0, czh = -16.0;
    const ham = (x, z, rotY, col) => {
      for (const s of [-1, 1]) trees.push([x + Math.cos(rotY) * s * 1.2, z - Math.sin(rotY) * s * 1.2, 'broad', 0.85]);
      hammock(scene, room, x, z, rotY, col, { name: '나무 그늘 해먹', nook: true });
    };
    ham(cxh - 1.4, czh + 0.5, 0.15, '#d97c5c');
    ham(cxh + 1.6, czh - 0.8, -0.25, '#e8c86a');
    ham(cxh + 0.3, czh + 2.6, Math.PI - 0.1, '#7f97a8');
    ham(cxh - 2.8, czh - 2.0, 0.7, '#a9bba0');
    stool(scene, room, cxh, czh, 0, 0.42, '#b88a5a', { name: '해먹 숲 그루터기' });
    excl.push([cxh, czh, 5.0]);
  }
  // 숲 안쪽 숨은 자리 (계곡 길 서쪽 끝)
  {
    readingTent(scene, room, 14.6, -20.6, 0.2, { name: '숲 안쪽 독서 천막', color: '#a9bba0', outdoor: true });
    cushion(scene, room, 16.4, -21.2, face(16.4, -21.2, 15, -19), '#d9a07a', { name: '숲 안쪽 방석', nook: true });
    excl.push([15, -20.5, 3.2]);
  }

  // ---------- 계곡 · 폭포 · 시내 · 다리 ----------
  {
    // 시내 물
    const pos = [], uv = [], idx = [];
    const zA = -21.5, zB = SEA_Z + 1;
    const n = 110;
    for (let i = 0; i <= n; i++) {
      const z = zA + (zB - zA) * i / n;
      const x = streamX(z), w = z < -17.5 ? 2.0 : streamW(z);
      pos.push(x - w, 0.02, z, x + w, 0.02, z);
      uv.push(0, i * 0.5, 1, i * 0.5);
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const wt = waterTexture(r);
    const water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: wt, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }));
    water.receiveShadow = true;
    scene.add(water);
    anim.push((dt) => { wt.offset.y -= dt * 0.3; });
    // 물 = 장애물 (다리 · 징검다리만 건넘)
    for (let z = -21.5; z < SEA_Z; z += 0.8) {
      const zm = z + 0.4;
      if (BRIDGES.some(([a, b]) => zm > a && zm < b) || (zm > STEPPING[0] - 0.3 && zm < STEPPING[1] + 0.3)) continue;
      const x = streamX(zm), w = z < -17.5 ? 2.0 : streamW(zm);
      obst(x - w - 0.1, x + w + 0.1, z, z + 0.8).water = true;
    }
    // 물가 자갈 · 계곡 바위
    for (let i = 0; i < 90; i++) {
      const z = -21 + r() * (SEA_Z - 1 + 21);
      const s = r() < 0.5 ? -1 : 1;
      const big = z < -6;
      const p = mesh(new THREE.DodecahedronGeometry(big ? 0.3 + r() * 0.5 : 0.1 + r() * 0.12, 0), rockMat, streamX(z) + s * (streamW(z) + (big ? 0.5 : 0.2) + r() * 0.4), big ? 0.15 : 0.04, z, { cast: big });
      p.scale.y = 0.55; p.rotation.y = r() * 3;
      scene.add(p);
      if (big) obst(p.position.x - 0.45, p.position.x + 0.45, z - 0.45, z + 0.45);
    }
    // 징검다리
    for (let k = 0; k < 5; k++) { const z = (STEPPING[0] + STEPPING[1]) / 2; const x = streamX(z) - 0.9 + k * 0.45; const st = mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.12, 9), rockMat, x, 0.04, z + (k % 2) * 0.12, { cast: false }); scene.add(st); }
    // 폭포: 바위 절벽 + 떨어지는 물 + 물보라
    {
      const fx = streamX(-21.5), fz = -22.2;
      const cliff = new THREE.Group();
      for (let i = 0; i < 14; i++) { const b = mesh(new THREE.DodecahedronGeometry(1.0 + r() * 0.9, 1), rockMat, (r() - 0.5) * 7, 0.6 + r() * 2.6, -0.4 - r() * 1.6); b.rotation.set(r(), r(), r()); cliff.add(b); }
      cliff.add(mesh(rbox(8, 3.6, 2.4, 0.3, 3), rockMat, 0, 1.8, -1.0));
      cliff.position.set(fx, 0, fz);
      scene.add(cliff);
      obst(fx - 4.2, fx + 4.2, fz - 2.4, fz + 0.4);
      const fallMat = new THREE.MeshStandardMaterial({ map: waterTexture(r), transparent: true, opacity: 0.8, roughness: 0.2, side: THREE.DoubleSide });
      fallMat.map.repeat.set(1, 2);
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4), fallMat);
      fall.position.set(fx, 1.75, fz + 0.45);
      fall.userData.noHit = true;
      scene.add(fall);
      anim.push((dt) => { fallMat.map.offset.y -= dt * 1.4; });
      const mist = glowSprite('#ffffff', 3.2); mist.position.set(fx, 0.5, fz + 0.9); scene.add(mist);
      anim.push((dt, t) => { mist.material.opacity = 0.28 + Math.sin(t * 3) * 0.05; mist.scale.setScalar(3.0 + Math.sin(t * 2) * 0.2); });
      // 물보라 입자
      const N = 70;
      const pg = new THREE.BufferGeometry();
      const pp = new Float32Array(N * 3);
      pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
      const pm = new THREE.PointsMaterial({ color: '#eef8ff', size: 0.09, transparent: true, opacity: 0.8, depthWrite: false });
      const pts = new THREE.Points(pg, pm);
      pts.frustumCulled = false;
      scene.add(pts);
      const seeds = Array.from({ length: N }, () => [r(), r() * 6, 0.4 + r() * 0.8]);
      anim.push((dt, t) => { for (let i = 0; i < N; i++) { const [a, ph, sp] = seeds[i]; const k = (t * sp + ph) % 1; pp[i * 3] = fx + (a - 0.5) * 2.2; pp[i * 3 + 1] = 3.4 - k * 3.4 + Math.sin(k * 6) * 0.05; pp[i * 3 + 2] = fz + 0.5 + k * 0.6; } pg.attributes.position.needsUpdate = true; });
      room.waterfall = V(fx, 0, fz + 1);
      excl.push([fx, fz, 6]);
      // 폭포 앞 바위 자리
      const sitRock = (x, z, rotY, name) => { const rk = mesh(new THREE.DodecahedronGeometry(0.45, 1), rockMat, x, 0.12, z); rk.scale.set(1.2, 0.62, 1.0); rk.rotation.y = r() * 3; scene.add(rk); obst(x - 0.38, x + 0.38, z - 0.34, z + 0.34); excl.push([x, z, 1.4]); return addSeat(room, x, 0.58, z, rotY, { name, nook: true, appr: -0.62 }); };
      sitRock(fx - 3.0, fz + 3.2, face(fx - 3, fz + 3.2, fx, fz), '폭포 앞 바위');
      sitRock(fx + 3.1, fz + 3.6, face(fx + 3.1, fz + 3.6, fx, fz), '폭포 앞 바위');
      sitRock(fx - 2.2, fz + 5.5, face(fx - 2.2, fz + 5.5, fx, fz), '계곡 바위');
      sitRock(fx + 2.4, fz + 7.5, face(fx + 2.4, fz + 7.5, fx, fz), '계곡 바위');
      sitRock(fx - 2.0, fz + 10.4, Math.PI / 2, '계곡 바위');
      // 계곡 물웅덩이 옆 돗자리
      const b = mesh(rbox(1.5, 0.02, 1.1, 0.02), M.fabric('#e8c86a'), fx - 3.6, 0.085, fz + 7.5, { cast: false }); scene.add(b);
      for (const s of [-0.35, 0.35]) addSeat(room, fx - 3.6, 0.12, fz + 7.5 + s, Math.PI / 2, { name: '계곡 돗자리', kind: 'floor', appr: 0.5 });
      excl.push([fx - 3.6, fz + 7.5, 1.6]);
    }
    // 다리
    for (const [a, b] of BRIDGES) {
      const zc = (a + b) / 2, xc = streamX(zc);
      const g2 = new THREE.Group();
      for (let i = 0; i < 11; i++) { const t2 = i / 10 - 0.5; g2.add(mesh(rbox(0.26, 0.07, b - a - 0.2, 0.015), M.woodMid(), t2 * 3.0, 0.12 + Math.cos(t2 * Math.PI) * 0.14, 0)); }
      for (const s of [-1, 1]) { g2.add(mesh(rbox(3.2, 0.06, 0.06, 0.02), M.woodDark(), 0, 0.85, s * (b - a - 0.2) / 2)); for (const px of [-1.5, 0, 1.5]) g2.add(mesh(rbox(0.06, 0.7, 0.06, 0.015), M.woodDark(), px, 0.5, s * (b - a - 0.2) / 2)); }
      g2.position.set(xc, 0, zc);
      scene.add(g2);
      obst(xc - 1.6, xc + 1.6, a - 0.05, a + 0.08);
      obst(xc - 1.6, xc + 1.6, b - 0.08, b + 0.05);
      excl.push([xc, zc, 2.4]);
    }
    // 시냇가 바위 (낮은 곳)
    const lowRock = (x, z, rotY, name) => { const rk = mesh(new THREE.DodecahedronGeometry(0.45, 1), rockMat, x, 0.12, z); rk.scale.set(1.2, 0.62, 1.0); rk.rotation.y = r() * 3; scene.add(rk); obst(x - 0.38, x + 0.38, z - 0.34, z + 0.34); excl.push([x, z, 1.4]); return addSeat(room, x, 0.58, z, rotY, { name, nook: true, appr: -0.62 }); };
    for (const z of [2.0, 3.4, 14.2, 15.6]) lowRock(streamX(z) - 1.7, z, Math.PI / 2, '시냇가 바위');
    for (const z of [5.0, 13.0]) lowRock(streamX(z) + 1.7, z, -Math.PI / 2, '건너편 물가 바위');
    room.stream = { x: streamX };
  }
  // 고양이 볕 쬐는 넓적 바위
  room.sunRocks = [];
  for (const [x, z] of [[25.0, -3.6], [36.2, 3.4], [10.8, 6.2], [20.5, 24.3]]) {
    const rk = mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.3, 9), rockMat, x, 0.15, z); rk.rotation.y = r() * 3; scene.add(rk);
    obst(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
    excl.push([x, z, 1.3]);
    room.sunRocks.push({ floor: V(x + 0.9, 0, z + 0.3), top: V(x, 0.31, z) });
  }

  // ---------- 덤불 ----------
  const bushes = [];
  const addBush = (x, z, s = 1, solid = true) => { bushes.push([x, z, s]); if (solid) obst(x - 0.42 * s, x + 0.42 * s, z - 0.42 * s, z + 0.42 * s); };
  const ring = (cx, cz, rad, gapAng, gapW = 0.9, step = 0.75, gaps = []) => {
    const n = Math.ceil(Math.PI * 2 * rad / step);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const near = (ga, gw) => Math.abs(((a - ga + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < gw;
      if (near(gapAng, gapW) || gaps.some(([ga, gw]) => near(ga, gw))) continue;
      addBush(cx + Math.cos(a) * rad + (r() - 0.5) * 0.2, cz + Math.sin(a) * rad + (r() - 0.5) * 0.2, 0.9 + r() * 0.5);
    }
    excl.push([cx, cz, rad + 0.8]);
  };
  const hiddenBench = (x, z, rotY, gapAng, name) => { bench(scene, room, x, z, rotY, 1.4, 2, { name, nook: true, mat: M.wood() }); ring(x, z, 1.9, gapAng, 0.75); };
  hiddenBench(11.5, 10.2, Math.PI, Math.PI / 2, '덤불 뒤 벤치');
  hiddenBench(24.2, -14.2, -Math.PI / 2, Math.PI, '자작나무 숲 벤치');
  hiddenBench(34.6, -1.2, Math.PI / 2, -Math.PI / 2, '물가 덤불 벤치');
  hiddenBench(6.8, 18.2, 0, -Math.PI / 2, '남쪽 숲 덤불 벤치');

  // ---------- 숲속 영화관 ----------
  {
    const cxv = 26, czv = 7.5;
    buildCinema(scene, room, program, cxv, czv);
    ring(cxv, czv + 5.5, 7.6, Math.PI, 0.55, 0.9, [[Math.PI / 2, 0.35]]);
    excl.push([cxv, czv + 5, 9]);
  }

  // ---------- 정자 (동쪽, 다리 건너) ----------
  {
    const cxg = 40.5, czg = -6.5, R = 2.1;
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(R + 0.2, R + 0.3, 0.12, 8), M.woodLight(), 0, 0.06, 0, { cast: false }));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; g.add(mesh(rbox(0.16, 2.5, 0.16, 0.03), M.woodDark(), Math.cos(a) * R, 1.25, Math.sin(a) * R)); obst(cxg + Math.cos(a) * R - 0.12, cxg + Math.cos(a) * R + 0.12, czg + Math.sin(a) * R - 0.12, czg + Math.sin(a) * R + 0.12); }
    const roofG = new THREE.Group();
    const rf = mesh(new THREE.ConeGeometry(R + 0.9, 1.4, 8, 1), M.color('#7a4b36', 0.9), 0, 3.2, 0); rf.rotation.y = Math.PI / 8; roofG.add(rf);
    roofG.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), M.woodDark(), 0, 3.95, 0));
    roofG.traverse((o) => { o.userData.noHit = true; });
    g.add(roofG);
    const lm = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffc766', emissiveIntensity: 0.1 });
    g.add(mesh(rbox(0.22, 0.28, 0.22, 0.05), lm, 0, 2.2, 0, { cast: false }));
    const light = new THREE.PointLight('#ffbb66', 0, 6, 1.7); light.position.set(0, 2.1, 0); g.add(light);
    const gl = glowSprite('#ffcf7a', 1.6); gl.position.set(0, 2.2, 0); g.add(gl);
    room.nightParts.push((dt, t, n) => { lm.emissiveIntensity = 0.1 + n * 1.6; light.intensity = n * 6; gl.material.opacity = n * 0.6; });
    g.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16), M.wood(), 0, 0.42, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8), M.woodMid(), 0, 0.2, 0));
    g.position.set(cxg, 0, czg);
    scene.add(g);
    obst(cxg - 0.45, cxg + 0.45, czg - 0.45, czg + 0.45);
    room.gazebo = { x: cxg, z: czg, r: R + 0.6, roof: roofG };
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      if (Math.abs(Math.cos(a) + 1) < 0.1) continue;
      const sx = cxg + Math.cos(a) * (R - 0.45), sz = czg + Math.sin(a) * (R - 0.45);
      const rot = face(sx, sz, cxg, czg);
      const bg = new THREE.Group();
      plank(bg, 0.9, 0.06, 0.42, 0, 0.45, 0, M.woodMid(), 0.02);
      for (const s of [-1, 1]) plank(bg, 0.06, 0.42, 0.36, s * 0.35, 0.22, 0, M.woodDark(), 0.015);
      bg.position.set(sx, 0.06, sz); bg.rotation.y = rot; scene.add(bg);
      obst(...Object.values(footprint(sx, sz, 0.8, 0.4, rot)).slice(0, 4));
      addSeat(room, sx, 0.56, sz, rot, { name: '작은 정자', appr: 0.55 });
    }
    excl.push([cxg, czg, R + 1.5]);
  }

  // ---------- 들꽃 언덕 (동쪽) ----------
  const flowers = [];
  {
    const cxf = 42.0, czf = 8.5;
    const hill = mesh(new THREE.SphereGeometry(4.6, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: grassTexture('#a9c47c', 33), roughness: 1 }), cxf, -0.02, czf, { cast: false });
    hill.scale.y = 0.018; hill.userData.noHit = true;
    scene.add(hill);
    const blanket = (x, z, rotY, col) => { const b = mesh(rbox(1.6, 0.02, 1.2, 0.02), M.fabric(col), x, 0.085, z, { cast: false }); b.rotation.y = rotY; scene.add(b); const ax = V(Math.cos(rotY), 0, -Math.sin(rotY)); for (const s of [-0.4, 0.4]) addSeat(room, x + ax.x * s, 0.1, z + ax.z * s, rotY + Math.PI, { name: '들꽃 언덕 돗자리', kind: 'floor', appr: 0.5 }); };
    blanket(cxf - 1.4, czf - 0.6, 0.2, '#d97c5c');
    blanket(cxf + 1.3, czf + 0.3, -0.4, '#e8c86a');
    blanket(cxf - 0.2, czf + 1.9, 0.9, '#7f97a8');
    beanbag(scene, room, cxf + 2.4, czf - 1.6, face(cxf + 2.4, czf - 1.6, cxf, czf), '#a9bba0', { name: '언덕 빈백' });
    stool(scene, room, cxf + 2.8, czf + 1.9, face(cxf + 2.8, czf + 1.9, cxf, czf), 0.4, '#b88a5a', { name: '언덕 그루터기' });
    excl.push([cxf, czf, 5.0]);
    for (let i = 0; i < 700; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 6.5; flowers.push([cxf + Math.cos(a) * d, czf + Math.sin(a) * d * 0.8]); }
    for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.15 + i / 9 * Math.PI * 1.1; addBush(cxf + Math.cos(a) * 5.4, czf + Math.sin(a) * 4.8, 1.0 + r() * 0.4); }
  }
  for (let i = 0; i < 700; i++) {
    const x = CABIN.minX - 5 + r() * (WORLD.maxX - CABIN.minX + 5), z = WORLD.minZ + r() * (22 - WORLD.minZ);
    const d = distPaths(x, z);
    if (d > 0.75 && d < 2.2) flowers.push([x, z]);
  }

  // ---------- 큰 나무 + 그네 (남쪽 길) ----------
  {
    const tx = 17.0, tz = 18.0;
    const t = new THREE.Group();
    const bark = M.color('#7d5f44', 1);
    t.add(mesh(new THREE.CylinderGeometry(0.32, 0.5, 3.2, 12), bark, 0, 1.6, 0));
    const br = mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.9, 8), bark, 0.85, 3.0, 0.25); br.rotation.z = -0.95; t.add(br);
    const canopy = new THREE.Group();
    for (let i = 0; i < 12; i++) { const a = r() * Math.PI * 2, rr = 0.3 + r() * 1.4; canopy.add(mesh(new THREE.IcosahedronGeometry(0.85 + r() * 0.5, 1), M.color(['#86ad6c', '#97bd78', '#7aa261', '#a6c98a'][i % 4], 1), Math.cos(a) * rr + 0.4, 3.6 + r() * 1.1, Math.sin(a) * rr * 0.8)); }
    canopy.traverse((o) => { o.userData.noHit = true; });
    t.add(canopy);
    t.position.set(tx, 0, tz);
    scene.add(t);
    room.bigCanopies = [{ g: canopy, x: tx + 0.4, z: tz, k: 1 }];
    obst(tx - 0.5, tx + 0.5, tz - 0.5, tz + 0.5);
    const sw = new THREE.Group();
    sw.position.set(tx + 1.45, 3.25, tz + 0.25);
    for (const s of [-1, 1]) sw.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.65, 6), M.color('#d9c7a5'), s * 0.32, -1.32, 0));
    sw.add(mesh(rbox(0.8, 0.05, 0.36, 0.02), M.wood(), 0, -2.65, 0));
    scene.add(sw);
    const seat = addSeat(room, tx + 1.45, 0.62, tz + 0.25, 0, { name: '큰 나무 그네', appr: 0.6 });
    anim.push((dt, tt) => { sw.rotation.x = Math.sin(tt * 1.2) * (seat.taken || seat.remoteTaken ? 0.2 : 0.035); });
    armchair(scene, room, tx - 1.5, tz + 1.3, face(tx - 1.5, tz + 1.3, tx, tz + 4), '#c7a06b', { name: '큰 나무 아래 의자' });
    armchair(scene, room, tx + 0.2, tz + 1.8, face(tx + 0.2, tz + 1.8, tx, tz + 4), '#d9a07a', { name: '큰 나무 아래 의자' });
    excl.push([tx, tz, 3.2]);
  }

  // ---------- 나무 위 오두막 (북동쪽) ----------
  const th = new THREE.Group();
  {
    const R = TREEHOUSE.rect, Y = TREEHOUSE.y;
    const cxt = (R.minX + R.maxX) / 2, czt = (R.minZ + R.maxZ) / 2;
    const w = R.maxX - R.minX + 0.2, d = R.maxZ - R.minZ + 0.2;
    const tx = cxt, tz = czt - 0.6;
    const bark = M.color('#6e5440', 1);
    scene.add(mesh(new THREE.CylinderGeometry(0.4, 0.6, 7.5, 12), bark, tx, 3.75, tz));
    obst(tx - 0.6, tx + 0.6, tz - 0.6, tz + 0.6);
    obst(tx - 0.5, tx + 0.5, tz - 0.5, tz + 0.5, 2);
    const canopy = new THREE.Group();
    for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, rr = 0.4 + r() * 2.0; canopy.add(mesh(new THREE.IcosahedronGeometry(1.0 + r() * 0.6, 1), M.color(['#6f9a5e', '#82ab6a', '#5f8a52', '#94b97a'][i % 4], 1), Math.cos(a) * rr, 6.2 + r() * 1.6, Math.sin(a) * rr)); }
    canopy.traverse((o) => { o.userData.noHit = true; });
    canopy.position.set(tx, 0, tz);
    scene.add(canopy);
    room.bigCanopies.push({ g: canopy, x: tx, z: tz, k: 1 });
    th.add(mesh(rbox(w, 0.16, d, 0.03), M.woodMid(), cxt, Y - 0.08, czt));
    for (const [px, pz] of [[R.minX + 0.1, R.minZ + 0.1], [R.maxX - 0.1, R.minZ + 0.1], [R.minX + 0.1, R.maxZ - 0.1], [R.maxX - 0.1, R.maxZ - 0.1]]) { scene.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, Y, 8), M.woodDark(), px, Y / 2, pz)); obst(px - 0.14, px + 0.14, pz - 0.14, pz + 0.14); }
    const wallM = M.woodLight();
    th.add(mesh(rbox(w, 1.7, 0.1, 0.02), wallM, cxt, Y + 0.85, R.minZ + 0.05));
    th.add(mesh(rbox(0.1, 1.7, d * 0.55, 0.02), wallM, R.minX + 0.05, Y + 0.85, R.minZ + d * 0.275));
    th.add(mesh(rbox(0.1, 1.7, d * 0.55, 0.02), wallM, R.maxX - 0.05, Y + 0.85, R.minZ + d * 0.275));
    const hroof = mesh(new THREE.ConeGeometry(2.5, 1.2, 4), M.color('#8a4b36', 0.9), cxt, Y + 2.3, czt - 0.3); hroof.rotation.y = Math.PI / 4; hroof.userData.noHit = true; th.add(hroof);
    room.treehouseRoof = hroof;
    for (let x = R.minX + 0.1; x < R.maxX; x += 0.3) { if (x > TREEHOUSE.ramp.minX - 0.05 && x < TREEHOUSE.ramp.maxX + 0.05) continue; th.add(mesh(rbox(0.04, 0.8, 0.04, 0.01), M.woodDark(), x, Y + 0.4, R.maxZ - 0.03)); }
    th.add(mesh(rbox(TREEHOUSE.ramp.minX - R.minX, 0.06, 0.06, 0.02), M.woodDark(), (R.minX + TREEHOUSE.ramp.minX) / 2, Y + 0.8, R.maxZ - 0.03));
    th.add(mesh(rbox(R.maxX - TREEHOUSE.ramp.maxX, 0.06, 0.06, 0.02), M.woodDark(), (R.maxX + TREEHOUSE.ramp.maxX) / 2, Y + 0.8, R.maxZ - 0.03));
    const lm = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffc766', emissiveIntensity: 0.1 });
    th.add(mesh(rbox(0.2, 0.26, 0.2, 0.05), lm, cxt + 0.9, Y + 1.5, R.minZ + 0.25, { cast: false }));
    const light = new THREE.PointLight('#ffbb66', 0, 5, 1.7); light.position.set(cxt + 0.9, Y + 1.3, R.minZ + 0.5); th.add(light);
    room.nightParts.push((dt, t, n) => { lm.emissiveIntensity = 0.1 + n * 1.7; light.intensity = n * 5; });
    scene.add(th);
    const RR = TREEHOUSE.ramp;
    const len = RR.bottom - RR.top;
    for (let i = 0; i < 10; i++) { const y = Y * (i + 1) / 10, z = RR.bottom - len * (i + 0.5) / 10; scene.add(mesh(rbox(RR.maxX - RR.minX, 0.05, len / 10 + 0.03, 0.01), M.wood(), (RR.minX + RR.maxX) / 2, y - 0.03, z)); }
    const ang = Math.atan2(Y, len), sl = Math.hypot(Y, len);
    for (const xx of [RR.minX, RR.maxX]) { const s = mesh(rbox(0.06, 0.22, sl, 0.02), M.woodDark(), xx, Y / 2, (RR.top + RR.bottom) / 2); s.rotation.x = ang; scene.add(s); const rl = mesh(rbox(0.04, 0.04, sl, 0.01), M.woodDark(), xx, Y / 2 + 0.8, (RR.top + RR.bottom) / 2); rl.rotation.x = ang; scene.add(rl); }
    room.obstacles.push({ minX: RR.minX - 0.1, maxX: RR.maxX + 0.1, minZ: RR.top, maxZ: RR.bottom - 0.5 });
    const o = { fy: Y, lv: 2 };
    const start = room.seats.length;
    cushion(th, room, cxt - 1.05, czt - 0.6, Math.PI / 2, '#d97c5c', { ...o, name: '나무 위 오두막', nook: true });
    cushion(th, room, cxt - 1.05, czt + 0.5, Math.PI / 2, '#e8c86a', { ...o, name: '나무 위 오두막', nook: true });
    cushion(th, room, cxt + 1.05, czt - 0.6, -Math.PI / 2, '#7f97a8', { ...o, name: '나무 위 오두막', nook: true });
    cushion(th, room, cxt + 1.05, czt + 0.5, -Math.PI / 2, '#a9bba0', { ...o, name: '나무 위 오두막', nook: true });
    beanbag(th, room, cxt - 1.0, czt - 1.4, face(cxt - 1, czt - 1.4, cxt, czt + 1), '#c98f6b', { ...o, name: '나무 위 오두막 창가', nook: true });
    beanbag(th, room, cxt + 1.0, czt - 1.4, face(cxt + 1, czt - 1.4, cxt, czt + 1), '#b6a27c', { ...o, name: '나무 위 오두막 창가', nook: true });
    for (let i = start; i < room.seats.length; i++) room.seats[i].treehouse = true;
    room.hideables.push({ group: th, rect: R, lv: 2 });
    excl.push([cxt, czt, 3.4], [44, -11, 1.6]);
  }

  // ---------- 바닷가 ----------
  {
    const bz = 25.5;
    // 매점 오두막
    {
      const h = new THREE.Group();
      plank(h, 2.6, 2.1, 1.6, 0, 1.05, 0, M.woodLight(), 0.03);
      plank(h, 3.0, 0.08, 2.2, 0, 2.2, 0.2, M.color('#7a4b36', 0.9), 0.02);
      plank(h, 2.4, 0.06, 0.5, 0, 1.0, 0.95, M.wood(), 0.02);
      for (let i = 0; i < 3; i++) h.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 12), M.color(['#f0b93a', '#d0505a', '#7fb3c4'][i], 0.4), -0.6 + i * 0.5, 1.1, 0.95));
      const c = document.createElement('canvas'); c.width = 256; c.height = 96;
      const draw = () => { const p = c.getContext('2d'); p.fillStyle = '#f3e6cf'; p.fillRect(0, 0, 256, 96); p.fillStyle = '#5a3d2b'; p.textAlign = 'center'; p.textBaseline = 'middle'; p.font = '700 40px "Gowun Batang", serif'; p.fillText('바닷가 매점', 128, 50); };
      draw();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshStandardMaterial({ map: t })); sign.position.set(0, 1.75, 0.82); h.add(sign);
      h.traverse((o) => { o.userData.counter = true; });
      h.position.set(9.5, 0, bz + 1.6);
      h.rotation.y = Math.PI;
      scene.add(h);
      obst(8.1, 10.9, bz + 0.7, bz + 2.5);
      room.beachCounter = V(9.5, 0, bz + 0.2);
      for (const xx of [8.8, 10.2]) stool(scene, room, xx, bz + 0.3, Math.PI, 0.72, '#7fb3c4', { name: '매점 걸상', appr: 0.45 });
      excl.push([9.5, bz + 1.5, 3]);
    }
    // 파라솔 + 선베드
    const lounger = (x, z, rotY, col, name) => {
      const g = new THREE.Group();
      plank(g, 0.6, 0.05, 1.7, 0, 0.3, 0, M.woodLight(), 0.02);
      const bk = plank(g, 0.6, 0.05, 0.7, 0, 0.5, -0.75, M.woodLight(), 0.02); bk.rotation.x = -0.7;
      g.add(mesh(rbox(0.5, 0.06, 0.9, 0.03, 3), M.fabric(col), 0, 0.34, 0.3));
      for (const sx of [-0.25, 0.25]) for (const sz of [-0.7, 0.7]) g.add(mesh(rbox(0.04, 0.28, 0.04, 0.01), M.woodMid(), sx, 0.14, sz));
      g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
      obst(...Object.values(footprint(x, z, 0.64, 1.75, rotY)).slice(0, 4));
      return addSeat(room, x, 0.4, z, rotY, { name, appr: 0.95, kind: 'lounger' });
    };
    for (const [x, col] of [[16.5, '#d97c5c'], [27, '#e8c86a'], [35, '#7f97a8']]) {
      const z = bz + 2.3;
      scene.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 8), M.color('#efe7da', 0.5), x, 1.2, z));
      const canopy = mesh(new THREE.ConeGeometry(1.3, 0.5, 12, 1, true), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, side: THREE.DoubleSide }), x, 2.3, z);
      canopy.userData.noHit = true;
      scene.add(canopy);
      obst(x - 0.06, x + 0.06, z - 0.06, z + 0.06);
      lounger(x - 0.8, z + 0.3, Math.PI, col, '파라솔 선베드');
      lounger(x + 0.8, z + 0.3, Math.PI, col, '파라솔 선베드');
      excl.push([x, z, 2.5]);
    }
    // 바닷가 모닥불 · 통나무
    {
      const cxl = 30.5, czl = bz + 1.2;
      firebowl(scene, room, cxl, czl, 0, { range: 9, power: 8, id: 'beach', name: '바닷가 모닥불' });
      woodpile(scene, room, cxl + 1.75, czl + 1.75, 0, Math.PI / 4, 'beach');
      // 폭죽 상자 + 모래에 꽂은 발사 통 (밤에 누르면 폭죽 놀이)
      {
        const bx = 23.6, bzc = 27.9;
        const g = new THREE.Group();
        g.add(mesh(rbox(0.7, 0.42, 0.48, 0.03), M.color('#b4462e', 0.8), 0, 0.21, 0));
        g.add(mesh(rbox(0.74, 0.06, 0.52, 0.02), M.color('#e9c46a', 0.7), 0, 0.44, 0));
        for (let i = 0; i < 5; i++) { const t = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 8), M.color(['#ff6f6f', '#ffd34d', '#7bdcff', '#a98bff', '#7dffb0'][i], 0.6), -0.22 + i * 0.11, 0.58, -0.08); t.rotation.z = (i - 2) * 0.08; g.add(t); }
        const tag = textSprite('🎆 폭죽 놀이 (밤)', { height: 0.11 });
        tag.position.set(0, 0.95, 0); tag.userData.noHit = true; g.add(tag);
        g.position.set(bx, 0, bzc);
        g.rotation.y = 0.2;
        g.traverse((o) => { if (o.isMesh) o.userData.fwbox = true; });
        scene.add(g);
        obst(bx - 0.42, bx + 0.42, bzc - 0.32, bzc + 0.32);
        const rack = new THREE.Group();
        for (let i = 0; i < 3; i++) rack.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.45, 10), M.color('#3e3a36', 0.6), (i - 1) * 0.18, 0.2, 0));
        rack.add(mesh(rbox(0.65, 0.05, 0.2, 0.02), M.woodDark(), 0, 0.03, 0));
        rack.position.set(bx - 1.3, 0, 29.3);
        scene.add(rack);
        obst(bx - 1.65, bx - 0.95, 29.15, 29.45);
        room.fwBox = { stand: V(bx + 0.1, 0, bzc - 0.75), launchX: bx - 1.3 };
      }
      room.beachFire = V(cxl, 0, czl);
      for (const a of [Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) { const lx = cxl + Math.cos(a) * 1.8, lz = czl + Math.sin(a) * 1.8; const rot = face(lx, lz, cxl, czl); const lg = mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.5, 10).rotateZ(Math.PI / 2), M.color('#b89a7a', 1), lx, 0.2, lz); lg.rotation.y = rot; scene.add(lg); obst(...Object.values(footprint(lx, lz, 1.5, 0.44, rot)).slice(0, 4)); for (const s of [-0.35, 0.35]) addSeat(room, lx + Math.cos(rot) * s, 0.44, lz - Math.sin(rot) * s, rot, { name: '바닷가 모닥불 통나무', appr: -0.55 }); }
      excl.push([cxl, czl, 3.5]);
    }
    // 선착장 (끝에 숨은 자리)
    {
      const px = 40.5, z0 = bz + 2.2, z1 = SEA_Z + 4.5;
      const g = new THREE.Group();
      for (let z = z0; z < z1; z += 0.3) g.add(mesh(rbox(1.6, 0.06, 0.28, 0.01), r() < 0.5 ? M.wood() : M.woodLight(), px, 0.45, z, { cast: false }));
      for (let z = z0 + 0.3; z < z1; z += 1.5) for (const s of [-0.7, 0.7]) g.add(mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.9, 8), M.woodDark(), px + s, 0.0, z));
      for (const s of [-0.78, 0.78]) { g.add(mesh(rbox(0.05, 0.05, z1 - z0, 0.01), M.woodDark(), px + s, 1.25, (z0 + z1) / 2)); for (let z = z0 + 0.2; z < z1; z += 1.5) g.add(mesh(rbox(0.05, 0.8, 0.05, 0.01), M.woodDark(), px + s, 0.85, z)); }
      scene.add(g);
      // 선착장 위는 바다 장애물 위라서 따로 열어 줌: 바다 장애물을 선착장 폭만큼 비움
      room.obstacles = room.obstacles.filter((o) => !(o.minZ === SEA_Z && o.maxZ > WORLD.maxZ));
      obst(WORLD.minX - 2, px - 0.85, SEA_Z, WORLD.maxZ + 5);
      obst(px + 0.85, WORLD.maxX + 2, SEA_Z, WORLD.maxZ + 5);
      obst(px - 0.85, px + 0.85, z1, WORLD.maxZ + 5);
      obst(px - 0.9, px - 0.7, z0 - 0.1, z1);
      obst(px + 0.7, px + 0.9, z0 - 0.1, z1);
      bench(scene, room, px, z1 - 0.55, Math.PI, 1.3, 2, { name: '선착장 끝 벤치', nook: true, mat: M.wood() }).forEach((s) => { s.pos.y = 0.95; s.fy = 0.45; s.appr.y = 0; });
      const lm = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffc766', emissiveIntensity: 0.05 });
      scene.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 8), M.woodDark(), px + 0.6, 1.2, z1 - 0.2));
      scene.add(mesh(rbox(0.18, 0.22, 0.18, 0.04), lm, px + 0.6, 2.1, z1 - 0.2, { cast: false }));
      const L = new THREE.PointLight('#ffbb66', 0, 6, 1.7); L.position.set(px + 0.6, 2.0, z1 - 0.2); scene.add(L);
      room.nightParts.push((dt, t, n) => { lm.emissiveIntensity = 0.05 + n * 1.7; L.intensity = n * 5; });
      room.jetty = { x: px, z0, z1 };
      excl.push([px, z0, 3]);
    }
    // 망루 의자 · 유목 · 바위
    {
      const x = 22.5, z = bz - 0.8;
      const g = new THREE.Group();
      for (const sx of [-0.4, 0.4]) for (const sz of [-0.4, 0.4]) g.add(mesh(rbox(0.07, 1.8, 0.07, 0.015), M.woodLight(), sx, 0.9, sz));
      plank(g, 1.0, 0.05, 1.0, 0, 1.6, 0, M.woodLight(), 0.02);
      plank(g, 0.9, 0.05, 0.45, 0, 2.05, -0.2, M.woodLight(), 0.02);
      plank(g, 0.9, 0.5, 0.05, 0, 2.3, -0.45, M.woodLight(), 0.02);
      for (let i = 0; i < 5; i++) g.add(mesh(rbox(0.5, 0.04, 0.08, 0.01), M.woodMid(), 0.0, 0.3 + i * 0.3, 0.45));
      g.position.set(x, 0, z);
      scene.add(g);
      obst(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
      addSeat(room, x, 2.1, z, Math.PI, { name: '바닷가 망루', nook: true, appr: 0.8 });
      excl.push([x, z, 2]);
    }
    for (const [x, z, rot] of [[5.0, bz + 1.8, 0.4], [47.0, bz + 1.0, -0.3]]) {
      const lg = mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.4, 10).rotateZ(Math.PI / 2), M.color('#c9b59a', 1), x, 0.25, z); lg.rotation.y = rot; scene.add(lg);
      obst(...Object.values(footprint(x, z, 2.4, 0.55, rot)).slice(0, 4));
      for (const s of [-0.7, 0.7]) addSeat(room, x + Math.cos(rot) * s, 0.52, z - Math.sin(rot) * s, Math.PI, { name: '유목 통나무', appr: -0.6, nook: true });
      excl.push([x, z, 2]);
    }
    // 동쪽 바위 해안
    for (let i = 0; i < 12; i++) { const x = 48 + r() * 6, z = bz - 1 + r() * 6; const rk = mesh(new THREE.DodecahedronGeometry(0.5 + r() * 0.8, 1), rockMat, x, 0.2, z); rk.scale.y = 0.6; rk.rotation.y = r() * 3; scene.add(rk); obst(x - 0.6, x + 0.6, z - 0.6, z + 0.6); }
    for (const [x, z] of [[50.5, bz + 0.2], [52.5, bz + 2.6]]) { const rk = mesh(new THREE.DodecahedronGeometry(0.5, 1), rockMat, x, 0.12, z); rk.scale.set(1.2, 0.62, 1); scene.add(rk); obst(x - 0.4, x + 0.4, z - 0.36, z + 0.36); addSeat(room, x, 0.6, z, Math.PI, { name: '바위 해안', nook: true, appr: -0.62 }); }
    excl.push([51, bz + 1.5, 5]);
    // 해변 소나무 둔덕 해먹
    trees.push([13.0, 23.0, 'pine', 1.2], [15.4, 22.8, 'pine', 1.1]);
    hammock(scene, room, 14.2, 23.1, 0.05, '#7f97a8', { name: '해변 소나무 해먹', nook: true });
    excl.push([14.2, 23.1, 2.4]);
    // 조개 · 풀 몇 포기
    for (let i = 0; i < 60; i++) { const sh = mesh(new THREE.SphereGeometry(0.05, 8, 6), M.color(['#fff6e8', '#f2d8c6', '#e8c9a8'][i % 3], 0.6), -20 + r() * 70, 0.03, bz + 1 + r() * 4, { cast: false }); sh.scale.y = 0.4; scene.add(sh); }
  }

  // ---------- 길가 그루터기 ----------
  for (const [x, z] of [[12.5, 2.8], [16.3, -2.6], [21.5, 0.6], [16.6, 6.8], [10.6, 12.6], [13.6, 16.4], [33.5, -3.4], [37.5, -8.6], [38.3, 5.3], [20.4, -16.0], [25.5, 18.5], [-19.6, 6.5], [-16.0, -13.4], [3.0, -13.2]]) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.42, 12), M.color('#8b6a4a', 1), 0, 0.21, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.01, 12), M.color('#d8b98a', 1), 0, 0.425, 0, { cast: false }));
    g.position.set(x, 0, z);
    scene.add(g);
    obst(x - 0.26, x + 0.26, z - 0.26, z + 0.26);
    let best = 1e9, bx = x, bz2 = z;
    for (const P of PATHS) for (const [px, pz] of P) { const d = Math.hypot(px - x, pz - z); if (d < best) { best = d; bx = px; bz2 = pz; } }
    addSeat(room, x, 0.48, z, face(bx, bz2, x, z), { name: '길가 그루터기', appr: -0.5 });
    excl.push([x, z, 1.0]);
  }

  // ---------- 나무 심기 (전보다 성기게) ----------
  const okTree = (x, z, rad = 1.6) => {
    if (x > CABIN.minX - 2.2 && x < CABIN.maxX + 2.4 && z > CABIN.minZ - 2.2 && z < CABIN.maxZ + 2.6) return false;
    if (z > 22) return false;
    if (distPaths(x, z) < rad + 0.3) return false;
    if (Math.abs(x - streamX(z)) < 2.6) return false;
    for (const [ex, ez, er] of excl) if (Math.hypot(x - ex, z - ez) < er) return false;
    for (const t of trees) if (Math.hypot(x - t[0], z - t[1]) < 2.6) return false;
    return true;
  };
  for (let i = 0; i < 4000 && trees.length < 150; i++) {
    const x = WORLD.minX + 1 + r() * (WORLD.maxX - WORLD.minX - 2), z = WORLD.minZ + 1 + r() * (22 - WORLD.minZ - 1);
    if (!okTree(x, z)) continue;
    const kind = x > 20 && x < 27 && z < -12 ? 'birch' : r() < 0.4 ? 'pine' : 'broad';
    trees.push([x, z, kind, 0.85 + r() * 0.5]);
  }
  const inner = trees.length;
  for (let i = 0; i < 4000 && trees.length < inner + 170; i++) {
    const x = G0.minX + 2 + r() * (G0.maxX - G0.minX - 4), z = G0.minZ + 2 + r() * (22 - G0.minZ);
    const inside = x > WORLD.minX - 0.5 && x < WORLD.maxX + 0.5 && z > WORLD.minZ - 0.5;
    if (inside) continue;
    if (trees.some((t) => Math.hypot(x - t[0], z - t[1]) < 2.2)) continue;
    trees.push([x, z, r() < 0.55 ? 'pine' : 'broad', 0.9 + r() * 0.6, true]);
  }
  for (const [x, z, , s, outside] of trees) if (!outside) obst(x - 0.25 * s, x + 0.25 * s, z - 0.25 * s, z + 0.25 * s);
  for (let i = 0; i < 1200 && bushes.length < 260; i++) {
    const x = WORLD.minX + 1 + r() * (WORLD.maxX - WORLD.minX - 2), z = WORLD.minZ + 1 + r() * (22 - WORLD.minZ - 1);
    if (x > CABIN.minX - 1.5 && x < CABIN.maxX + 1.5 && z > CABIN.minZ - 1.5 && z < CABIN.maxZ + 2.5) continue;
    if (distPaths(x, z) < 1.3 || Math.abs(x - streamX(z)) < 2.0) continue;
    if (excl.some(([ex, ez, er]) => Math.hypot(x - ex, z - ez) < er)) continue;
    if (trees.some((t) => Math.hypot(x - t[0], z - t[1]) < 0.9)) continue;
    addBush(x, z, 0.7 + r() * 0.6, r() < 0.7);
  }

  // 인스턴스 메시로 그리기 (같은 모양을 한 번에 여러 개)
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 1, 7); trunkGeo.translate(0, 0.5, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1.6, 8);
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  const nT = trees.length;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, nT);
  const cones = new THREE.InstancedMesh(coneGeo, leafMat, nT * 3);
  const blobs = new THREE.InstancedMesh(blobGeo, leafMat, nT * 4);
  const col = new THREE.Color();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  let ci = 0, bi = 0;
  const canopyOf = [];
  trees.forEach(([x, z, kind, s], i) => {
    const h = kind === 'pine' ? 1.4 * s : kind === 'birch' ? 3.0 * s : 2.0 * s;
    ps.set(x, 0, z); q.identity(); sc.set(s, h, s);
    trunks.setMatrixAt(i, m4.compose(ps, q, sc));
    trunks.setColorAt(i, col.set(kind === 'birch' ? '#ece6da' : '#7d5f44').offsetHSL(0, 0, (r() - 0.5) * 0.06));
    const parts = [];
    if (kind === 'pine') {
      for (let k = 0; k < 3; k++) { const cs = (1.5 - k * 0.38) * s; const base = { p: V(x, h + 0.7 * s + k * 1.0 * s, z), s: V(cs, cs, cs), q: new THREE.Quaternion() }; cones.setMatrixAt(ci, m4.compose(base.p, base.q, base.s)); cones.setColorAt(ci, col.set(['#4f7a52', '#5d8a5a', '#47704a'][k]).offsetHSL(0, 0, (r() - 0.5) * 0.08)); parts.push({ mesh: cones, i: ci++, ...base }); }
    } else {
      const nb = kind === 'birch' ? 3 : 4;
      for (let k = 0; k < nb; k++) { const a = r() * Math.PI * 2, rr = k === 0 ? 0 : 0.5 * s; const bs = (kind === 'birch' ? 0.75 : 1.05 + r() * 0.3) * s; const base = { p: V(x + Math.cos(a) * rr, h + (k === 0 ? 0.7 : 0.4 + r() * 0.6) * s, z + Math.sin(a) * rr), s: V(bs, bs * 0.85, bs), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 3, 0)) }; blobs.setMatrixAt(bi, m4.compose(base.p, base.q, base.s)); blobs.setColorAt(bi, col.set(kind === 'birch' ? ['#a7c47a', '#b9d08a', '#9cbd70'][k % 3] : ['#6f9a5e', '#82ab6a', '#5f8a52', '#94b97a'][k % 4]).offsetHSL(0, 0, (r() - 0.5) * 0.06)); parts.push({ mesh: blobs, i: bi++, ...base }); }
    }
    canopyOf.push({ x, z, parts, k: 1, h });
  });
  cones.count = ci; blobs.count = bi;
  for (const im of [trunks, cones, blobs]) { im.castShadow = true; im.receiveShadow = true; im.userData.noHit = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); }
  room.canopies = canopyOf;
  const bushM = new THREE.InstancedMesh(blobGeo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), bushes.length * 2);
  let k2 = 0;
  for (const [x, z, s] of bushes) for (let j = 0; j < 2; j++) { ps.set(x + (j ? 0.25 : -0.1) * s, 0.35 * s, z + (j ? -0.15 : 0.1) * s); q.setFromEuler(new THREE.Euler(0, r() * 3, 0)); sc.set(0.5 * s, 0.42 * s * (j ? 0.8 : 1.15), 0.5 * s); bushM.setMatrixAt(k2, m4.compose(ps, q, sc)); bushM.setColorAt(k2++, col.set(['#5f8a52', '#6f9a5e', '#7aa261', '#55804c'][Math.floor(r() * 4)])); }
  bushM.castShadow = true; bushM.receiveShadow = true;
  scene.add(bushM);
  {
    const fm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), flowers.length);
    const cols = ['#f6d36b', '#f2a7a0', '#ffffff', '#c9b6e4', '#9cc3e6', '#f0a35a'];
    flowers.forEach(([x, z], i) => { ps.set(x, 0.12 + r() * 0.1, z); q.identity(); sc.setScalar(0.7 + r() * 0.8); fm.setMatrixAt(i, m4.compose(ps, q, sc)); fm.setColorAt(i, col.set(cols[Math.floor(r() * cols.length)])); });
    fm.userData.noHit = true;
    scene.add(fm);
    const N = 1100;
    const gm = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.35, 4), new THREE.MeshStandardMaterial({ color: '#7fa35e', roughness: 1 }), N);
    let n = 0;
    for (let i = 0; i < 6000 && n < N; i++) {
      const x = WORLD.minX + r() * (WORLD.maxX - WORLD.minX), z = WORLD.minZ + r() * (23 - WORLD.minZ);
      if (x > CABIN.minX - 1 && x < CABIN.maxX + 1 && z > CABIN.minZ - 1 && z < CABIN.maxZ + 2) continue;
      if (distPaths(x, z) < 0.85 || Math.abs(x - streamX(z)) < 1.3) continue;
      ps.set(x, 0.15, z); q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4)); sc.set(1, 0.6 + r() * 0.8, 1);
      gm.setMatrixAt(n++, m4.compose(ps, q, sc));
    }
    gm.count = n; gm.userData.noHit = true;
    scene.add(gm);
  }

  // ---------- 길가 등불 ----------
  const lanternMats = [], lanternGlows = [];
  {
    const lgeo = rbox(0.18, 0.22, 0.18, 0.04);
    let acc = 3;
    for (const P of PATHS) {
      for (let i = 0; i < P.length - 1; i++) {
        const [ax, az] = P[i], [bx, bz] = P[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        for (let t = 0; t < len; t += 0.5) {
          acc += 0.5;
          if (acc < 7.5) continue;
          acc = 0;
          const u = t / len;
          const nx = -(bz - az) / len, nz = (bx - ax) / len;
          const x = ax + (bx - ax) * u + nx * 1.0, z = az + (bz - az) * u + nz * 1.0;
          if (Math.abs(x - streamX(z)) < 1.6 || (x > CABIN.minX - 0.5 && x < CABIN.maxX + 0.5 && z > CABIN.minZ - 0.5 && z < CABIN.maxZ + 0.5)) continue;
          scene.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.85, 6), M.woodDark(), x, 0.42, z));
          const m = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffc766', emissiveIntensity: 0.05, roughness: 0.6 });
          scene.add(mesh(lgeo, m, x, 0.95, z, { cast: false }));
          const gl = glowSprite('#ffcf7a', 1.3); gl.position.set(x, 0.95, z); scene.add(gl);
          lanternMats.push(m); lanternGlows.push(gl);
          obst(x - 0.08, x + 0.08, z - 0.08, z + 0.08);
        }
      }
    }
  }

  // ---------- 나비(낮) · 반딧불(밤) · 갈매기 ----------
  const FN = 160;
  const flyGeo = new THREE.BufferGeometry();
  const fp = new Float32Array(FN * 3);
  flyGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flyMat = new THREE.PointsMaterial({ color: '#fff6b0', size: 0.11, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flies = new THREE.Points(flyGeo, flyMat);
  flies.frustumCulled = false;
  scene.add(flies);
  const flySeed = Array.from({ length: FN }, () => [CABIN.maxX + 2 + r() * (WORLD.maxX - CABIN.maxX - 3), WORLD.minZ + 1 + r() * (22 - WORLD.minZ - 2), r() * 6, 0.3 + r() * 0.6]);
  const butterflies = [];
  for (let i = 0; i < 8; i++) {
    const b = new THREE.Group();
    const wm = new THREE.MeshStandardMaterial({ color: ['#f6d36b', '#f2a7a0', '#ffffff', '#9cc3e6'][i % 4], side: THREE.DoubleSide, roughness: 0.8 });
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), wm); w.position.x = s * 0.05; w.rotation.x = -Math.PI / 2; b.add(w); }
    scene.add(b);
    const home = i < 3 ? V(42 + (r() - 0.5) * 5, 0.7, 8.5 + (r() - 0.5) * 4) : V(10 + r() * 20, 0.8, r() * 16 - 8);
    butterflies.push({ b, c: home, ph: r() * 6 });
  }
  room.butterflyPos = () => { const b = butterflies[Math.floor(Math.random() * butterflies.length)]; return b.b.visible ? b.b.position.clone() : null; };
  const gulls = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) { const w = mesh(rbox(0.5, 0.02, 0.14, 0.01), M.color('#f4f4f4', 0.9), s * 0.26, 0, 0, { cast: false }); g.add(w); }
    g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), M.color('#f4f4f4', 0.9), 0, 0, 0.05, { cast: false }));
    scene.add(g);
    gulls.push({ g, ph: r() * 6, r: 6 + r() * 6, h: 4 + r() * 3 });
  }

  // ---------- 비 ----------
  const RN = 700;
  const rainGeo = new THREE.BufferGeometry();
  const rp = new Float32Array(RN * 6);
  const rs = new Float32Array(RN);
  const roff = new Float32Array(RN * 2);
  for (let i = 0; i < RN; i++) { roff[i * 2] = (r() - 0.5) * 30; roff[i * 2 + 1] = (r() - 0.5) * 30; const y = r() * 7; rp.set([0, y, 0, -0.02, y - 0.25, 0], i * 6); rs[i] = 6 + r() * 2; }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#c7d6e6', transparent: true, opacity: 0.5 }));
  rain.frustumCulled = false; rain.userData.noHit = true;
  scene.add(rain);

  room.nightParts.push((dt, t, night) => {
    for (const fn of anim) fn(dt, t);
    lanternMats.forEach((m) => { m.emissiveIntensity = 0.05 + night * 1.7; });
    lanternGlows.forEach((g) => { g.material.opacity = night * 0.65; });
    seaMat.color.setStyle('#5fa3b8').lerp(new THREE.Color('#1c3550'), night);
    flyMat.opacity = night * 0.95 * (room.rainOn ? 0.3 : 1);
    flies.visible = night > 0.05;
    if (flies.visible) {
      for (let i = 0; i < FN; i++) { const [x, z, ph, sp] = flySeed[i]; fp[i * 3] = x + Math.sin(t * sp + ph) * 0.9; fp[i * 3 + 1] = 0.5 + Math.sin(t * sp * 1.7 + ph) * 0.4 + 0.35; fp[i * 3 + 2] = z + Math.cos(t * sp * 0.8 + ph) * 0.9; }
      flyGeo.attributes.position.needsUpdate = true;
      flyMat.size = 0.09 + Math.sin(t * 6) * 0.02;
    }
    const showB = night < 0.5 && !room.rainOn;
    for (const B of butterflies) {
      B.b.visible = showB;
      if (!showB) continue;
      const a = t * 0.5 + B.ph;
      B.b.position.set(B.c.x + Math.sin(a) * 1.6, B.c.y + Math.sin(a * 3.1) * 0.25, B.c.z + Math.sin(a * 0.7) * 1.2);
      B.b.rotation.y = a;
      const flap = Math.sin(t * 18 + B.ph) * 0.9;
      B.b.children[0].rotation.y = flap; B.b.children[1].rotation.y = -flap;
    }
    for (const G of gulls) {
      G.g.visible = night < 0.6 && !room.rainOn;
      const a = t * 0.25 + G.ph;
      G.g.position.set(28 + Math.cos(a) * G.r * 1.6, G.h + Math.sin(a * 2.3) * 0.6, SEA_Z + 2 + Math.sin(a) * G.r * 0.5);
      G.g.rotation.y = -a + Math.PI / 2;
      G.g.children[0].rotation.z = Math.sin(t * 5 + G.ph) * 0.35; G.g.children[1].rotation.z = -Math.sin(t * 5 + G.ph) * 0.35;
    }
    for (const B of birds) {
      const hide = night > 0.5 || room.rainOn || B.away > 0;
      B.away = Math.max(0, B.away - dt);
      B.b.visible = !hide;
      if (hide) continue;
      const hop = Math.max(0, Math.sin(t * 2.3 + B.ph)) ** 8 * 0.06;
      B.b.position.copy(B.home).add(V(Math.sin(t * 0.7 + B.ph) * 0.05, hop, 0));
      B.b.rotation.y = Math.sin(t * 0.9 + B.ph) * 1.5;
    }
    rain.visible = !!room.rainOn;
    if (rain.visible) {
      const c = room.viewCenter || V(10, 0, 0);
      const a = rainGeo.attributes.position.array;
      for (let i = 0; i < RN; i++) {
        let y = a[i * 6 + 1] - rs[i] * dt;
        if (y < 0) y += 7;
        const x = c.x + roff[i * 2], z = c.z + roff[i * 2 + 1];
        if (x > CABIN.minX - 0.3 && x < CABIN.maxX + 0.3 && z > CABIN.minZ - 0.3 && z < CABIN.maxZ + 1.5) y = -10;
        a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z;
        a[i * 6 + 3] = x - 0.02; a[i * 6 + 4] = y - 0.25; a[i * 6 + 5] = z;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
  });
  room.scareBirds = () => { for (const B of birds) B.away = 8 + Math.random() * 6; };
  room.birdsPresent = () => birds.some((B) => B.b.visible);
  room.paths = PATHS;
}

// 나무 잎이 나를 가리면 살짝 접어 줌 (카메라와 나 사이)
const tmpM = new THREE.Matrix4(), tmpS = new THREE.Vector3();
export function updateCanopies(room, me, camPos, dt) {
  if (!room.canopies) return;
  const dirX = camPos.x - me.x, dirZ = camPos.z - me.z;
  const dl = Math.hypot(dirX, dirZ) || 1;
  const ux = dirX / dl, uz = dirZ / dl;
  const dirty = new Set();
  const want = (x, z, rad) => {
    const dx = x - me.x, dz = z - me.z;
    const along = dx * ux + dz * uz;
    if (along < -rad || along > dl + 1.5) return 1;
    const side = Math.abs(dx * uz - dz * ux);
    return side < rad + 0.6 ? 0.22 : 1;
  };
  for (const c of room.canopies) {
    const far = Math.abs(c.x - me.x) > 11 || Math.abs(c.z - me.z) > 11;
    if (far && c.k === 1) continue;
    const w = far ? 1 : want(c.x, c.z, 1.4);
    if (c.k === w) continue;
    c.k += (w - c.k) * (1 - Math.exp(-6 * dt));
    if (Math.abs(c.k - w) < 0.01) c.k = w;
    for (const p of c.parts) { tmpS.copy(p.s).multiplyScalar(c.k); p.mesh.setMatrixAt(p.i, tmpM.compose(p.p, p.q, tmpS)); dirty.add(p.mesh); }
  }
  for (const m of dirty) m.instanceMatrix.needsUpdate = true;
  for (const b of room.bigCanopies || []) b.g.visible = want(b.x, b.z, 2.4) === 1;
}

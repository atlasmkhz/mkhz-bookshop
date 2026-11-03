// 오두막 문을 나서면 펼쳐지는 숲 정원
// 오솔길이 갈래로 나뉘고 끝마다 숨은 자리: 나무 그늘 해먹, 시냇가 바위, 덤불 뒤 벤치, 작은 정자, 들꽃 언덕,
// 나무 위 오두막, 모닥불 통나무 자리. 낮엔 햇살 · 나뭇잎 그림자 · 새, 밤엔 등불 · 반딧불 · 풀벌레
import * as THREE from 'three';
import { M, rbox, mesh, plank, mulberry, footprint, glowSprite, stoneTexture } from './kit.js';
import { CABIN, WORLD, DOOR, PLATFORMS } from './nav.js';
import { armchair, cushion, beanbag, stool, bench, addSeat } from './furniture.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const TREEHOUSE = PLATFORMS[1];

// 오솔길 (갈래)
const PATHS = [
  [[4.3, 0], [8, 0.2], [12, 0]],
  [[12, 0], [12.8, -4.5], [13.4, -8.6], [14.4, -10.8]],
  [[12, 0], [17, -2.2], [22.5, -5.0], [27, -6.0], [29.6, -6.1], [32.6, -6.5], [35, -5.0]],
  [[12, 0], [18, 1.4], [24, 2.4], [27.2, 3.7], [29.8, 3.9], [33.2, 3.2]],
  [[12, 0], [12.6, 4.5], [15.5, 8.5], [19.2, 10.8]],
  [[29.8, 3.9], [32, 8], [33.4, 10.0]],
  [[8, 0.2], [8.5, -4.4]],
  [[8, 0.2], [7.6, 4.4]],
  [[13.3, -7.6], [18.2, -8.6]],
  [[24, 2.4], [25.6, -0.4], [25.9, -1.8]],
  [[19.2, 10.8], [23.6, 9.4], [25.6, 8.6]],
  [[13.4, 5.8], [16.0, 5.9]],
  [[32.6, -6.5], [31.4, -2.8]],
];
// 시내: 남북으로 흐름
const streamX = (z) => 28.5 + Math.sin(z * 0.25) * 1.1 + Math.sin(z * 0.6) * 0.3;
const BRIDGES = [[-6.9, -5.2], [3.0, 4.7]];

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
  for (let i = 0; i < 40; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(110,150,70,0.25)' : 'rgba(190,210,130,0.2)';
    g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 60, 12 + r() * 30, r() * 3, 0, 7); g.fill();
  }
  for (let i = 0; i < 9000; i++) {
    const x = r() * 512, y = r() * 512;
    g.strokeStyle = r() < 0.5 ? 'rgba(70,110,45,0.35)' : 'rgba(200,225,150,0.3)';
    g.lineWidth = 1 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function dirtTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c9ab7f'; g.fillRect(0, 0, 256, 256);
  const r = mulberry(5);
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(120,90,55,0.25)' : 'rgba(240,225,195,0.3)';
    const s = 1 + r() * 3; g.fillRect(r() * 256, r() * 256, s, s);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildForest(scene, room) {
  const r = mulberry(77);
  const obst = (x0, x1, z0, z1, lv) => { const o = { minX: x0, maxX: x1, minZ: z0, maxZ: z1 }; if (lv) o.lv = lv; room.obstacles.push(o); return o; };
  const anim = [];
  const excl = []; // [x, z, 반지름] 나무를 심지 않을 곳

  // ---------- 땅 ----------
  const G0 = { minX: -22, maxX: 52, minZ: -30, maxZ: 30 };
  const gw = G0.maxX - G0.minX, gd = G0.maxZ - G0.minZ;
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 });
  grassMat.map.repeat.set(gw / 6, gd / 6);
  const ground = mesh(new THREE.BoxGeometry(gw, 0.1, gd), grassMat, (G0.minX + G0.maxX) / 2, -0.07, 0, { cast: false });
  ground.name = 'ground';
  scene.add(ground);
  // 디오라마 받침
  scene.add(mesh(rbox(gw + 0.8, 0.8, gd + 0.8, 0.15, 3), M.woodDark(), (G0.minX + G0.maxX) / 2, -0.52, 0, { cast: false }));

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
        const w = 0.55 + Math.sin(i * 0.7) * 0.06;
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

  // ---------- 데크 (문 앞) ----------
  {
    const deck = new THREE.Group();
    for (let x = CABIN.maxX + 0.3; x < 7.3; x += 0.3) deck.add(mesh(rbox(0.28, 0.06, 5.6, 0.01), r() < 0.5 ? M.wood() : M.woodLight(), x, 0.03, 0, { cast: false }));
    scene.add(deck);
    armchair(scene, room, 6.5, -1.9, face(6.5, -1.9, 12, -3), '#c7a06b', { name: '데크 흔들의자' });
    armchair(scene, room, 6.5, 1.9, face(6.5, 1.9, 12, 3), '#a9bba0', { name: '데크 흔들의자' });
    bench(scene, room, 4.75, -2.2, Math.PI / 2, 1.3, 2, { cushion: '#d9a07a', name: '처마 밑 벤치' });
    room.gardenSpots.push(V(5.6, 0.05, 2.4), V(6.8, 0.05, -0.4));
    excl.push([5.8, 0, 3.5]);
  }

  // ---------- 새 모이대 ----------
  const birds = [];
  {
    const x = 9.8, z = -2.6;
    scene.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.3, 8), M.woodMid(), x, 0.65, z));
    scene.add(mesh(rbox(0.5, 0.04, 0.5, 0.02), M.wood(), x, 1.32, z));
    const roof = mesh(new THREE.ConeGeometry(0.42, 0.25, 4), M.color('#c27c5c', 0.9), x, 1.62, z);
    roof.rotation.y = Math.PI / 4;
    scene.add(roof);
    obst(x - 0.15, x + 0.15, z - 0.15, z + 0.15);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group();
      const bc = ['#7d6a5a', '#c99a63', '#8aa0b8'][i];
      b.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), M.color(bc, 0.8), 0, 0, 0));
      b.add(mesh(new THREE.SphereGeometry(0.032, 8, 6), M.color(bc, 0.8), 0, 0.04, 0.035));
      const beak = mesh(new THREE.ConeGeometry(0.01, 0.025, 5), M.color('#e8b04a'), 0, 0.04, 0.07);
      beak.rotation.x = Math.PI / 2;
      b.add(beak);
      scene.add(b);
      birds.push({ b, home: V(x - 0.15 + i * 0.15, 1.39, z + (i - 1) * 0.08), ph: r() * 6, away: 0 });
    }
    room.birdFeeder = V(x, 0, z);
    excl.push([x, z, 1.5]);
  }

  // ---------- 시내 + 다리 ----------
  {
    const pos = [], uv = [], idx = [];
    const n = 80;
    for (let i = 0; i <= n; i++) {
      const z = G0.minZ + (G0.maxZ - G0.minZ) * i / n;
      const x = streamX(z);
      const w = 0.85 + Math.sin(z * 0.9) * 0.12;
      pos.push(x - w, 0.02, z, x + w, 0.02, z);
      uv.push(0, i * 0.5, 1, i * 0.5);
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#7fb3c4'; g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.25})`; g.fillRect(r() * 64, r() * 256, 2 + r() * 10, 1.5); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const wm = new THREE.MeshStandardMaterial({ map: t, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 });
    const water = new THREE.Mesh(geo, wm);
    water.receiveShadow = true;
    scene.add(water);
    anim.push((dt) => { t.offset.y -= dt * 0.25; });
    // 물가 자갈
    for (let i = 0; i < 70; i++) {
      const z = WORLD.minZ + r() * (WORLD.maxZ - WORLD.minZ);
      const s = r() < 0.5 ? -1 : 1;
      const p = mesh(new THREE.DodecahedronGeometry(0.1 + r() * 0.12, 0), M.color(['#b9b0a2', '#9d978c', '#cfc6b5'][i % 3], 1), streamX(z) + s * (0.95 + r() * 0.3), 0.04, z, { cast: false });
      p.scale.y = 0.5;
      scene.add(p);
    }
    // 물 = 장애물 (다리만 건널 수 있음)
    for (let z = WORLD.minZ; z < WORLD.maxZ; z += 0.8) {
      const zm = z + 0.4;
      if (BRIDGES.some(([a, b]) => zm > a && zm < b)) continue;
      const x = streamX(zm);
      obst(x - 0.85, x + 0.85, z, z + 0.8).water = true;
    }
    for (const [a, b] of BRIDGES) {
      const zc = (a + b) / 2, xc = streamX(zc);
      const g2 = new THREE.Group();
      for (let i = 0; i < 11; i++) {
        const t2 = i / 10 - 0.5;
        g2.add(mesh(rbox(0.26, 0.07, b - a - 0.2, 0.015), M.woodMid(), t2 * 2.6, 0.12 + Math.cos(t2 * Math.PI) * 0.14, 0));
      }
      for (const s of [-1, 1]) {
        const rail = mesh(rbox(2.8, 0.06, 0.06, 0.02), M.woodDark(), 0, 0.85, s * (b - a - 0.2) / 2);
        g2.add(rail);
        for (const px of [-1.3, 0, 1.3]) g2.add(mesh(rbox(0.06, 0.7, 0.06, 0.015), M.woodDark(), px, 0.5, s * (b - a - 0.2) / 2));
      }
      g2.position.set(xc, 0, zc);
      scene.add(g2);
      // 난간 = 장애물
      obst(xc - 1.4, xc + 1.4, a - 0.05, a + 0.08);
      obst(xc - 1.4, xc + 1.4, b - 0.08, b + 0.05);
      excl.push([xc, zc, 2.2]);
    }
    room.stream = { x: streamX };
  }
  // 시냇가 바위 (앉는 자리)
  const rockMat = new THREE.MeshStandardMaterial({ map: stoneTexture('#a59a8c', 23), roughness: 1 });
  const sitRock = (x, z, rotY, name, nook = true) => {
    const rk = mesh(new THREE.DodecahedronGeometry(0.45, 1), rockMat, x, 0.12, z);
    rk.scale.set(1.2, 0.62, 1.0);
    rk.rotation.y = r() * 3;
    scene.add(rk);
    obst(x - 0.38, x + 0.38, z - 0.34, z + 0.34);
    excl.push([x, z, 1.4]);
    return addSeat(room, x, 0.58, z, rotY, { name, nook, appr: -0.62 });
  };
  for (const z of [-2.7, -1.3, 0.1]) sitRock(streamX(z) - 1.45, z, Math.PI / 2, '시냇가 바위');
  for (const z of [7.7, 9.1]) sitRock(streamX(z) - 1.45, z, Math.PI / 2, '시냇가 바위');
  for (const z of [-2.0, 9.8]) sitRock(streamX(z) + 1.45, z, -Math.PI / 2, '건너편 물가 바위');
  // 고양이 볕 쬐는 넓적 바위
  room.sunRocks = [];
  for (const [x, z] of [[25.2, -3.0], [22.6, 6.8], [10.6, 3.2]]) {
    const rk = mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.3, 9), rockMat, x, 0.15, z);
    rk.rotation.y = r() * 3;
    scene.add(rk);
    obst(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
    excl.push([x, z, 1.3]);
    room.sunRocks.push({ floor: V(x + 0.9, 0, z + 0.3), top: V(x, 0.31, z) });
  }

  // ---------- 덤불 (인스턴스로 가볍게) ----------
  const bushes = [];
  const addBush = (x, z, s = 1, solid = true) => {
    bushes.push([x, z, s]);
    if (solid) obst(x - 0.42 * s, x + 0.42 * s, z - 0.42 * s, z + 0.42 * s);
  };
  // 둘레에 덤불을 둘러 숨은 자리로 (입구 쪽 gap 만 비움)
  const ring = (cx, cz, rad, gapAng, gapW = 0.9, step = 0.75) => {
    const n = Math.ceil(Math.PI * 2 * rad / step);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      let d = Math.abs(((a - gapAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < gapW) continue;
      addBush(cx + Math.cos(a) * rad + (r() - 0.5) * 0.2, cz + Math.sin(a) * rad + (r() - 0.5) * 0.2, 0.9 + r() * 0.5);
    }
    excl.push([cx, cz, rad + 0.8]);
  };

  // ---------- 덤불 뒤 벤치 (네 곳) ----------
  const hiddenBench = (x, z, rotY, gapAng, name) => {
    bench(scene, room, x, z, rotY, 1.4, 2, { name, nook: true, mat: M.wood() });
    ring(x, z, 1.9, gapAng, 0.75);
  };
  hiddenBench(8.6, -6.4, Math.PI, Math.PI / 2, '덤불 뒤 벤치');           // 북쪽, 입구 남쪽
  hiddenBench(7.4, 6.6, 0, -Math.PI / 2, '덤불 뒤 벤치');                  // 남쪽, 입구 북쪽
  hiddenBench(19.6, -9.0, -Math.PI / 2, Math.PI, '자작나무 숲 벤치');      // 입구 서쪽
  hiddenBench(31.4, -1.6, Math.PI / 2, -Math.PI / 2, '물가 덤불 벤치');    // 입구 북쪽

  // ---------- 해먹 숲 ----------
  const trees = []; // [x, z, kind, scale]
  {
    const cxh = 15.0, czh = -12.6;
    const ham = (x, z, rotY) => {
      const g = new THREE.Group();
      const L = 2.4;
      for (const s of [-1, 1]) {
        trees.push([x + Math.cos(rotY) * s * L / 2, z - Math.sin(rotY) * s * L / 2, 'broad', 0.85]);
      }
      const pts = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(V((t - 0.5) * (L - 0.4), 1.15 - Math.sin(t * Math.PI) * 0.6, 0)); }
      const curve = new THREE.CatmullRomCurve3(pts);
      const fab = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.22, 8), M.fabric(['#d97c5c', '#e8c86a', '#7f97a8', '#a9bba0'][Math.floor(r() * 4)]));
      fab.scale.z = 1.6;
      fab.castShadow = true;
      g.add(fab);
      for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), M.color('#d9c7a5'), s * (L / 2 - 0.25), 1.2, 0));
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      scene.add(g);
      obst(...Object.values(footprint(x, z, L - 0.6, 0.7, rotY)));
      const f = V(Math.sin(rotY), 0, Math.cos(rotY));
      addSeat(room, x, 0.62, z, rotY, { name: '나무 그늘 해먹', nook: true, kind: 'hammock', appr: 0.7 });
      anim.push((dt, t) => { g.rotation.z = Math.sin(t * 0.9 + x) * 0.03; });
      void f;
    };
    ham(cxh - 1.6, czh + 0.4, 0.15);
    ham(cxh + 1.4, czh - 0.6, -0.25);
    ham(cxh + 0.2, czh + 2.4, Math.PI - 0.1);
    ham(cxh - 3.0, czh - 1.8, 0.7);
    stool(scene, room, cxh, czh, 0, 0.42, '#b88a5a', { name: '해먹 숲 그루터기' });
    ring(cxh, czh, 4.2, Math.PI * 0.35, 0.55, 0.9);
  }

  // ---------- 정자 ----------
  {
    const cxg = 35.6, czg = 3.0, R = 2.1;
    const g = new THREE.Group();
    const fl = mesh(new THREE.CylinderGeometry(R + 0.2, R + 0.3, 0.12, 8), M.woodLight(), 0, 0.06, 0, { cast: false });
    g.add(fl);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + Math.PI / 8;
      g.add(mesh(rbox(0.16, 2.5, 0.16, 0.03), M.woodDark(), Math.cos(a) * R, 1.25, Math.sin(a) * R));
      obst(cxg + Math.cos(a) * R - 0.12, cxg + Math.cos(a) * R + 0.12, czg + Math.sin(a) * R - 0.12, czg + Math.sin(a) * R + 0.12);
    }
    const roofG = new THREE.Group();
    const rf = mesh(new THREE.ConeGeometry(R + 0.9, 1.4, 8, 1), M.color('#7a4b36', 0.9), 0, 3.2, 0);
    rf.rotation.y = Math.PI / 8;
    roofG.add(rf);
    roofG.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), M.woodDark(), 0, 3.95, 0));
    roofG.traverse((o) => { o.userData.noHit = true; });
    g.add(roofG);
    // 등
    const lm = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffc766', emissiveIntensity: 0.1 });
    g.add(mesh(rbox(0.22, 0.28, 0.22, 0.05), lm, 0, 2.2, 0, { cast: false }));
    const light = new THREE.PointLight('#ffbb66', 0, 6, 1.7);
    light.position.set(0, 2.1, 0);
    g.add(light);
    const gl = glowSprite('#ffcf7a', 1.6); gl.position.set(0, 2.2, 0); g.add(gl);
    room.nightParts.push((dt, t, n) => { lm.emissiveIntensity = 0.1 + n * 1.6; light.intensity = n * 6; gl.material.opacity = n * 0.6; });
    // 가운데 작은 상
    g.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16), M.wood(), 0, 0.42, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8), M.woodMid(), 0, 0.2, 0));
    g.position.set(cxg, 0, czg);
    scene.add(g);
    obst(cxg - 0.45, cxg + 0.45, czg - 0.45, czg + 0.45);
    room.gazebo = { x: cxg, z: czg, r: R + 0.6, roof: roofG };
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      if (Math.abs(Math.cos(a) + 1) < 0.1) continue; // 서쪽은 입구
      const sx = cxg + Math.cos(a) * (R - 0.45), sz = czg + Math.sin(a) * (R - 0.45);
      const rot = face(sx, sz, cxg, czg);
      const bg = new THREE.Group();
      plank(bg, 0.9, 0.06, 0.42, 0, 0.45, 0, M.woodMid(), 0.02);
      for (const s of [-1, 1]) plank(bg, 0.06, 0.42, 0.36, s * 0.35, 0.22, 0, M.woodDark(), 0.015);
      bg.position.set(sx, 0.06, sz);
      bg.rotation.y = rot;
      scene.add(bg);
      obst(...Object.values(footprint(sx, sz, 0.8, 0.4, rot)));
      addSeat(room, sx, 0.56, sz, rot, { name: '작은 정자', appr: 0.55 });
    }
    excl.push([cxg, czg, R + 1.5]);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.3; if (Math.cos(a) < -0.6) continue; addBush(cxg + Math.cos(a) * (R + 1.2), czg + Math.sin(a) * (R + 1.2), 0.9 + r() * 0.4); }
  }

  // ---------- 들꽃 언덕 ----------
  const flowers = [];
  {
    const cxf = 21.2, czf = 12.6;
    const hill = mesh(new THREE.SphereGeometry(4.2, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: grassTexture('#a9c47c', 33), roughness: 1 }), cxf, -0.02, czf, { cast: false });
    hill.scale.y = 0.018;
    scene.add(hill);
    const blanket = (x, z, rotY, col) => {
      const b = mesh(rbox(1.6, 0.02, 1.2, 0.02), M.fabric(col), x, 0.085, z, { cast: false });
      b.rotation.y = rotY;
      scene.add(b);
      const ax = V(Math.cos(rotY), 0, -Math.sin(rotY));
      for (const s of [-0.4, 0.4]) addSeat(room, x + ax.x * s, 0.1, z + ax.z * s, rotY + Math.PI, { name: '들꽃 언덕 돗자리', kind: 'floor', appr: 0.5 });
    };
    blanket(cxf - 1.4, czf - 0.6, 0.2, '#d97c5c');
    blanket(cxf + 1.3, czf + 0.3, -0.4, '#e8c86a');
    blanket(cxf - 0.2, czf + 1.9, 0.9, '#7f97a8');
    stool(scene, room, cxf + 2.6, czf - 1.8, face(cxf + 2.6, czf - 1.8, cxf, czf), 0.4, '#b88a5a', { name: '언덕 그루터기' });
    excl.push([cxf, czf, 4.0]);
    for (let i = 0; i < 700; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 6.5;
      flowers.push([cxf + Math.cos(a) * d, czf + Math.sin(a) * d * 0.8]);
    }
    for (let i = 0; i < 10; i++) { const a = -Math.PI * 0.2 + i / 10 * Math.PI * 1.2; addBush(cxf + Math.cos(a) * 5.2, czf + Math.sin(a) * 4.6, 1.0 + r() * 0.4); }
  }
  // 길가 들꽃
  for (let i = 0; i < 500; i++) {
    const x = CABIN.maxX + 1 + r() * (WORLD.maxX - CABIN.maxX - 2), z = WORLD.minZ + r() * (WORLD.maxZ - WORLD.minZ);
    const d = distPaths(x, z);
    if (d > 0.7 && d < 2.2) flowers.push([x, z]);
  }

  // ---------- 큰 나무 + 그네 + 등받이 의자 ----------
  {
    const tx = 17.6, tz = 5.8;
    const t = new THREE.Group();
    const bark = M.color('#7d5f44', 1);
    t.add(mesh(new THREE.CylinderGeometry(0.32, 0.5, 3.2, 12), bark, 0, 1.6, 0));
    const br = mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.9, 8), bark, 0.85, 3.0, 0.25);
    br.rotation.z = -0.95;
    t.add(br);
    const canopy = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2, rr = 0.3 + r() * 1.4;
      canopy.add(mesh(new THREE.IcosahedronGeometry(0.85 + r() * 0.5, 1), M.color(['#86ad6c', '#97bd78', '#7aa261', '#a6c98a'][i % 4], 1), Math.cos(a) * rr + 0.4, 3.6 + r() * 1.1, Math.sin(a) * rr * 0.8));
    }
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
    armchair(scene, room, tx - 1.4, tz + 1.3, face(tx - 1.4, tz + 1.3, tx, tz + 4), '#c7a06b', { name: '큰 나무 아래 의자' });
    armchair(scene, room, tx + 0.2, tz + 1.8, face(tx + 0.2, tz + 1.8, tx, tz + 4), '#d9a07a', { name: '큰 나무 아래 의자' });
    excl.push([tx, tz, 3.0]);
  }

  // ---------- 나무 위 오두막 ----------
  const th = new THREE.Group();
  {
    const R = TREEHOUSE.rect, Y = TREEHOUSE.y;
    const cxt = (R.minX + R.maxX) / 2, czt = (R.minZ + R.maxZ) / 2;
    const w = R.maxX - R.minX + 0.2, d = R.maxZ - R.minZ + 0.2;
    // 나무 (가운데를 뚫고 올라감)
    const tx = 35.0, tz = -10.6;
    const bark = M.color('#6e5440', 1);
    scene.add(mesh(new THREE.CylinderGeometry(0.4, 0.6, 7.5, 12), bark, tx, 3.75, tz));
    obst(tx - 0.6, tx + 0.6, tz - 0.6, tz + 0.6);
    obst(tx - 0.5, tx + 0.5, tz - 0.5, tz + 0.5, 2);
    const canopy = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, rr = 0.4 + r() * 2.0;
      canopy.add(mesh(new THREE.IcosahedronGeometry(1.0 + r() * 0.6, 1), M.color(['#6f9a5e', '#82ab6a', '#5f8a52', '#94b97a'][i % 4], 1), Math.cos(a) * rr, 6.2 + r() * 1.6, Math.sin(a) * rr));
    }
    canopy.traverse((o) => { o.userData.noHit = true; });
    canopy.position.set(tx, 0, tz);
    scene.add(canopy);
    room.bigCanopies.push({ g: canopy, x: tx, z: tz, k: 1 });
    // 바닥 판
    const fl = mesh(rbox(w, 0.16, d, 0.03), M.woodMid(), cxt, Y - 0.08, czt);
    fl.name = 'treehouseFloor';
    th.add(fl);
    // 기둥 (땅)
    for (const [px, pz] of [[R.minX + 0.1, R.minZ + 0.1], [R.maxX - 0.1, R.minZ + 0.1], [R.minX + 0.1, R.maxZ - 0.1], [R.maxX - 0.1, R.maxZ - 0.1]]) {
      scene.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, Y, 8), M.woodDark(), px, Y / 2, pz));
      obst(px - 0.14, px + 0.14, pz - 0.14, pz + 0.14);
    }
    // 작은 집 (북쪽 반)
    const wallM = M.woodLight();
    th.add(mesh(rbox(w, 1.7, 0.1, 0.02), wallM, cxt, Y + 0.85, R.minZ + 0.05));
    th.add(mesh(rbox(0.1, 1.7, d * 0.55, 0.02), wallM, R.minX + 0.05, Y + 0.85, R.minZ + d * 0.275));
    th.add(mesh(rbox(0.1, 1.7, d * 0.55, 0.02), wallM, R.maxX - 0.05, Y + 0.85, R.minZ + d * 0.275));
    const hroof = mesh(new THREE.ConeGeometry(2.5, 1.2, 4), M.color('#8a4b36', 0.9), cxt, Y + 2.3, czt - 0.3);
    hroof.rotation.y = Math.PI / 4;
    hroof.userData.noHit = true;
    th.add(hroof);
    room.treehouseRoof = hroof;
    // 난간 (남쪽, 사다리 자리는 비움)
    for (let x = R.minX + 0.1; x < R.maxX; x += 0.3) {
      if (x > TREEHOUSE.ramp.minX - 0.05 && x < TREEHOUSE.ramp.maxX + 0.05) continue;
      th.add(mesh(rbox(0.04, 0.8, 0.04, 0.01), M.woodDark(), x, Y + 0.4, R.maxZ - 0.03));
    }
    th.add(mesh(rbox(TREEHOUSE.ramp.minX - R.minX, 0.06, 0.06, 0.02), M.woodDark(), (R.minX + TREEHOUSE.ramp.minX) / 2, Y + 0.8, R.maxZ - 0.03));
    th.add(mesh(rbox(R.maxX - TREEHOUSE.ramp.maxX, 0.06, 0.06, 0.02), M.woodDark(), (R.maxX + TREEHOUSE.ramp.maxX) / 2, Y + 0.8, R.maxZ - 0.03));
    // 등
    const lm = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffc766', emissiveIntensity: 0.1 });
    th.add(mesh(rbox(0.2, 0.26, 0.2, 0.05), lm, cxt + 0.9, Y + 1.5, R.minZ + 0.25, { cast: false }));
    const light = new THREE.PointLight('#ffbb66', 0, 5, 1.7);
    light.position.set(cxt + 0.9, Y + 1.3, R.minZ + 0.5);
    th.add(light);
    room.nightParts.push((dt, t, n) => { lm.emissiveIntensity = 0.1 + n * 1.7; light.intensity = n * 5; });
    scene.add(th);
    // 사다리 계단
    const RR = TREEHOUSE.ramp;
    const len = RR.bottom - RR.top;
    for (let i = 0; i < 10; i++) {
      const y = Y * (i + 1) / 10, z = RR.bottom - len * (i + 0.5) / 10;
      scene.add(mesh(rbox(RR.maxX - RR.minX, 0.05, len / 10 + 0.03, 0.01), M.wood(), (RR.minX + RR.maxX) / 2, y - 0.03, z));
    }
    const ang = Math.atan2(Y, len), sl = Math.hypot(Y, len);
    for (const xx of [RR.minX, RR.maxX]) {
      const s = mesh(rbox(0.06, 0.22, sl, 0.02), M.woodDark(), xx, Y / 2, (RR.top + RR.bottom) / 2);
      s.rotation.x = ang;
      scene.add(s);
      const rl = mesh(rbox(0.04, 0.04, sl, 0.01), M.woodDark(), xx, Y / 2 + 0.8, (RR.top + RR.bottom) / 2);
      rl.rotation.x = ang;
      scene.add(rl);
    }
    room.obstacles.push({ minX: RR.minX - 0.1, maxX: RR.maxX + 0.1, minZ: RR.top, maxZ: RR.bottom - 0.5 });
    // 앉을 자리 (2층)
    const o = { fy: Y, lv: 2 };
    const start = room.seats.length;
    cushion(th, room, 33.95, -9.1, Math.PI / 2, '#d97c5c', { ...o, name: '나무 위 오두막', nook: true });
    cushion(th, room, 33.95, -10.2, Math.PI / 2, '#e8c86a', { ...o, name: '나무 위 오두막', nook: true });
    cushion(th, room, 36.05, -9.1, -Math.PI / 2, '#7f97a8', { ...o, name: '나무 위 오두막', nook: true });
    cushion(th, room, 36.05, -10.2, -Math.PI / 2, '#a9bba0', { ...o, name: '나무 위 오두막', nook: true });
    beanbag(th, room, 34.0, -11.1, face(34, -11.1, 35, -9), '#c98f6b', { ...o, name: '나무 위 오두막 창가', nook: true });
    beanbag(th, room, 36.0, -11.1, face(36, -11.1, 35, -9), '#b6a27c', { ...o, name: '나무 위 오두막 창가', nook: true });
    for (let i = start; i < room.seats.length; i++) room.seats[i].treehouse = true;
    room.hideables.push({ group: th, rect: R, lv: 2 });
    excl.push([cxt, czt, 3.2], [35, -6.8, 1.6]);
  }

  // ---------- 모닥불 통나무 자리 ----------
  {
    const cxl = 34.6, czl = 11.9;
    const ringStones = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const s = mesh(new THREE.DodecahedronGeometry(0.14, 0), rockMat, Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5);
      s.scale.y = 0.7;
      ringStones.add(s);
    }
    const fm = new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: '#ff8a2a', emissiveIntensity: 0 });
    const flames = [];
    for (let i = 0; i < 4; i++) { const f = mesh(new THREE.ConeGeometry(0.12, 0.45, 8), fm, (i % 2 - 0.5) * 0.15, 0.3, (i > 1 ? 0.07 : -0.07), { cast: false }); ringStones.add(f); flames.push(f); }
    for (let i = 0; i < 3; i++) { const l = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 8), M.woodMid(), 0, 0.1, 0); l.rotation.set(Math.PI / 2, i * 1.05, 0); ringStones.add(l); }
    const light = new THREE.PointLight('#ff8c3a', 0, 8, 1.6);
    light.position.set(0, 0.6, 0);
    ringStones.add(light);
    const gl = glowSprite('#ff9a4a', 2.2); gl.position.set(0, 0.5, 0); ringStones.add(gl);
    ringStones.position.set(cxl, 0, czl);
    scene.add(ringStones);
    obst(cxl - 0.65, cxl + 0.65, czl - 0.65, czl + 0.65);
    room.campfire = V(cxl, 0, czl);
    room.nightParts.push((dt, t, n) => {
      const f = 0.85 + Math.sin(t * 7.3) * 0.1 + Math.sin(t * 12.1) * 0.06;
      fm.emissiveIntensity = n * 2 * f;
      light.intensity = n * 9 * f;
      gl.material.opacity = n * 0.7 * f;
      flames.forEach((fl, i) => { fl.visible = n > 0.3; fl.scale.y = 0.8 + Math.sin(t * 9 + i * 2) * 0.3; });
    });
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2 + Math.PI / 4;
      const lx = cxl + Math.cos(a) * 1.75, lz = czl + Math.sin(a) * 1.75;
      const rot = face(lx, lz, cxl, czl);
      const lg = mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.5, 10).rotateZ(Math.PI / 2), M.color('#8b6a4a', 1), lx, 0.22, lz);
      lg.rotation.y = rot;
      scene.add(lg);
      obst(...Object.values(footprint(lx, lz, 1.5, 0.46, rot)));
      const ax = V(Math.cos(rot), 0, -Math.sin(rot));
      for (const s of [-0.35, 0.35]) addSeat(room, lx + ax.x * s, 0.48, lz + ax.z * s, rot, { name: '모닥불 통나무', appr: -0.55 });
    }
    ring(cxl, czl, 3.4, Math.PI * 1.25, 0.6, 0.85);
  }

  // ---------- 길가 그루터기 ----------
  const stumpSpots = [[10.2, 1.4], [14.0, -3.0], [12.0, 3.4], [16.2, -2.8], [21.6, -3.4], [22.0, 3.7], [26.4, 5.2], [31.4, 5.4], [33.8, -4.8], [16.4, 8.9], [13.8, -6.0], [24.3, 10.6]];
  for (const [x, z] of stumpSpots) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.42, 12), M.color('#8b6a4a', 1), 0, 0.21, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.01, 12), M.color('#d8b98a', 1), 0, 0.425, 0, { cast: false }));
    g.position.set(x, 0, z);
    scene.add(g);
    obst(x - 0.26, x + 0.26, z - 0.26, z + 0.26);
    // 길을 등지고 숲을 바라봄
    let best = 1e9, bx = x, bz = z;
    for (const P of PATHS) for (const [px, pz] of P) { const d = Math.hypot(px - x, pz - z); if (d < best) { best = d; bx = px; bz = pz; } }
    addSeat(room, x, 0.48, z, face(bx, bz, x, z), { name: '길가 그루터기', appr: -0.5 });
    excl.push([x, z, 1.0]);
  }

  // ---------- 나무 심기 ----------
  const okTree = (x, z, rad = 1.4) => {
    if (x > CABIN.minX - 1 && x < CABIN.maxX + 1.2 && z > CABIN.minZ - 1.2 && z < CABIN.maxZ + 1.2) return false;
    if (distPaths(x, z) < rad + 0.2) return false;
    if (Math.abs(x - streamX(z)) < 1.9) return false;
    for (const [ex, ez, er] of excl) if (Math.hypot(x - ex, z - ez) < er) return false;
    for (const t of trees) if (Math.hypot(x - t[0], z - t[1]) < 1.5) return false;
    return true;
  };
  // 정원 안
  for (let i = 0; i < 2600 && trees.length < 260; i++) {
    const x = CABIN.maxX + 1.5 + r() * (WORLD.maxX - CABIN.maxX - 1.5), z = WORLD.minZ + 0.5 + r() * (WORLD.maxZ - WORLD.minZ - 1);
    if (!okTree(x, z)) continue;
    const kind = x > 17 && x < 23 && z < -6 ? 'birch' : r() < 0.42 ? 'pine' : 'broad';
    trees.push([x, z, kind, 0.8 + r() * 0.5]);
  }
  const inner = trees.length;
  // 판 바깥 숲 (안 들어가는 곳): 오두막 남 · 북쪽과 가장자리
  for (let i = 0; i < 3000 && trees.length < inner + 230; i++) {
    const x = G0.minX + 2 + r() * (gw - 4), z = G0.minZ + 2 + r() * (gd - 4);
    const inside = x > WORLD.minX - 0.5 && x < WORLD.maxX + 0.5 && z > WORLD.minZ - 0.5 && z < WORLD.maxZ + 0.5;
    const nearCabin = x > CABIN.minX - 3 && x < CABIN.maxX + 0.5 && z > CABIN.minZ - 2.5 && z < CABIN.maxZ + 2.5;
    const aroundCabin = x < CABIN.maxX && !nearCabin;
    if ((inside && !aroundCabin) || nearCabin) continue;
    if (Math.abs(x - streamX(z)) < 1.8) continue;
    if (trees.some((t) => Math.hypot(x - t[0], z - t[1]) < 1.7)) continue;
    trees.push([x, z, r() < 0.55 ? 'pine' : 'broad', 0.9 + r() * 0.6, true]);
  }
  // 나무 줄기 = 장애물 (판 안에 있는 것)
  for (const [x, z, , s, outside] of trees) if (!outside) obst(x - 0.25 * s, x + 0.25 * s, z - 0.25 * s, z + 0.25 * s);
  // 덤불을 숲에 흩뿌림
  for (let i = 0; i < 900 && bushes.length < 330; i++) {
    const x = CABIN.maxX + 1.5 + r() * (WORLD.maxX - CABIN.maxX - 1.5), z = WORLD.minZ + 0.5 + r() * (WORLD.maxZ - WORLD.minZ - 1);
    if (distPaths(x, z) < 1.3 || Math.abs(x - streamX(z)) < 1.6) continue;
    if (excl.some(([ex, ez, er]) => Math.hypot(x - ex, z - ez) < er)) continue;
    if (trees.some((t) => Math.hypot(x - t[0], z - t[1]) < 0.8)) continue;
    addBush(x, z, 0.7 + r() * 0.6, r() < 0.7);
  }

  // 인스턴스 메시로 그리기
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 1, 7);
  trunkGeo.translate(0, 0.5, 0);
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
  const canopyOf = []; // 나무별 잎 인스턴스
  trees.forEach(([x, z, kind, s], i) => {
    const h = kind === 'pine' ? 1.4 * s : kind === 'birch' ? 3.0 * s : 2.0 * s;
    ps.set(x, 0, z); q.identity(); sc.set(s, h, s);
    trunks.setMatrixAt(i, m4.compose(ps, q, sc));
    trunks.setColorAt(i, col.set(kind === 'birch' ? '#ece6da' : '#7d5f44').offsetHSL(0, 0, (r() - 0.5) * 0.06));
    const parts = [];
    if (kind === 'pine') {
      for (let k = 0; k < 3; k++) {
        const cs = (1.5 - k * 0.38) * s;
        const base = { p: V(x, h + 0.7 * s + k * 1.0 * s, z), s: V(cs, cs * 1.0, cs), q: new THREE.Quaternion() };
        cones.setMatrixAt(ci, m4.compose(base.p, base.q, base.s));
        cones.setColorAt(ci, col.set(['#4f7a52', '#5d8a5a', '#47704a'][k]).offsetHSL(0, 0, (r() - 0.5) * 0.08));
        parts.push({ mesh: cones, i: ci++, ...base });
      }
    } else {
      const nb = kind === 'birch' ? 3 : 4;
      for (let k = 0; k < nb; k++) {
        const a = r() * Math.PI * 2, rr = k === 0 ? 0 : 0.5 * s;
        const bs = (kind === 'birch' ? 0.75 : 1.05 + r() * 0.3) * s;
        const base = { p: V(x + Math.cos(a) * rr, h + (k === 0 ? 0.7 : 0.4 + r() * 0.6) * s, z + Math.sin(a) * rr), s: V(bs, bs * 0.85, bs), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 3, 0)) };
        blobs.setMatrixAt(bi, m4.compose(base.p, base.q, base.s));
        blobs.setColorAt(bi, col.set(kind === 'birch' ? ['#a7c47a', '#b9d08a', '#9cbd70'][k % 3] : ['#6f9a5e', '#82ab6a', '#5f8a52', '#94b97a'][k % 4]).offsetHSL(0, 0, (r() - 0.5) * 0.06));
        parts.push({ mesh: blobs, i: bi++, ...base });
      }
    }
    canopyOf.push({ x, z, parts, k: 1, h });
  });
  cones.count = ci; blobs.count = bi;
  for (const im of [trunks, cones, blobs]) { im.castShadow = true; im.receiveShadow = true; im.userData.noHit = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); }
  room.canopies = canopyOf;
  room.canopyMeshes = [cones, blobs];

  // 덤불
  const bushM = new THREE.InstancedMesh(blobGeo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), bushes.length * 2);
  let k2 = 0;
  for (const [x, z, s] of bushes) {
    for (let j = 0; j < 2; j++) {
      ps.set(x + (j ? 0.25 : -0.1) * s, 0.35 * s, z + (j ? -0.15 : 0.1) * s);
      q.setFromEuler(new THREE.Euler(0, r() * 3, 0));
      sc.set(0.5 * s, 0.42 * s * (j ? 0.8 : 1.15), 0.5 * s);
      bushM.setMatrixAt(k2, m4.compose(ps, q, sc));
      bushM.setColorAt(k2++, col.set(['#5f8a52', '#6f9a5e', '#7aa261', '#55804c'][Math.floor(r() * 4)]));
    }
  }
  bushM.castShadow = true; bushM.receiveShadow = true;
  scene.add(bushM);

  // 들꽃
  {
    const fgeo = new THREE.IcosahedronGeometry(0.06, 0);
    const fm = new THREE.InstancedMesh(fgeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), flowers.length);
    const cols = ['#f6d36b', '#f2a7a0', '#ffffff', '#c9b6e4', '#9cc3e6', '#f0a35a'];
    flowers.forEach(([x, z], i) => {
      ps.set(x, 0.12 + r() * 0.1, z); q.identity(); sc.setScalar(0.7 + r() * 0.8);
      fm.setMatrixAt(i, m4.compose(ps, q, sc));
      fm.setColorAt(i, col.set(cols[Math.floor(r() * cols.length)]));
    });
    fm.userData.noHit = true;
    scene.add(fm);
    // 풀 무더기
    const ggeo = new THREE.ConeGeometry(0.08, 0.35, 4);
    const N = 900;
    const gm = new THREE.InstancedMesh(ggeo, new THREE.MeshStandardMaterial({ color: '#7fa35e', roughness: 1 }), N);
    let n = 0;
    for (let i = 0; i < 4000 && n < N; i++) {
      const x = CABIN.maxX + 0.8 + r() * (WORLD.maxX - CABIN.maxX), z = WORLD.minZ + r() * (WORLD.maxZ - WORLD.minZ);
      if (distPaths(x, z) < 0.8 || Math.abs(x - streamX(z)) < 1.1) continue;
      ps.set(x, 0.15, z); q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4)); sc.set(1, 0.6 + r() * 0.8, 1);
      gm.setMatrixAt(n++, m4.compose(ps, q, sc));
    }
    gm.count = n;
    gm.userData.noHit = true;
    scene.add(gm);
  }

  // ---------- 길가 등불 ----------
  const lanternMats = [];
  const lanternGlows = [];
  {
    const lgeo = rbox(0.18, 0.22, 0.18, 0.04);
    let acc = 0;
    for (const P of PATHS) {
      for (let i = 0; i < P.length - 1; i++) {
        const [ax, az] = P[i], [bx, bz] = P[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        for (let t = 0; t < len; t += 0.5) {
          acc += 0.5;
          if (acc < 6.5) continue;
          acc = 0;
          const u = t / len;
          const nx = -(bz - az) / len, nz = (bx - ax) / len;
          const x = ax + (bx - ax) * u + nx * 0.95, z = az + (bz - az) * u + nz * 0.95;
          if (Math.abs(x - streamX(z)) < 1.4) continue;
          scene.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.85, 6), M.woodDark(), x, 0.42, z));
          const m = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffc766', emissiveIntensity: 0.05, roughness: 0.6 });
          scene.add(mesh(lgeo, m, x, 0.95, z, { cast: false }));
          const gl = glowSprite('#ffcf7a', 1.3);
          gl.position.set(x, 0.95, z);
          scene.add(gl);
          lanternMats.push(m); lanternGlows.push(gl);
          obst(x - 0.08, x + 0.08, z - 0.08, z + 0.08);
        }
      }
    }
  }

  // ---------- 나비(낮) · 반딧불(밤) ----------
  const FN = 140;
  const flyGeo = new THREE.BufferGeometry();
  const fp = new Float32Array(FN * 3);
  flyGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flyMat = new THREE.PointsMaterial({ color: '#fff6b0', size: 0.11, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flies = new THREE.Points(flyGeo, flyMat);
  flies.frustumCulled = false;
  scene.add(flies);
  const flySeed = Array.from({ length: FN }, () => [CABIN.maxX + 2 + r() * (WORLD.maxX - CABIN.maxX - 3), WORLD.minZ + 1 + r() * (WORLD.maxZ - WORLD.minZ - 2), r() * 6, 0.3 + r() * 0.6]);
  const butterflies = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group();
    const wm = new THREE.MeshStandardMaterial({ color: ['#f6d36b', '#f2a7a0', '#ffffff', '#9cc3e6'][i % 4], side: THREE.DoubleSide, roughness: 0.8 });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), wm);
      w.position.x = s * 0.05;
      w.rotation.x = -Math.PI / 2;
      b.add(w);
    }
    scene.add(b);
    const home = i < 3 ? V(21.2 + (r() - 0.5) * 5, 0.7, 12.6 + (r() - 0.5) * 4) : V(8 + r() * 20, 0.8, r() * 16 - 8);
    butterflies.push({ b, c: home, ph: r() * 6 });
  }

  // ---------- 비 (보는 곳 둘레만) ----------
  const RN = 700;
  const rainGeo = new THREE.BufferGeometry();
  const rp = new Float32Array(RN * 6);
  const rs = new Float32Array(RN);
  const roff = new Float32Array(RN * 2);
  for (let i = 0; i < RN; i++) {
    roff[i * 2] = (r() - 0.5) * 30; roff[i * 2 + 1] = (r() - 0.5) * 30;
    const y = r() * 7;
    rp.set([0, y, 0, -0.02, y - 0.25, 0], i * 6);
    rs[i] = 6 + r() * 2;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: '#c7d6e6', transparent: true, opacity: 0.5 });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.userData.noHit = true;
  scene.add(rain);

  room.nightParts.push((dt, t, night) => {
    for (const fn of anim) fn(dt, t);
    lanternMats.forEach((m) => { m.emissiveIntensity = 0.05 + night * 1.7; });
    lanternGlows.forEach((g) => { g.material.opacity = night * 0.65; });
    // 반딧불
    flyMat.opacity = night * 0.95 * (room.rainOn ? 0.3 : 1);
    flies.visible = night > 0.05;
    if (flies.visible) {
      for (let i = 0; i < FN; i++) {
        const [x, z, ph, sp] = flySeed[i];
        fp[i * 3] = x + Math.sin(t * sp + ph) * 0.9;
        fp[i * 3 + 1] = 0.5 + Math.sin(t * sp * 1.7 + ph) * 0.4 + 0.35;
        fp[i * 3 + 2] = z + Math.cos(t * sp * 0.8 + ph) * 0.9;
      }
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
    for (const B of birds) {
      const hide = night > 0.5 || room.rainOn || B.away > 0;
      B.away = Math.max(0, B.away - dt);
      B.b.visible = !hide;
      if (hide) continue;
      const hop = Math.max(0, Math.sin(t * 2.3 + B.ph)) ** 8 * 0.06;
      B.b.position.copy(B.home).add(V(Math.sin(t * 0.7 + B.ph) * 0.05, hop, 0));
      B.b.rotation.y = Math.sin(t * 0.9 + B.ph) * 1.5;
    }
    // 비: 카메라가 보는 곳 둘레에만, 오두막 안은 빼고
    rain.visible = !!room.rainOn;
    if (rain.visible) {
      const c = room.viewCenter || V(10, 0, 0);
      const a = rainGeo.attributes.position.array;
      for (let i = 0; i < RN; i++) {
        let y = a[i * 6 + 1] - rs[i] * dt;
        if (y < 0) y += 7;
        let x = c.x + roff[i * 2], z = c.z + roff[i * 2 + 1];
        if (x > CABIN.minX - 0.3 && x < CABIN.maxX + 0.3 && z > CABIN.minZ - 0.3 && z < CABIN.maxZ + 0.3) y = -10;
        a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z;
        a[i * 6 + 3] = x - 0.02; a[i * 6 + 4] = y - 0.25; a[i * 6 + 5] = z;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
  });
  room.scareBirds = () => { for (const B of birds) B.away = 8 + Math.random() * 6; };
  room.birdsPresent = () => birds.some((B) => B.b.visible);
  room.paths = PATHS;
  void DOOR;
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
    if (along < -rad || along > 9) return 1;
    const side = Math.abs(dx * uz - dz * ux);
    return side < rad + 0.6 ? 0.22 : 1;
  };
  for (const c of room.canopies) {
    if (Math.abs(c.x - me.x) > 11 || Math.abs(c.z - me.z) > 11) {
      if (c.k === 1) continue;
    }
    const w = Math.abs(c.x - me.x) > 11 || Math.abs(c.z - me.z) > 11 ? 1 : want(c.x, c.z, 1.4);
    if (Math.abs(c.k - w) < 0.01) { if (c.k !== w) { c.k = w; } else continue; }
    c.k += (w - c.k) * (1 - Math.exp(-6 * dt));
    if (Math.abs(c.k - w) < 0.01) c.k = w;
    for (const p of c.parts) {
      tmpS.copy(p.s).multiplyScalar(c.k);
      p.mesh.setMatrixAt(p.i, tmpM.compose(p.p, p.q, tmpS));
      dirty.add(p.mesh);
    }
  }
  for (const m of dirty) m.instanceMatrix.needsUpdate = true;
  for (const b of room.bigCanopies || []) {
    // 큰 나무는 잎 전체를 잠시 숨김
    b.g.visible = want(b.x, b.z, 2.4) === 1;
  }
}

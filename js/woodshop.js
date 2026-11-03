// 목공방 (서점 북쪽 숲, 집 둘레길과 자작나무 길 사이)
// 실제로 무언가를 만드는 곳은 아니고, 대패 · 톱 · 사포 · 끌 소리와 나무 냄새 나는 분위기를 즐기는 곳.
// - 공방지기가 지금 시각으로 정해진 차례(대패 → 톱 → 사포 → 끌, 한 바퀴 64초)로 일함 → 모든 손님이 같은 장면 · 메시지 0건
// - 한 번에 10명까지. 이미 아는 손님 위치로 각자 「만석」을 판단 (새 메시지 없음)
// - 벽의 앞치마를 누르면 입고 벗기 (다른 손님에게는 이미 있는 'hi' 의 a 칸으로)
import * as THREE from 'three';
import { M, rbox, mesh, plank, footprint, glowSprite, textSprite } from './kit.js';
import { stool } from './furniture.js';
import { Avatar } from './avatar.js';

export const SHOP = { x0: -3, x1: 6, z0: -24.5, z1: -17.5, H: 3.2, door: [0.7, 2.3] };
export const SHOP_CAP = 10;
export const inShop = (p, m = 0) => p.x > SHOP.x0 - m && p.x < SHOP.x1 + m && p.z > SHOP.z0 - m && p.z < SHOP.z1 + m && p.y < 1.5;
const BENCH = { x: 1.5, z: -22.55, y: 0.9 };
const CYCLE = 64;
export const ACTS = [
  { id: 'plane', name: '대패질', t0: 0 },
  { id: 'saw', name: '톱질', t0: 16 },
  { id: 'sand', name: '사포질', t0: 32 },
  { id: 'chisel', name: '끌질', t0: 48 },
];
export const actAt = (T) => { const u = ((T % CYCLE) + CYCLE) % CYCLE; const a = [...ACTS].reverse().find((x) => u >= x.t0); return { act: a, u: u - a.t0 }; };

function plankTexture(base, seed) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let x = 0; x < 256; x += 32) { g.fillStyle = 'rgba(60,35,20,0.35)'; g.fillRect(x, 0, 2, 256); for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(90,55,30,${0.08 + r() * 0.12})`; g.beginPath(); const xx = x + 4 + r() * 24; g.moveTo(xx, 0); g.bezierCurveTo(xx + r() * 6 - 3, 80, xx + r() * 6 - 3, 170, xx, 256); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildWoodshop(scene, room, { obst, excl }) {
  const { x0, x1, z0, z1, H } = SHOP;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
  excl.push([cx, cz, 6.2]);
  room.buildingRects = room.buildingRects || [];
  room.buildingRects.push({ minX: x0 - 1.2, maxX: x1 + 1.2, minZ: z0 - 1.2, maxZ: z1 + 2.5 });
  const wallTex = plankTexture('#9b6a43', 11); wallTex.repeat.set(2, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  const inMat = new THREE.MeshStandardMaterial({ map: plankTexture('#c9996a', 5), roughness: 0.9 });
  const frame = M.woodDark();
  // 바닥 (넓은 마루 + 톱밥 얼룩)
  const floorTex = plankTexture('#b8875a', 3); floorTex.repeat.set(3, 2);
  scene.add(mesh(new THREE.BoxGeometry(W + 0.4, 0.1, D + 0.4), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }), cx, 0.0, cz, { cast: false }));
  for (let i = 0; i < 9; i++) { const d = mesh(new THREE.CircleGeometry(0.3 + Math.random() * 0.4, 14).rotateX(-Math.PI / 2), M.color('#e3c79a', 1, { transparent: true, opacity: 0.55 }), x0 + 1 + Math.random() * (W - 2), 0.052, z0 + 1 + Math.random() * (D - 2), { cast: false }); d.userData.noHit = true; scene.add(d); }
  // 벽: 잘라 보기(카메라 쪽 벽 접기)에 등록
  const makeWall = (normal, at, along, a0, a1, gaps = [], wins = []) => {
    const g = new THREE.Group();
    const pieces = [];
    let st = a0;
    for (const [g0, g1] of gaps) { if (g0 > st) pieces.push([st, g0, 0, H]); pieces.push([g0, g1, 2.3, H]); st = g1; }
    if (a1 > st) pieces.push([st, a1, 0, H]);
    const T = 0.16, off = at + (normal.x + normal.z) * T / 2;
    for (const [p0, p1, y0, y1] of pieces) {
      const len = p1 - p0, mid = (p0 + p1) / 2, hh = y1 - y0;
      // 창문 자리 (가운데가 빛나는 유리)
      g.add(mesh(along === 'x' ? new THREE.BoxGeometry(len, hh, T) : new THREE.BoxGeometry(T, hh, len), wallMat, along === 'x' ? mid : off, (y0 + y1) / 2, along === 'x' ? off : mid, { cast: false }));
      g.add(mesh(along === 'x' ? new THREE.BoxGeometry(len, hh, 0.02) : new THREE.BoxGeometry(0.02, hh, len), inMat, along === 'x' ? mid : at - normal.x * 0.012, (y0 + y1) / 2, along === 'x' ? at - normal.z * 0.012 : mid, { cast: false }));
    }
    for (const [w0, w1] of wins) {
      const len = w1 - w0, mid = (w0 + w1) / 2;
      const glass = new THREE.MeshStandardMaterial({ color: '#cfe3e8', emissive: '#ffd59a', emissiveIntensity: 0, transparent: true, opacity: 0.55, roughness: 0.1 });
      g.add(mesh(along === 'x' ? new THREE.BoxGeometry(len, 1.0, 0.04) : new THREE.BoxGeometry(0.04, 1.0, len), glass, along === 'x' ? mid : off + (normal.x + normal.z) * 0.09, 1.65, along === 'x' ? off + (normal.x + normal.z) * 0.09 : mid, { cast: false }));
      for (const k of [0, 0.5, 1]) g.add(mesh(along === 'x' ? new THREE.BoxGeometry(0.05, 1.06, 0.06) : new THREE.BoxGeometry(0.06, 1.06, 0.05), frame, along === 'x' ? w0 + len * k : off + (normal.x + normal.z) * 0.1, 1.65, along === 'x' ? off + (normal.x + normal.z) * 0.1 : w0 + len * k));
      room.nightParts.push((dt, t, n) => { glass.emissiveIntensity = n * 0.9; });
    }
    scene.add(g);
    room.walls.push({ group: g, normal, at, opacity: 1, span: [ (along === 'x' ? x0 : z0) - 0.5, (along === 'x' ? x1 : z1) + 0.5], spanAxis: along === 'x' ? 'x' : 'z', box: SHOP });
    // 장애물 (문 자리는 비움)
    let s0 = a0 - 0.1;
    for (const [g0, g1] of [...gaps, [a1 + 0.1, a1 + 0.1]]) {
      if (g0 > s0) obst(along === 'x' ? s0 : at - 0.12, along === 'x' ? g0 : at + 0.12, along === 'x' ? at - 0.12 : s0, along === 'x' ? at + 0.12 : g0);
      s0 = g1;
    }
  };
  makeWall(new THREE.Vector3(0, 0, -1), z0, 'x', x0, x1, [], [[-1.8, -0.2], [3.2, 4.8]]);
  makeWall(new THREE.Vector3(0, 0, 1), z1, 'x', x0, x1, [SHOP.door], [[-2.2, -0.6], [3.6, 5.2]]);
  makeWall(new THREE.Vector3(-1, 0, 0), x0, 'z', z0, z1, [], [[-22.6, -20.0]]);
  makeWall(new THREE.Vector3(1, 0, 0), x1, 'z', z0, z1, [], [[-23.4, -21.4]]);
  // 지붕 (박공) — 안에 들어가면 접힘
  const roof = new THREE.Group();
  const rise = 1.3, half = D / 2 + 0.5, slope = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  const roofMat = new THREE.MeshStandardMaterial({ map: plankTexture('#5e4331', 21), roughness: 0.95 });
  for (const sgn of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(W + 0.9, 0.12, slope), roofMat, cx, H + rise / 2, cz + sgn * half / 2); p.rotation.x = sgn * ang; roof.add(p); }
  for (const xx of [x0, x1]) { const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rise); tri.closePath(); const gm = new THREE.Mesh(new THREE.ShapeGeometry(tri), wallMat); gm.rotation.y = Math.PI / 2; gm.position.set(xx, H, cz); roof.add(gm); }
  scene.add(roof);
  (room.roofs ||= []).push({ g: roof, rect: { minX: x0 - 0.3, maxX: x1 + 0.3, minZ: z0 - 0.3, maxZ: z1 + 0.3 } });
  // 처마 아래 간판
  const sign = textSprite('🪚 목공방 · 한 번에 10명', { height: 0.22, bg: 'rgba(240,226,196,0.95)', color: '#4a3426', border: 'rgba(90,60,40,0.5)' });
  sign.position.set(1.5, 2.75, z1 + 0.25); sign.userData.noHit = true; roof.add(sign);   // 안에 들어가면 지붕과 함께 접힘

  // ---------- 작업대 + 바이스 + 나무판 ----------
  const bench = new THREE.Group();
  plank(bench, 2.6, 0.09, 0.8, 0, 0.86, 0, M.woodLight(), 0.01);
  for (const sx of [-1.15, 1.15]) for (const sz of [-0.3, 0.3]) plank(bench, 0.09, 0.82, 0.09, sx, 0.41, sz, M.woodMid(), 0.01);
  plank(bench, 2.4, 0.06, 0.6, 0, 0.18, 0, M.woodMid(), 0.01);
  bench.add(mesh(rbox(0.16, 0.16, 0.12, 0.02), M.color('#4f5458', 0.4, { metalness: 0.6 }), 1.25, 0.8, 0.42));
  bench.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6).rotateZ(Math.PI / 2), M.color('#8a8f94', 0.3, { metalness: 0.7 }), 1.25, 0.8, 0.52));
  const board = mesh(new THREE.BoxGeometry(1.5, 0.05, 0.22), M.woodLight(), -0.2, 0.935, 0.05);
  bench.add(board);
  // 대팻밥 · 연필 · 자
  for (let i = 0; i < 16; i++) { const curl = mesh(new THREE.TorusGeometry(0.025 + Math.random() * 0.02, 0.006, 4, 10, Math.PI * 1.6), M.color('#efd6a8', 0.9), -1.1 + Math.random() * 2.2, 0.92, -0.25 + Math.random() * 0.5, { cast: false }); curl.rotation.set(Math.random() * 3, Math.random() * 3, 0); bench.add(curl); }
  bench.add(mesh(new THREE.BoxGeometry(0.5, 0.004, 0.03), M.color('#c9b48a'), 0.7, 0.912, -0.25));
  bench.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 6).rotateZ(Math.PI / 2), M.color('#e0a33a'), 0.65, 0.915, -0.18));
  bench.position.set(BENCH.x, 0, BENCH.z);
  scene.add(bench);
  obst(BENCH.x - 1.35, BENCH.x + 1.35, BENCH.z - 0.45, BENCH.z + 0.45);
  obst(x0 + 0.2, x1 - 0.2, z0, BENCH.z - 0.45);   // 공방지기 자리 (작업대 뒤)는 손님이 들어가지 않음

  // ---------- 공구 벽판 (북쪽 벽) ----------
  {
    const g = new THREE.Group();
    const pb = mesh(new THREE.BoxGeometry(3.4, 1.2, 0.03), M.color('#d8c29a', 0.95), 0, 0, 0);
    g.add(pb);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) g.add(mesh(new THREE.CircleGeometry(0.008, 6), M.color('#6b5844'), -1.6 + i * 0.29, -0.45 + j * 0.3, 0.017, { cast: false }));
    const steel = M.color('#9aa0a6', 0.35, { metalness: 0.7 });
    const handle = M.color('#8a5a3c', 0.7);
    // 톱 둘
    for (const [x, s] of [[-1.25, 1], [-0.75, 0.85]]) { const blade = new THREE.Shape(); blade.moveTo(0, 0); blade.lineTo(0.5 * s, 0.03); blade.lineTo(0.5 * s, -0.08); blade.lineTo(0, -0.13); blade.closePath(); const sm = new THREE.Mesh(new THREE.ShapeGeometry(blade), steel); sm.position.set(x - 0.2, 0.25, 0.02); sm.rotation.z = -Math.PI / 2; g.add(sm); g.add(mesh(rbox(0.06, 0.13, 0.03, 0.01), handle, x - 0.2 + 0.03, 0.3, 0.025)); }
    // 망치 · 끌 · 직각자
    for (const [x, y] of [[-0.2, 0.25], [0.05, 0.25]]) { g.add(mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.3, 6), handle, x, y - 0.1, 0.03)); g.add(mesh(rbox(0.1, 0.035, 0.035, 0.006), steel, x, y + 0.06, 0.03)); }
    for (let i = 0; i < 5; i++) { const x = 0.35 + i * 0.12; g.add(mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.12, 6), handle, x, 0.25, 0.03)); g.add(mesh(rbox(0.016 + i * 0.004, 0.14, 0.006, 0.002), steel, x, 0.11, 0.03)); }
    g.add(mesh(rbox(0.035, 0.45, 0.01, 0.003), steel, 1.25, -0.05, 0.03)); g.add(mesh(rbox(0.3, 0.035, 0.01, 0.003), steel, 1.12, 0.16, 0.03));
    // 클램프
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 12, Math.PI * 1.4), M.color('#c64b3b', 0.5), -1.2 + i * 0.35, -0.3, 0.04));
    g.position.set(BENCH.x, 1.75, z0 + 0.1);
    scene.add(g);
  }
  // ---------- 나무 거치대 (서쪽 벽) ----------
  {
    const g = new THREE.Group();
    for (const zz of [-0.9, 0.9]) g.add(mesh(rbox(0.08, 2.0, 0.08, 0.01), frame, 0, 1.0, zz));
    for (let k = 0; k < 4; k++) { g.add(mesh(rbox(0.4, 0.04, 2.0, 0.01), frame, 0.15, 0.4 + k * 0.45, 0)); for (let m = 0; m < 3; m++) g.add(mesh(rbox(0.12 + Math.random() * 0.06, 0.05 + Math.random() * 0.04, 1.6 + Math.random() * 0.5, 0.01), M.color(['#d9b07c', '#b98a5a', '#e4c79c', '#9c6a42'][(k + m) % 4], 0.85), 0.08 + m * 0.11, 0.46 + k * 0.45, 0)); }
    g.position.set(x0 + 0.25, 0, -21.2);
    scene.add(g);
    obst(x0, x0 + 0.65, -22.3, -20.1);
  }
  // ---------- 앞치마 걸이 (동쪽 벽) — 누르면 입고 벗기 ----------
  {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.06, 0.06, 1.2, 0.01), frame, 0, 1.75, 0));
    for (const [zz, col] of [[-0.4, '#6b5844'], [0, '#4f6a6b'], [0.4, '#8a5a44']]) {
      g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 6).rotateZ(Math.PI / 2), M.color('#b0a080'), -0.05, 1.75, zz));
      const ap = mesh(rbox(0.03, 0.62, 0.3, 0.02), M.fabric(col), -0.07, 1.4, zz); g.add(ap);
      g.add(mesh(rbox(0.032, 0.08, 0.18, 0.01), M.color('#3e3028'), -0.085, 1.3, zz));
    }
    const tag = textSprite('🧑‍🔧 앞치마 입기', { height: 0.11 }); tag.position.set(-0.25, 2.12, 0); tag.userData.noHit = true; g.add(tag);
    g.position.set(x1 - 0.12, 0, -19.4);
    g.traverse((o) => { if (o.isMesh) o.userData.apron = true; });
    scene.add(g);
  }
  // ---------- 손님 걸상 10 (작업대를 보며 반원) ----------
  const seats = [];
  for (let i = 0; i < 10; i++) {
    const row = i < 6 ? 0 : 1, k = row ? i - 6 : i, n = row ? 4 : 6;
    const a = (k / (n - 1) - 0.5) * (row ? 1.5 : 2.2);
    const rr = row ? 3.6 : 2.4;
    const sx = BENCH.x + Math.sin(a) * rr, sz = BENCH.z + Math.cos(a) * rr;
    const s = stool(scene, room, sx, sz, Math.atan2(BENCH.x - sx, BENCH.z - sz), row ? 0.62 : 0.46, ['#c98f6b', '#a9bba0', '#e6cf9c', '#7f97a8'][i % 4], { name: '목공방 걸상', appr: -0.45 });
    s.wood = true;
    seats.push(s);
  }
  // ---------- 조명 · 빛줄기 · 톱밥 먼지 ----------
  for (const xx of [x0 + 2.2, x1 - 2.2]) {
    const m = new THREE.MeshStandardMaterial({ color: '#f6e2b8', emissive: '#ffcf7a', emissiveIntensity: 0.4 });
    const shade = mesh(new THREE.ConeGeometry(0.22, 0.2, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#3e3a36', side: THREE.DoubleSide }), xx, H - 0.45, BENCH.z + 0.3);
    scene.add(shade); scene.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), m, xx, H - 0.52, BENCH.z + 0.3, { cast: false }));
    scene.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.4, 4), M.color('#3e3029'), xx, H - 0.25, BENCH.z + 0.3, { cast: false }));
    const L = new THREE.PointLight('#ffd59a', 0, 6, 1.6); L.position.set(xx, H - 0.6, BENCH.z + 0.3); scene.add(L);
    room.nightParts.push((dt, t, n) => { L.intensity = 0.8 + n * 3.5; m.emissiveIntensity = 0.4 + n * 1.4; });
  }
  const shaft = mesh(new THREE.PlaneGeometry(1.4, 3.2), new THREE.MeshBasicMaterial({ color: '#fff2cc', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), x1 - 1.6, 1.6, -22.0, { cast: false });
  shaft.rotation.set(0, -Math.PI / 2, 0.45); shaft.userData.noHit = true; scene.add(shaft);
  room.nightParts.push((dt, t, n) => { shaft.material.opacity = 0.09 * (1 - n); });
  const NP = 70, pp = new Float32Array(NP * 3), seeds = [];
  for (let i = 0; i < NP; i++) seeds.push([Math.random(), Math.random(), Math.random() * 6]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#fff1d0', size: 0.025, transparent: true, opacity: 0.7, depthWrite: false }));
  dust.frustumCulled = false; dust.userData.noHit = true; scene.add(dust);
  room.nightParts.push((dt, t) => { for (let i = 0; i < NP; i++) { const [a, b, ph] = seeds[i]; pp[i * 3] = x0 + 0.8 + a * (W - 1.6) + Math.sin(t * 0.3 + ph) * 0.2; pp[i * 3 + 1] = 0.4 + ((b + t * 0.015) % 1) * 2.4; pp[i * 3 + 2] = z0 + 1 + ((a * 7.3) % 1) * (D - 2) + Math.cos(t * 0.25 + ph) * 0.2; } pg.attributes.position.needsUpdate = true; });

  // 문 앞 길 (집 둘레길과 이어짐)
  room.shop = { seats, bench: V(BENCH.x, BENCH.y, BENCH.z), door: V((SHOP.door[0] + SHOP.door[1]) / 2, 0, z1 + 0.9), center: V(cx, 0, cz) };
}

// ---------- 공방지기 + 임시 공방 소리 ----------
export class Workshop {
  constructor(scene, room, sound) {
    this.room = room; this.sound = sound;
    const a = new Avatar('공방지기', { top: '#e2d3b8', hair: '#3b2a22', skin: '#efc9a8' });
    a.setApron(true);
    a.root.position.set(BENCH.x - 0.2, 0, BENCH.z - 0.7);
    scene.add(a.root);
    a.root.traverse((o) => { o.userData.noHit = true; });
    this.npc = a;
    // 손에 드는 공구 (지금 하는 일에 따라 하나만 보임)
    const steel = M.color('#9aa0a6', 0.35, { metalness: 0.7 }), wood = M.color('#8a5a3c', 0.7);
    const tools = {};
    { const g = new THREE.Group(); g.add(mesh(rbox(0.26, 0.07, 0.07, 0.015), M.woodLight())); g.add(mesh(rbox(0.06, 0.06, 0.035, 0.01), wood, 0.08, 0.06, 0)); g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), wood, -0.1, 0.05, 0)); tools.plane = g; }
    { const g = new THREE.Group(); const b = mesh(rbox(0.42, 0.11, 0.004, 0.002), steel, 0.2, -0.04, 0); g.add(b); g.add(mesh(rbox(0.07, 0.11, 0.03, 0.01), wood, -0.03, 0, 0)); tools.saw = g; }
    { const g = new THREE.Group(); g.add(mesh(rbox(0.12, 0.04, 0.07, 0.01), M.color('#c9a45a', 0.9))); tools.sand = g; }
    { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.12, 6), wood, 0, 0.08, 0)); g.add(mesh(rbox(0.02, 0.08, 0.006, 0.002), steel, 0, -0.01, 0)); const mallet = new THREE.Group(); mallet.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 6), wood, 0, -0.1, 0)); mallet.add(mesh(rbox(0.1, 0.06, 0.06, 0.01), M.woodLight(), 0, 0.02, 0)); mallet.position.set(0.12, 0.24, 0); g.add(mallet); g.userData.mallet = mallet; tools.chisel = g; }
    for (const t of Object.values(tools)) { t.visible = false; t.traverse((o) => { o.userData.noHit = true; o.castShadow = true; }); scene.add(t); }
    this.tools = tools;
    this.lastBeat = -1;
    this.listener = null;
    this.focus = false;
  }

  // 지금 하는 일 (모든 손님이 같은 시각으로 계산)
  now() { return actAt(Date.now() / 1000); }

  loud() {
    const me = this.listener;
    if (!me) return 0;
    const d = Math.hypot(me.x - BENCH.x, me.z - BENCH.z);
    const inside = inShop(me);
    return inside ? Math.max(0.35, 1 - d / 8) : Math.max(0, 0.25 - (d - 5) / 30);
  }

  update(dt) {
    const T = Date.now() / 1000;
    const { act, u } = actAt(T);
    const a = this.npc;
    a.update(dt, 0, false);
    a.root.rotation.y = 0;
    const R = a.arms[1], L = a.arms[0];
    const bx = BENCH.x, by = 0.95, bz = BENCH.z;
    for (const [k, t] of Object.entries(this.tools)) t.visible = k === act.id;
    const tool = this.tools[act.id];
    let beat = -1, beatKind = null;
    a.head.rotation.x = 0.35;
    if (act.id === 'plane') {
      // 대패: 나무판 위를 앞으로 밀었다 들어 돌아옴 (한 번 1.6초)
      const p = (u % 1.6) / 1.6, push = p < 0.62 ? p / 0.62 : 1 - (p - 0.62) / 0.38;
      tool.position.set(bx - 0.75 + push * 1.0, by + 0.02 + (p >= 0.62 ? 0.03 : 0), bz + 0.05);
      tool.rotation.set(0, 0, 0);
      a.root.position.set(bx - 0.6 + push * 0.35, 0, bz - 0.7);
      R.rotation.x = -1.1; L.rotation.x = -1.0; R.rotation.z = 0.1 + push * 0.2; L.rotation.z = -0.2;
      beat = Math.floor(u / 1.6); beatKind = 'plane';
    } else if (act.id === 'saw') {
      // 톱: 작업대 오른쪽 끝, 앞뒤로 (한 번 0.55초)
      const p = Math.sin((u / 0.55) * Math.PI);
      tool.position.set(bx + 1.0 + p * 0.12, by + 0.08 - Math.abs(p) * 0.02, bz + 0.15);
      tool.rotation.set(0, Math.PI / 2, -0.5);
      a.root.position.set(bx + 0.7, 0, bz - 0.7);
      R.rotation.x = -1.0 + p * 0.25; R.rotation.z = 0.15; L.rotation.x = -0.7; L.rotation.z = -0.1;
      beat = Math.floor(u / 0.55); beatKind = 'saw';
    } else if (act.id === 'sand') {
      // 사포: 동그랗게 문지름 (한 번 0.9초)
      const th = (u / 0.9) * Math.PI * 2;
      tool.position.set(bx - 0.2 + Math.cos(th) * 0.18, by + 0.01, bz + 0.05 + Math.sin(th) * 0.06);
      tool.rotation.set(0, th * 0.2, 0);
      a.root.position.set(bx - 0.2, 0, bz - 0.7);
      R.rotation.x = -1.15 + Math.sin(th) * 0.1; R.rotation.z = 0.2 + Math.cos(th) * 0.15; L.rotation.x = -0.6;
      beat = Math.floor(u / 0.45); beatKind = 'sand';
    } else {
      // 끌: 왼손 끌, 오른손 나무망치로 톡 (한 번 0.9초)
      const p = (u % 0.9) / 0.9, hit = p < 0.18 ? 1 - p / 0.18 : (p - 0.18) / 0.82;
      tool.position.set(bx + 0.3, by + 0.06, bz + 0.05);
      tool.rotation.set(0.3, 0, 0);
      tool.userData.mallet.rotation.z = -0.2 - hit * 0.9;
      a.root.position.set(bx + 0.3, 0, bz - 0.7);
      L.rotation.x = -0.9; L.rotation.z = -0.1; R.rotation.x = -1.4 - hit * 0.5; R.rotation.z = 0.25;
      beat = Math.floor(u / 0.9); beatKind = 'chisel';
    }
    // 공방 소리 (가까이 있을 때만, 박자마다 한 번)
    const v = this.loud() * (this.focus ? 1.25 : 1);
    if (beat !== this.lastBeat) { this.lastBeat = beat; if (v > 0.02) this.sound.wood?.(beatKind, v); }
  }
}

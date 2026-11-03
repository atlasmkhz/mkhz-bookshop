// 오두막 독립서점 실내 (24 × 20 m): 나무 들보, 벽난로, 높은 책장과 사다리, 책장 골목 네 줄, 비밀 서재,
// 독서 칸막이, 고양이서가 캣타워 코너(카페를 합침), 2층 다락, 루프탑(바깥 계단)
import * as THREE from 'three';
import { M, rbox, mesh, plank, floorTexture, logTexture, stoneTexture, mulberry, footprint, glowSprite, textSprite } from './kit.js';
import { CABIN, DOOR, FRONT, PLATFORMS } from './nav.js';
import { armchair, cushion, beanbag, stool, bench, floorLamp, deskLamp, rug, lowTable, chair, addSeat } from './furniture.js';
import { bookcase, displayTable } from './shelves.js';
import { createProduct } from './products.js';
import { fillSlots, shelfLabel } from './shelves.js';
import { CONFIG } from './config.js';

const WT = 0.22;
const H = CABIN.H;
const LOFT = PLATFORMS[0];
const ROOF = PLATFORMS[2];
const LY = LOFT.y;
const RY = ROOF.y;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

function boxUV(w, h, d, s = 1.6) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] / s, uv.getY(i) * dims[f][1] / s);
  }
  return g;
}

// ---------- 서가 칸 나누기 (과학 밖의 책은 모두 같은 시대 여섯 칸: data/books.json 의 era) ----------
const ERA_IDS = ['e1', 'e2', 'e3', 'e4', 'e5', 'e0'];
const ERA_NAME = { e1: '고대', e2: '중세', e3: '근세', e4: '근대', e5: '현대', e0: '시대를 넘어' };
const ERA_RANGE = { e1: '~918', e2: '918~1392', e3: '1392~1876', e4: '1876~1945', e5: '1945~', e0: '' };
const GROUPS = [
  ['읽을거리', (b) => !['route', 'map', 'tool', 'video'].includes(b.kind)],
  ['이야기 루트', (b) => b.kind === 'route'],
  ['지도와 도구', (b) => ['map', 'tool', 'video'].includes(b.kind)],
];
const ROW_CAP = 30;   // 한 칸에 꽂는 진짜 책 수 (넘치면 다음 칸)
const chunk = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };
// 한 시대의 책 → 칸들 (갈래별)
function eraRows(list) {
  const rows = [];
  if (!list.length) return rows;
  const e = list[0].era;
  for (const [name, f] of GROUPS) for (const part of chunk(list.filter(f), ROW_CAP)) rows.push({ label: `${ERA_NAME[e]} · ${name}`, books: part, era: e });
  return rows;
}
// 책이 적은 분야 → 시대마다 한 칸 (넘치면 갈래로 나눔)
function smallRows(list) {
  const rows = [];
  for (const e of ERA_IDS) {
    const l = list.filter((b) => b.era === e);
    if (!l.length) continue;
    if (l.length <= ROW_CAP) rows.push({ label: `${ERA_NAME[e]}${ERA_RANGE[e] ? ' · ' + ERA_RANGE[e] : ''}`, books: l, era: e });
    else rows.push(...eraRows(l));
  }
  return rows;
}
// 사회: 책 많은 시대는 갈래별, 적은 시대는 한 칸
function socRows(list) {
  const rows = [];
  for (const e of ERA_IDS) {
    const l = list.filter((b) => b.era === e);
    if (!l.length) continue;
    if (l.length > 12) rows.push(...eraRows(l));
    else rows.push({ label: ERA_NAME[e], books: l, era: e });
  }
  return rows;
}
// 칸들을 책장 면 n 개에 차례로 (한 면 per 칸)
function flowRows(rows, n, per) {
  const faces = [...Array(n)].map(() => []);
  rows.forEach((r, i) => faces[Math.min(n - 1, Math.floor(i / per))].push(r));
  return faces;
}
function rangeName(rows) {
  const es = [...new Set(rows.map((r) => r.era))];
  if (!es.length) return '';
  if (es.length === 1) return ERA_NAME[es[0]];
  return es[es.length - 1] === 'e0' ? `${ERA_NAME[es[0]]} 이후` : `${ERA_NAME[es[0]]} ~ ${ERA_NAME[es[es.length - 1]]}`;
}

export function buildCabin(scene, books) {
  const room = {
    walls: [], seats: [], obstacles: [], beams: [], nightParts: [], benchSpots: [], gardenSpots: [], sunSpots: [],
    boxes: [], climbs: [], hideables: [], products: [], update: () => {}, bookHits: [], counter: null, suggest: null, doors: [],
  };
  const rnd = mulberry(42);
  const W = CABIN.maxX - CABIN.minX, D = CABIN.maxZ - CABIN.minZ;
  const cx = (CABIN.minX + CABIN.maxX) / 2, cz = (CABIN.minZ + CABIN.maxZ) / 2;
  const byShelf = (atlas, shelf) => books.filter((b) => b.atlas === atlas && (!shelf || b.shelf === shelf));
  const half = (arr, k) => (k === 0 ? arr.slice(0, Math.ceil(arr.length / 2)) : arr.slice(Math.ceil(arr.length / 2)));
  const obst = (r, lv) => { if (lv) r.lv = lv; room.obstacles.push(r); return r; };
  // 고양이서가 제품 가구 놓기: 모양 + 장애물 + 고양이가 오르는 길 · 숨는 칸
  const putProduct = (key, x, z, rotY) => {
    const p = createProduct(key, { x, z, rotY });
    scene.add(p.root);
    room.products.push(p);
    obst(p.obstacle);
    room.boxes.push(...p.boxes.map((b, i) => ({ ...b, key: `${key}:box${i}`, product: key })));
    room.climbs.push({ key, rotY: p.rotY, path: p.path, product: true });
    namePlate(p);
    return p;
  };

  // ---------- 마루 ----------
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.66 });
  floorMat.map.repeat.set(W / 4, D / 4);
  const floor = mesh(new THREE.BoxGeometry(W, 0.06, D), floorMat, cx, -0.03, cz, { cast: false });
  scene.add(floor);

  // ---------- 벽 (통나무) ----------
  const logMat = new THREE.MeshStandardMaterial({ map: logTexture('#a8744a'), roughness: 0.9 });
  const logIn = new THREE.MeshStandardMaterial({ map: logTexture('#c08e5e', 3), roughness: 0.9 });
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  function makeWall(name, normal, at, along, a0, a1, holes, extra) {
    const g = new THREE.Group();
    g.name = name;
    const pieces = [];
    let s = a0;
    const hs = [...holes].sort((p, q) => p.a0 - q.a0);
    for (const ho of hs) {
      if (ho.a0 > s) pieces.push({ a0: s, a1: ho.a0, y0: 0, y1: H });
      if (ho.y0 > 0) pieces.push({ a0: ho.a0, a1: ho.a1, y0: 0, y1: ho.y0 });
      pieces.push({ a0: ho.a0, a1: ho.a1, y0: ho.y1, y1: H });
      s = ho.a1;
    }
    if (a1 > s) pieces.push({ a0: s, a1, y0: 0, y1: H });
    for (const p of pieces) {
      const len = p.a1 - p.a0, hh = p.y1 - p.y0, mid = (p.a0 + p.a1) / 2, my = (p.y0 + p.y1) / 2;
      const off = at + (normal.x + normal.z) * WT / 2;
      const geo = along === 'x' ? boxUV(len, hh, WT) : boxUV(WT, hh, len);
      const px = along === 'x' ? mid : off, pz = along === 'x' ? off : mid;
      g.add(mesh(geo, logMat, px, my, pz, { cast: false }));
      const innerGeo = along === 'x' ? boxUV(len, hh, 0.02) : boxUV(0.02, hh, len);
      g.add(mesh(innerGeo, logIn, along === 'x' ? mid : at - normal.x * 0.012, my, along === 'x' ? at - normal.z * 0.012 : mid, { cast: false }));
      const sh = new THREE.Mesh(geo, shadowOnly);
      sh.position.set(px, my, pz);
      sh.castShadow = true;
      sh.userData.noHit = true;
      scene.add(sh);
    }
    for (const ho of holes) if (ho.win) windowFrame(g, along, at, ho, normal);
    if (extra) extra(g);
    scene.add(g);
    const len = a1 - a0;
    const lip = mesh(rbox(along === 'x' ? len + WT * 2 : WT, 0.24, along === 'x' ? WT : len, 0.03), M.woodDark(),
      along === 'x' ? (a0 + a1) / 2 : at + normal.x * WT / 2, 0.12, along === 'x' ? at + normal.z * WT / 2 : (a0 + a1) / 2, { cast: false });
    lip.userData.noHit = true;
    scene.add(lip);
    g.userData.fade = 1;
    const wall = { group: g, normal, at, opacity: 1 };
    room.walls.push(wall);
    // 벽 = 장애물 (구멍이 바닥까지 뚫린 곳은 지나감)
    const gaps = holes.filter((h) => h.y0 === 0).sort((p, q) => p.a0 - q.a0);
    let st = a0 - 0.25;
    for (const gp of [...gaps, { a0: a1 + 0.25, a1: a1 + 0.25 }]) {
      if (gp.a0 > st) {
        const sgn = normal.x + normal.z;
        const lo = at - sgn * 0.05, hi = at + sgn * (WT + 0.05);
        const o = along === 'x' ? { minX: st, maxX: gp.a0, minZ: Math.min(lo, hi), maxZ: Math.max(lo, hi), wall: true } : { minX: Math.min(lo, hi), maxX: Math.max(lo, hi), minZ: st, maxZ: gp.a0, wall: true };
        room.obstacles.push(o);
      }
      st = gp.a1;
    }
    return wall;
  }

  // 북쪽(뒤) 벽: 다락 둥근 창 두 개 + 독서 동굴 창
  makeWall('back', V(0, 0, -1), CABIN.minZ, 'x', CABIN.minX - WT, CABIN.maxX + WT, [
    { a0: -12.6, a1: -11.4, y0: 3.5, y1: 4.7, win: true },
    { a0: -6.1, a1: -4.9, y0: 3.5, y1: 4.7, win: true },
    { a0: -3.3, a1: -1.6, y0: 0.9, y1: 2.2, win: true },
  ]);
  // 서쪽 벽: 벽난로 창 + 비밀 서재 작은 창
  makeWall('west', V(-1, 0, 0), CABIN.minX, 'z', CABIN.minZ, CABIN.maxZ, [
    { a0: -2.6, a1: -1.4, y0: 1.0, y1: 2.3, win: true },
    { a0: 7.4, a1: 8.4, y0: 1.4, y1: 2.4, win: true },
  ]);
  // 동쪽 벽: 창가 독서 의자 창 + 정원 문 + 칸막이 위 창 + 캣타워 코너 창
  makeWall('east', V(1, 0, 0), CABIN.maxX, 'z', CABIN.minZ, CABIN.maxZ, [
    { a0: -8.4, a1: -5.4, y0: 0.85, y1: 2.5, win: true },
    { a0: DOOR.z0, a1: DOOR.z1, y0: 0, y1: DOOR.h },
    { a0: 1.6, a1: 3.9, y0: 1.5, y1: 2.5, win: true },
    { a0: 5.0, a1: 6.6, y0: 1.0, y1: 2.5, win: true },
  ], (g) => {
    const lamp = mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffcf7a', emissiveIntensity: 0.2 }), CABIN.maxX + WT + 0.14, 2.75, 1.25, { cast: false });
    g.add(lamp);
    room.nightParts.push((dt, t, n) => { lamp.material.emissiveIntensity = 0.2 + n * 1.8; });
  });
  // 남쪽(앞) 벽: 현관(밖으로 나갈 수 있음) + 소파 창 + 캣타워 코너 창
  makeWall('front', V(0, 0, 1), CABIN.maxZ, 'x', CABIN.minX - WT, CABIN.maxX + WT, [
    { a0: FRONT.x0, a1: FRONT.x1, y0: 0, y1: FRONT.h },
    { a0: -6.2, a1: -3.4, y0: 1.3, y1: 2.6, win: true },
    { a0: -13.6, a1: -12.2, y0: 1.6, y1: 2.6, win: true },
    { a0: 2.6, a1: 5.2, y0: 1.9, y1: 2.9, win: true },
  ], (g) => frontDoor(g));
  room.walls.forEach((w) => { w.isCabin = true; });
  // 현관 문 (양쪽으로 열림) · 정원 문
  room.doors.push(swingDoor(scene, V((FRONT.x0 + FRONT.x1) / 2, 0, CABIN.maxZ + WT / 2), FRONT.x1 - FRONT.x0, FRONT.h, 'x'));
  room.doors.push(swingDoor(scene, V(CABIN.maxX + WT / 2, 0, 0), DOOR.z1 - DOOR.z0, DOOR.h, 'z'));

  // ---------- 들보 · 기둥 ----------
  const beamMat = M.woodDark();
  for (const z of [-8.4, -5.2, -1.6, 2.4, 6.2, 9.4]) {
    const b = mesh(rbox(W + WT * 2, 0.26, 0.24, 0.03), beamMat, cx, H - 0.35, z);
    b.userData.noHit = true; b.castShadow = true;
    scene.add(b);
    room.beams.push({ m: b, axis: 'z', at: z });
  }
  for (const x of [-12.5, -8.5, -4.5, -0.5, 3.5]) {
    const b = mesh(rbox(0.2, 0.2, D, 0.03), beamMat, x, H - 0.1, cz);
    b.userData.noHit = true;
    scene.add(b);
    room.beams.push({ m: b, axis: 'x', at: x });
  }
  // 다락 앞 기둥
  for (const x of [-13.5, -11.0, -8.6, -6.2, -3.8, -1.2]) {
    scene.add(mesh(rbox(0.2, LY, 0.2, 0.03), beamMat, x, LY / 2, LOFT.rect.maxZ + 0.05));
    obst(footprint(x, LOFT.rect.maxZ + 0.05, 0.22, 0.22));
  }

  // ---------- 루프탑 (바깥에 있거나 루프탑에 올라갔을 때만 보임) ----------
  const roof = new THREE.Group();
  buildRooftop(scene, roof, room);
  scene.add(roof);
  room.roof = roof;

  // ---------- 벽난로 (서쪽 벽, z = 2) ----------
  const fire = { x: CABIN.minX + 0.45, z: 3.7 };
  {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ map: stoneTexture('#9d9284'), roughness: 1 });
    g.add(mesh(rbox(0.9, 1.5, 2.2, 0.05), stone, 0, 0.75, 0));
    g.add(mesh(rbox(0.6, H - 1.5, 1.2, 0.04), stone, -0.1, 1.5 + (H - 1.5) / 2, 0));
    g.add(mesh(rbox(1.15, 0.12, 2.4, 0.03), M.woodDark(), 0.08, 1.56, 0));
    g.add(mesh(rbox(1.1, 0.1, 2.5, 0.03), stone, 0.3, 0.05, 0, { cast: false }));
    g.add(mesh(rbox(0.3, 0.8, 1.2, 0.04), M.color('#1c120c', 1), 0.33, 0.55, 0, { cast: false }));
    const fireMat = new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: '#ff8a2a', emissiveIntensity: 1 });
    for (let i = 0; i < 3; i++) {
      const l = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 8).rotateX(Math.PI / 2), M.woodMid(), 0.56, 0.16 + (i === 2 ? 0.1 : 0), (i - 1) * 0.12);
      l.rotation.y = (i - 1) * 0.3;
      g.add(l);
    }
    const flames = [];
    for (let i = 0; i < 5; i++) {
      const f = mesh(new THREE.ConeGeometry(0.08 + (i % 2) * 0.04, 0.34, 8).translate(0, 0.17, 0), fireMat, 0.56, 0.18, (i - 2) * 0.12, { cast: false });
      g.add(f); flames.push(f);
    }
    const glow = glowSprite('#ff9a4a', 1.6);
    glow.position.set(0.72, 0.5, 0);
    g.add(glow);
    for (const [zz, c] of [[-0.8, '#7a3b2a'], [-0.7, '#1f2c4d'], [-0.62, '#1f6f6b']]) g.add(mesh(rbox(0.22, 0.3, 0.06, 0.01), M.color(c), 0.05, 1.77, zz));
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), M.color('#f3ead8'), 0.1, 1.72, 0.7));
    const light = new THREE.PointLight('#ff8c3a', 1.5, 7, 1.7);
    light.position.set(0.9, 0.7, 0);
    g.add(light);
    g.position.set(fire.x, 0, fire.z);
    scene.add(g);
    obst({ minX: CABIN.minX - 0.1, maxX: CABIN.minX + 1.0, minZ: fire.z - 1.15, maxZ: fire.z + 1.15 });
    room.stoveSpot = V(CABIN.minX + 1.35, 0, fire.z + 0.3);
    room.fire = V(fire.x + 0.4, 0.4, fire.z);
    // 벽난로도 장작 넣기 · 불멍이 되는 불 (늘 은은하게 타고, 장작을 넣으면 커짐). 카메라는 방 쪽(동쪽)에서만
    const hearth = { id: 'hearth', name: '서점 벽난로', g, fuel: 0, flare: 0, level: 0.7, lv: 0, pile: null, face: Math.PI / 2, world: () => V(fire.x + 0.56, 0.12, fire.z) };
    g.traverse((m) => { if (m.isMesh) m.userData.fireId = 'hearth'; });
    (room.fires ||= []).push(hearth);
    room.nightParts.push((dt, t, n) => {
      hearth.fuel = Math.max(0, hearth.fuel - dt * BURN);
      hearth.flare = Math.max(0, hearth.flare - dt * 0.55);
      const lvl = Math.min(FUEL_MAX + 0.6, 0.7 + hearth.fuel + hearth.flare * 0.6);
      hearth.level = lvl;
      const f = 0.85 + Math.sin(t * 7.3) * 0.08 + Math.sin(t * 13.1) * 0.06 + Math.sin(t * 3.1) * 0.05;
      fireMat.emissiveIntensity = (1.1 + n * 0.9) * f * (0.7 + lvl * 0.4);
      light.intensity = (1.4 + n * 6) * f * (0.6 + lvl * 0.55);
      glow.material.opacity = Math.min(0.95, (0.35 + n * 0.4) * f * (0.7 + lvl * 0.4));
      const tall = 0.6 + lvl * 0.55 + hearth.flare * 0.5;
      flames.forEach((fl, i) => { fl.scale.set(0.8 + lvl * 0.25, tall * (0.8 + Math.sin(t * 9 + i * 1.7) * 0.25), 0.8 + lvl * 0.25); });
    });
  }
  rug(scene, -13.9, fire.z, 2.4, 2.8, ['#8f4a37', '#e3c79a']);
  logBasket(scene, room, CABIN.minX + 0.45, fire.z + 1.6, 'hearth');
  const fx = fire.x + 0.4, fz = fire.z;
  cushion(scene, room, -14.4, fz - 0.65, face(-14.4, fz - 0.65, fx, fz), '#c98f6b', { name: '벽난로 앞 방석' });
  cushion(scene, room, -14.4, fz + 0.65, face(-14.4, fz + 0.65, fx, fz), '#a9bba0', { name: '벽난로 앞 방석' });
  cushion(scene, room, -13.55, fz, face(-13.55, fz, fx, fz), '#e6cf9c', { name: '벽난로 앞 방석' });
  armchair(scene, room, -13.15, fz - 1.45, face(-13.15, fz - 1.45, fx, fz), '#8a5a44', { name: '벽난로 곁 안락의자', blanket: '#d79a7c' });
  armchair(scene, room, -13.15, fz + 1.45, face(-13.15, fz + 1.45, fx, fz), '#5f6b4e', { name: '벽난로 곁 안락의자' });
  beanbag(scene, room, -12.25, fz, face(-12.25, fz, fx, fz), '#b6a27c', { name: '벽난로 앞 빈백' });
  room.benchSpots.push(V(-14.9, 0.1, fz));

  // ---------- 계단 (다락으로) ----------
  stairZ(scene, room, LOFT, M.wood());

  // ---------- 다락 (2층) ----------
  const loft = new THREE.Group();
  {
    const R = LOFT.rect;
    const lw = R.maxX - R.minX + 0.1, ld = R.maxZ - R.minZ + 0.1;
    const lfm = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.7 });
    lfm.map = lfm.map.clone(); lfm.map.needsUpdate = true; lfm.map.repeat.set(lw / 4, ld / 4);
    const lf = mesh(new THREE.BoxGeometry(lw, 0.16, ld), lfm, (R.minX + R.maxX) / 2, LY - 0.08, (R.minZ + R.maxZ) / 2);
    loft.add(lf);
    loft.add(mesh(rbox(lw, 0.24, 0.24, 0.03), beamMat, (R.minX + R.maxX) / 2, LY - 0.2, R.maxZ + 0.02));
    const railM = M.woodDark();
    const rz = R.maxZ - 0.02;
    loft.add(mesh(rbox(R.maxX - LOFT.ramp.maxX, 0.06, 0.08, 0.02), railM, (LOFT.ramp.maxX + R.maxX) / 2, LY + 0.88, rz));
    for (let x = LOFT.ramp.maxX + 0.05; x <= R.maxX + 0.01; x += 0.35) loft.add(mesh(rbox(0.04, 0.88, 0.04, 0.01), railM, x, LY + 0.44, rz));
    loft.add(mesh(rbox(0.08, 0.06, ld, 0.02), railM, R.maxX - 0.02, LY + 0.88, (R.minZ + R.maxZ) / 2));
    for (let z = R.minZ + 0.1; z < R.maxZ; z += 0.35) loft.add(mesh(rbox(0.04, 0.88, 0.04, 0.01), railM, R.maxX - 0.02, LY + 0.44, z));
    for (let x = R.minX + 0.8; x < R.maxX; x += 1.6) {
      const r = mesh(rbox(0.12, 0.12, ld, 0.02), beamMat, x, LY + 2.1, (R.minZ + R.maxZ) / 2);
      r.userData.noHit = true;
      loft.add(r);
      room.beams.push({ m: r, axis: 'x', at: x });
    }
    scene.add(loft);
  }
  const lo = { fy: LY, lv: 1 };
  const loftStart = room.seats.length;
  // 다락 서가 (2층): 철학 · 문학 · 예술 — 북쪽 벽, 둥근 창 둘을 비켜서. 칸마다 시대 하나 (위 칸이 오래된 시대)
  {
    const lc = { fy: LY, lv: 1, d: 0.4, z: -9.64, host: loft };
    const ph = smallRows(books.filter((b) => b.field === 'philo'));
    const li = smallRows(books.filter((b) => b.field === 'literature'));
    const ar = smallRows(books.filter((b) => b.field === 'art'));
    const half = Math.ceil(li.length / 2);
    const shelvesUp = [
      { x: -13.5, w: 1.5, h: 1.9, rows: Math.max(4, ph.length), spec: ph, label: '철학', color: '#1f2c4d' },
      { x: -10.0, w: 2.4, h: 1.9, rows: Math.max(3, half), spec: li.slice(0, half), label: `문학 · ${rangeName(li.slice(0, half))}`, color: '#8a4b6b' },
      { x: -7.55, w: 2.4, h: 1.9, rows: Math.max(3, li.length - half), spec: li.slice(half), label: `문학 · ${rangeName(li.slice(half))}`, color: '#8a4b6b' },
      { x: -3.9, w: 1.6, h: 1.3, rows: Math.max(2, ar.length), spec: ar, label: '예술', color: '#3e8e5a' },
    ];
    for (const u of shelvesUp) bookcase(loft, room, { ...lc, x: u.x, w: u.w, h: u.h, rows: u.rows, rowSpec: [u.spec], label: u.label, labelColor: u.color });
  }
  // 다락 구석: 커튼 친 담요 굴 (서쪽 끝)
  {
    const g = new THREE.Group();
    const cur = M.fabric('#c9b6e4');
    for (let i = 0; i < 5; i++) { const f = mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 10), cur, -14.4, LY + 0.95, -9.7 + i * 0.12); f.scale.z = 0.5; g.add(f); }
    g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.6, 6).rotateX(Math.PI / 2), M.woodDark(), -14.4, LY + 1.92, -8.5));
    g.add(mesh(rbox(1.3, 0.12, 2.3, 0.05, 3), M.fabric('#efe0c7'), -15.2, LY + 0.06, -8.6));
    const lights = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.MeshStandardMaterial({ color: '#ffe3a0', emissive: '#ffcf7a', emissiveIntensity: 0.2 });
      g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), m, -15.85, LY + 1.5 - Math.sin(i / 8 * Math.PI) * 0.25, -9.7 + i * 0.27, { cast: false }));
      lights.push(m);
    }
    room.nightParts.push((dt, t, n) => lights.forEach((m, i) => { m.emissiveIntensity = 0.3 + n * (1.4 + Math.sin(t * 1.5 + i) * 0.3); }));
    loft.add(g);
  }
  cushion(loft, room, -15.25, -9.2, Math.PI / 2, '#d9a07a', { ...lo, name: '다락 구석 담요 굴', nook: true });
  cushion(loft, room, -15.25, -8.1, Math.PI / 2, '#a9bba0', { ...lo, name: '다락 구석 담요 굴', nook: true });
  // 다락 독서 천막
  readingTent(loft, room, -10.2, -7.6, 0.4, { ...lo, name: '다락 독서 천막' });
  beanbag(loft, room, -12.6, -7.0, face(-12.6, -7, -11, -5.5), '#c98f6b', { ...lo, name: '다락 빈백' });
  beanbag(loft, room, -7.4, -7.6, 0.4, '#7f97a8', { ...lo, name: '다락 빈백' });
  beanbag(loft, room, -5.8, -7.0, -0.5, '#b6a27c', { ...lo, name: '다락 빈백' });
  cushion(loft, room, -9.0, -5.8, 0, '#e6cf9c', { ...lo, name: '다락 난간 자리', nook: true });
  cushion(loft, room, -8.1, -5.8, 0, '#c98f6b', { ...lo, name: '다락 난간 자리', nook: true });
  cushion(loft, room, -4.0, -5.8, 0, '#d9a07a', { ...lo, name: '다락 난간 자리', nook: true });
  {
    const desk = lowTable(loft, room, -2.3, -9.3, 0, 1.2, 0.55, 0.74, { ...lo, book: '#5f6b2e' });
    deskLamp(desk, room, 0.35, 0.74, -0.1);
    chair(loft, room, -2.3, -8.65, Math.PI, '#7f97a8', { ...lo, name: '다락 책상', appr: -0.5, desk: { h: 0.75, d: 0.5 } });
    chair(loft, room, -3.4, -9.0, Math.PI / 2, '#a9bba0', { ...lo, name: '다락 책상 옆', appr: -0.5 });
  }
  rug(loft, -7.0, -6.9, 3.4, 1.8, ['#7f97a8', '#e9d6b9'], { fy: LY });
  rug(loft, -12.8, -7.0, 2.2, 1.6, ['#c98f6b', '#efe0c7'], { fy: LY });
  {
    for (const x of [-12, -5.5]) {
      const light = new THREE.PointLight('#ffc27a', 0.3, 7, 1.6);
      light.position.set(x, LY + 1.6, -7.5);
      loft.add(light);
      room.nightParts.push((dt, t, n) => { light.intensity = 0.3 + n * 4.5; });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 2.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff2cc', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
      shaft.position.set(x, LY + 1.0, -9.2);
      shaft.rotation.x = 0.6;
      shaft.userData.noHit = true;
      loft.add(shaft);
      room.nightParts.push((dt, t, n) => { shaft.material.opacity = 0.08 * (1 - n); });
    }
    // 망원경 (둥근 창 앞)
    const tele = new THREE.Group();
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const leg = mesh(new THREE.CylinderGeometry(0.012, 0.014, 1.0, 6), M.woodDark(), Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2); leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); tele.add(leg); }
    const tube = mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.7, 12).rotateX(Math.PI / 2), M.color('#5a4a3a', 0.4, { metalness: 0.4 }), 0, 1.05, 0);
    tube.rotation.x = -0.5;
    tele.add(tube);
    tele.position.set(-5.5, LY, -8.9);
    loft.add(tele);
    obst(footprint(-5.5, -8.9, 0.5, 0.5), 1);
  }
  for (let i = loftStart; i < room.seats.length; i++) room.seats[i].loft = true;
  room.hideables.push({ group: loft, rect: LOFT.rect, lv: 1 });
  room.benchSpots.push(V(-6.8, LY + 0.92, LOFT.rect.maxZ - 0.02));

  // ---------- 다락 아래: 책장 골목 네 줄 (분야별) ----------
  {
    const H2 = LY - 0.2;
    const sci = books.filter((b) => b.field === 'science');
    // 역사는 책장 한 면에 시대 하나 (서쪽에서 동쪽으로 고대 → 중세 → … → 시대를 넘어), 칸은 읽을거리 · 이야기 루트 · 지도와 도구
    // 끝 책장은 사회. 측면 0 = 동쪽 면, 1 = 서쪽 면
    const hist = (e) => books.filter((b) => b.field === 'history' && b.era === e);
    const soc = flowRows(socRows(books.filter((b) => b.field === 'society')), 2, 3);
    const face = (e) => ({ spec: eraRows(hist(e)), label: `역사 · ${ERA_NAME[e]}` });
    const units = [
      { x: -13.3, sides: [face('e2'), face('e1')] },
      { x: -10.8, sides: [face('e4'), face('e3')] },
      { x: -8.3, sides: [face('e0'), face('e5')] },
      { x: -5.8, sides: [{ spec: soc[1], label: `사회 · ${rangeName(soc[1])}` }, { spec: soc[0], label: `사회 · ${rangeName(soc[0])}` }] },
    ];
    for (const u of units) {
      bookcase(scene, room, { x: u.x, z: -8.35, rotY: Math.PI / 2, w: 2.9, h: H2, d: 0.5, rows: 5, sides: 2, rowSpec: u.sides.map((sd) => sd.spec), rowOrder: [3, 2, 1, 4, 0], label: u.sides.map((sd) => sd.label), labelColor: u.x > -6 ? '#5f6b2e' : '#7a3b2a' });
      endSign(scene, u.x, -6.85, u.sides[0].label, u.sides[1].label);
    }
    // 도서목록 판 (골목 앞, 기둥 사이) — 시대 차례
    const cnt = (f, e) => books.filter((b) => b.field === f && b.era === e).length;
    const hl = (e) => `${ERA_NAME[e]} · ${cnt('history', e)}권`;
    const up = (f) => books.filter((b) => b.field === f).length;
    const boards = [
      [-12.05, 'history', '역사 도서목록 ①', ['서쪽 끝부터 시대 순', hl('e1'), hl('e2'), hl('e3'), '세계사도 같은 칸에']],
      [-9.55, 'history', '역사 도서목록 ②', [hl('e4'), hl('e5'), hl('e0'), '칸: 읽을거리 · 루트', '· 지도와 도구']],
      [-7.05, 'society', '사회 도서목록', [...ERA_IDS.filter((e) => cnt('society', e)).map((e) => `${ERA_NAME[e]} · ${cnt('society', e)}권`), '권력 · 법 · 살림', '정당 · 찾아보기'].slice(0, 5)],
      [-4.55, 'philo', '2층 다락 서가', [`철학 · ${up('philo')}권`, `문학 · ${up('literature')}권`, `예술 · ${up('art')}권`, '칸마다 시대 하나', '서쪽 계단으로 ↑']],
    ];
    const fcol = { history: '#7a3b2a', literature: '#8a4b6b', society: '#5f6b2e', philo: '#1f2c4d' };
    for (const [bx, field, title, lines] of boards) catalogBoard(scene, room, bx, -6.15, 0, field, title, lines, fcol[field]);
    // 골목 끝 의자 (막다른 골목) + 사이 방석
    for (const x of [-12.05, -9.55, -7.05]) armchair(scene, room, x, -9.3, 0, ['#8a5a44', '#5f6b4e', '#7f97a8'][Math.round((x + 12.05) / 2.5)], { name: '책장 골목 끝 의자', nook: true });
    cushion(scene, room, -12.05, -7.3, -Math.PI / 2, '#a9bba0', { name: '책장 사이 방석', nook: true });
    cushion(scene, room, -9.55, -7.3, -Math.PI / 2, '#c98f6b', { name: '책장 사이 방석', nook: true });
    cushion(scene, room, -7.05, -7.3, Math.PI / 2, '#e6cf9c', { name: '책장 사이 방석', nook: true });
    // 계단 뒤 구석 (서쪽 끝)
    cushion(scene, room, -15.4, -8.4, Math.PI / 2, '#d79a7c', { name: '계단 뒤 구석', nook: true });
    cushion(scene, room, -15.4, -7.4, Math.PI / 2, '#e6cf9c', { name: '계단 뒤 구석', nook: true });
    armchair(scene, room, -14.6, -9.3, 0.2, '#a7865f', { name: '계단 뒤 안락의자', nook: true });
    // 동쪽 끝: 창가 독서 동굴 (창 앞 안락의자 두 개)
    armchair(scene, room, -3.0, -9.1, 0, '#8a5a44', { name: '다락 아래 독서 동굴', nook: true, blanket: '#c9b6e4' });
    armchair(scene, room, -1.9, -9.1, 0, '#5f6b4e', { name: '다락 아래 독서 동굴', nook: true });
    lowTable(scene, room, -2.45, -8.2, 0, 0.5, 0.4, 0.42, { cup: true });
    floorLamp(scene, room, -4.1, -9.2, { light: true });
    for (const x of [-14.6, -12.05, -9.55, -7.05, -4.5, -2.4]) pendant(scene, room, x, LY - 0.45, -8.2);
    // 학년별 과학 책장 (낮은 책장, 앞은 초등 · 뒤는 중학) — 둥근 독서 탁자 옆
    const kids = sci.filter((b) => b.grade === 'kids-low' || b.grade === 'kids-high');
    const middle = sci.filter((b) => b.grade === 'middle');
    // 집사4호 원목 캣타워 = 책장 + 고양이 계단. 열린 칸에 어린이 · 중학 과학 책을 꽂음
    const jipsa = putProduct('jipsa4', -1.6, -3.1, 0);
    fillSlots(jipsa.root, jipsa.bookSlots, [...kids, ...middle]);
    shelfLabel(jipsa.root, '학년별 과학 · 집사4호', 2.0, 1.8, 0.4, 1, '#1f6f6b');
    catalogBoard(scene, room, -3.6, -3.4, Math.PI / 2, 'science', '학년별 과학', ['초등 3~4학년', '초등 5~6학년', '중학교 과학 · 수학', '과학 대사관', '오늘의 과학'], '#1f6f6b');
  }

  // ---------- 높은 책장 + 사다리 (과학아틀라스, 북동쪽 벽) ----------
  {
    const sci = books.filter((b) => b.field === 'science' && (b.grade === 'general' || !b.grade));
    bookcase(scene, room, { x: 3.4, z: CABIN.minZ + 0.25, w: 6.0, h: 4.8, d: 0.46, rows: 9, books: [sci], label: '과학 · 자료실 · 발견 카드 · 과학자' });
    catalogBoard(scene, room, 0.0, -9.0, 0.35, 'science', '과학 도서목록', ['수학 · 물리 · 화학', '생물의학 · 천문우주', '지구과학 · 공학', '발견 카드 212장', '과학자 · 용어 · 특집'], '#1f6f6b');
    const g = new THREE.Group();
    const lx = 4.4, z0 = -8.85, z1 = -9.42, top = 4.65;
    const len = Math.hypot(top, z0 - z1);
    const ang = Math.atan2(z0 - z1, top);
    for (const s of [-0.24, 0.24]) { const r = mesh(rbox(0.05, len, 0.06, 0.015), M.woodMid(), lx + s, top / 2, (z0 + z1) / 2); r.rotation.x = -ang; g.add(r); }
    const rungs = [];
    for (let i = 1; i < 13; i++) {
      const t = i / 13;
      const y = top * t, z = z0 + (z1 - z0) * t;
      g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6).rotateZ(Math.PI / 2), M.woodMid(), lx, y, z));
      rungs.push(V(lx, y + 0.03, z));
    }
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 5.8, 6).rotateZ(Math.PI / 2), M.color('#8a7b6c', 0.4, { metalness: 0.6 }), 3.4, top + 0.05, -9.48));
    scene.add(g);
    obst({ minX: lx - 0.3, maxX: lx + 0.3, minZ: -9.5, maxZ: z0 + 0.08 });
    room.climbs.push({ key: 'ladder', rotY: 0, path: [V(lx + 0.55, 0, -8.55), rungs[2], rungs[5], rungs[8], rungs[11], V(5.4, 4.83, CABIN.minZ + 0.25), V(1.6, 4.83, CABIN.minZ + 0.25)] });
    // 창가 독서 의자 (동쪽 창)
    armchair(scene, room, 7.2, -7.7, Math.PI / 2, '#8a5a44', { name: '창가 독서 의자', nook: true, blanket: '#c9b6e4' });
    armchair(scene, room, 7.2, -6.3, Math.PI / 2, '#a7865f', { name: '창가 독서 의자', nook: true });
    lowTable(scene, room, 7.45, -8.65, 0, 0.45, 0.45, 0.5, { cup: true });
    floorLamp(scene, room, 7.55, -5.4, { light: true });
    room.benchSpots.push(V(7.86, 0.86, -6.9));
    // 둥근 독서 탁자
    {
      const g2 = new THREE.Group();
      g2.add(mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 32), M.wood(), 0, 0.74, 0));
      g2.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.72, 10), M.woodMid(), 0, 0.37, 0));
      g2.add(mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.04, 20), M.woodMid(), 0, 0.02, 0));
      deskLamp(g2, room, 0, 0.74, 0);
      g2.position.set(2.6, 0, -5.8);
      scene.add(g2);
      obst(footprint(2.6, -5.8, 1.5, 1.5));
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + 0.3; const sx = 2.6 + Math.cos(a) * 1.15, sz = -5.8 + Math.sin(a) * 1.15; chair(scene, room, sx, sz, face(sx, sz, 2.6, -5.8), ['#c98f6b', '#a9bba0', '#e6cf9c', '#7f97a8', '#d9a07a'][k], { name: '둥근 독서 탁자', appr: -0.5, desk: { h: 0.77, d: 0.55 } }); }
    }
  }

  // ---------- 독서 칸막이 (동쪽 벽, 문 남쪽) ----------
  {
    const g = new THREE.Group();
    const x = CABIN.maxX - 0.42;
    for (let i = 0; i < 3; i++) {
      const z = 1.7 + i * 0.95;
      plank(g, 0.6, 0.04, 0.85, x, 0.74, z, M.wood(), 0.012);
      plank(g, 0.6, 0.5, 0.03, x, 1.0, z - 0.44, M.woodLight(), 0.008);
      plank(g, 0.6, 0.5, 0.03, x, 1.0, z + 0.44, M.woodLight(), 0.008);
      plank(g, 0.03, 0.5, 0.88, x + 0.29, 1.0, z, M.woodLight(), 0.008);
      for (const sz of [-0.38, 0.38]) plank(g, 0.04, 0.72, 0.04, x - 0.26, 0.36, z + sz, M.woodMid(), 0.008);
      deskLamp(g, room, x + 0.1, 0.76, z + 0.25);
      chair(scene, room, x - 0.75, z, Math.PI / 2, ['#c98f6b', '#a9bba0', '#e6cf9c'][i], { name: '독서 칸막이', nook: true, appr: -0.5, desk: { h: 0.77, d: 0.62 } });
    }
    scene.add(g);
    obst({ minX: x - 0.32, maxX: CABIN.maxX, minZ: 1.2, maxZ: 4.1 });
  }

  // ---------- 고양이서가 캣타워 코너 (남동쪽) ----------
  {
    const put = putProduct;
    put('customB', 4.2, CABIN.maxZ - 0.3, Math.PI);
    put('ormi', CABIN.maxX - 0.3, 5.6, -Math.PI / 2);
    put('catwalk', CABIN.maxX - 0.24, 8.3, -Math.PI / 2);
    put('cathouse', -0.6, 0.6, 0.5);
    // 벨라4호 — 동쪽 창가 벽 (창가 독서 의자와 정원 문 사이)
    put('bella4', CABIN.maxX - 0.3, -3.3, -Math.PI / 2);
    // 카페 테이블 두 개
    for (const [tx, tz, col] of [[3.0, 5.6, '#e7c58e'], [5.6, 4.2, '#a9bba0']]) {
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 28), M.wood(), 0, 0.74, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.72, 10), M.woodMid(), 0, 0.37, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 20), M.woodMid(), 0, 0.015, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 12), M.color('#e8f1f2', 0.1, { transparent: true, opacity: 0.6 }), 0.1, 0.81, -0.08, { cast: false }));
      g.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), M.color('#f2a7a0', 1), 0.1, 0.89, -0.08));
      g.position.set(tx, 0, tz);
      scene.add(g);
      obst(footprint(tx, tz, 0.72, 0.72));
      chair(scene, room, tx - 0.68, tz, Math.PI / 2, col, { name: '캣타워 코너 테이블', appr: -0.5, desk: { h: 0.77, d: 0.5 } });
      chair(scene, room, tx + 0.68, tz, -Math.PI / 2, col, { name: '캣타워 코너 테이블', appr: -0.5, desk: { h: 0.77, d: 0.5 } });
    }
    rug(scene, 4.2, 6.6, 3.6, 2.6, ['#e9d6b9', '#d9a77e']);
    // 고양이 밥그릇 · 공
    scene.add(mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.06, 20), M.color('#f5efe6', 0.4), 6.8, 0.03, 8.2));
    scene.add(mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.06, 20), M.color('#f5efe6', 0.4), 6.45, 0.03, 8.2));
    scene.add(mesh(new THREE.SphereGeometry(0.06, 14, 10), M.color('#f1c45b', 1), 1.8, 0.06, 7.4));
    room.foodSpot = V(6.6, 0, 7.7);
    signBoard(scene, 4.2, 2.95, CABIN.maxZ - 0.03, '고양이서가', '· 원목 캣타워 ·');
  }

  // ---------- 평대 · 긴 책상 · 소파 ----------
  {
    const pick = [];
    for (const a of ['history', 'philo', 'science', 'politics']) {
      const list = books.filter((b) => b.atlas === a && b.cover);
      const day = Math.floor(Date.now() / 86400000 / 30);
      for (let k = 0; k < 2 && list.length; k++) pick.push(list[(day * 7 + k * 13) % list.length]);
    }
    room.bookHits.push(...displayTable(scene, room, -3.2, 2.4, pick));
    room.benchSpots.push(V(-2.6, 0.8, 2.4));
  }
  {
    const g = lowTable(scene, room, -8.0, 3.6, 0, 2.6, 0.95, 0.76, { book: '#7a3b2a' });
    deskLamp(g, room, -0.7, 0.76, 0.1);
    deskLamp(g, room, 0.7, 0.76, -0.1);
    [-8.9, -8.0, -7.1].forEach((xx, i) => {
      chair(scene, room, xx, 2.8, 0, ['#c98f6b', '#a9bba0', '#e6cf9c'][i], { name: '긴 책상', appr: -0.5, desk: { h: 0.77, d: 0.48 } });
      chair(scene, room, xx, 4.4, Math.PI, '#7f97a8', { name: '긴 책상', appr: -0.5, desk: { h: 0.77, d: 0.48 } });
    });
  }
  {
    const g = new THREE.Group();
    const L = 2.4, Dd = 0.9, color = '#a7b996';
    const fab = M.fabric(color), fab2 = M.fabric('#93a782');
    plank(g, L, 0.3, Dd, 0, 0.25, 0, fab2, 0.08);
    plank(g, L, 0.55, 0.24, 0, 0.62, -Dd / 2 + 0.12, fab2, 0.1);
    for (const s of [-1, 1]) plank(g, 0.22, 0.42, Dd, s * (L / 2 - 0.11), 0.48, 0, fab2, 0.1);
    for (const s of [-1, 1]) g.add(mesh(rbox(L / 2 - 0.24, 0.15, Dd - 0.3, 0.07, 3), fab, s * (L / 4 - 0.06), 0.47, 0.08));
    const pill = mesh(rbox(0.38, 0.34, 0.12, 0.06, 3), M.fabric('#e7c58e'), -0.75, 0.68, -0.08);
    pill.rotation.set(-0.3, 0.2, 0.15);
    g.add(pill);
    g.position.set(-4.6, 0, CABIN.maxZ - 0.55);
    g.rotation.y = Math.PI;
    scene.add(g);
    obst(footprint(-4.6, CABIN.maxZ - 0.55, L, Dd, 0));
    addSeat(room, -5.15, 0.54, CABIN.maxZ - 0.62, Math.PI, { name: '창 아래 소파', appr: 0.6 });
    addSeat(room, -4.05, 0.54, CABIN.maxZ - 0.62, Math.PI, { name: '창 아래 소파', appr: 0.6 });
    room.benchSpots.push(V(-4.6, 0.55, CABIN.maxZ - 0.5));
    rug(scene, -4.6, 8.0, 2.6, 1.7, ['#d9b48a', '#7f97a8']);
    lowTable(scene, room, -4.6, 7.9, 0, 1.0, 0.5, 0.42, { cup: true, book: '#1f2c4d' });
    floorLamp(scene, room, -3.0, CABIN.maxZ - 0.4, { light: true });
  }

  // ---------- 카운터 (음료, 남쪽 벽) ----------
  {
    const g = new THREE.Group();
    const L = 3.0, Dd = 0.62, Hh = 1.02;
    const cxp = -9.6;
    plank(g, L, Hh - 0.05, Dd, 0, (Hh - 0.05) / 2, 0, M.woodLight(), 0.03);
    plank(g, L + 0.1, 0.06, Dd + 0.1, 0, Hh - 0.03, 0, M.wood(), 0.02);
    for (let i = 0; i < 6; i++) plank(g, 0.025, Hh - 0.2, 0.02, -L / 2 + 0.25 + i * 0.5, Hh / 2, -Dd / 2 - 0.005, M.wood(), 0.008);
    g.add(mesh(rbox(0.4, 0.4, 0.32, 0.06), M.color('#e9e2d6', 0.4), -0.9, Hh + 0.2, 0.05));
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 12), M.color(['#f6efe4', '#d9a07a', '#a9bba0', '#f6efe4'][i], 0.35), -0.3 + i * 0.13, Hh + 0.045, -0.12));
    for (let i = 0; i < 3; i++) {
      g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 14), M.color('#e8f1f2', 0.1, { transparent: true, opacity: 0.45 }), 0.5 + i * 0.18, Hh + 0.1, 0.05, { cast: false }));
      g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 14), M.color(['#f0b93a', '#d0505a', '#b8803e'][i], 1), 0.5 + i * 0.18, Hh + 0.05, 0.05));
    }
    const c = document.createElement('canvas'); c.width = 256; c.height = 320;
    const drawMenu = () => {
      const p = c.getContext('2d');
      p.fillStyle = '#3e3a36'; p.fillRect(0, 0, 256, 320);
      p.fillStyle = '#f2e7d3'; p.textAlign = 'center';
      p.font = '700 36px "Gowun Batang", serif'; p.fillText('오늘의 차', 128, 52);
      p.font = '24px "Gowun Dodum", sans-serif';
      ['라떼 · 보리차', '유자차 · 핫초코', '밀크티 · 오미자', '모두 무료예요'].forEach((s, i) => p.fillText(s, 128, 112 + i * 52));
    };
    drawMenu();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    document.fonts?.ready.then(() => { drawMenu(); tex.needsUpdate = true; });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    board.position.set(0.15, Hh + 0.42, -0.2);
    board.rotation.set(-0.25, 0, 0);
    g.add(board);
    g.traverse((o) => { o.userData.counter = true; });
    g.position.set(cxp, 0, CABIN.maxZ - 0.5);
    scene.add(g);
    obst({ minX: cxp - L / 2 - 0.05, maxX: cxp + L / 2 + 0.05, minZ: CABIN.maxZ - 0.85, maxZ: CABIN.maxZ });
    room.counter = V(cxp, 0, CABIN.maxZ - 1.45);
    for (const xx of [cxp - 0.9, cxp, cxp + 0.9]) stool(scene, room, xx, CABIN.maxZ - 1.25, 0, 0.72, '#c98f6b', { name: '카운터 걸상', appr: -0.45, desk: { h: 1.03, d: 0.58 } });
    for (const xx of [cxp - 0.9, cxp + 0.9]) pendant(scene, room, xx, 2.4, CABIN.maxZ - 0.5);
    room.benchSpots.push(V(cxp + 1.2, 1.05, CABIN.maxZ - 0.5));
    toyBasket(scene, cxp - 1.25, Hh, CABIN.maxZ - 0.5);
    storeStand(scene, cxp + 1.32, Hh, CABIN.maxZ - 0.62);
  }

  // ---------- 도구 손수레 (현관 옆) ----------
  toolCart(scene, room, 0.9, 8.3, 0.3);

  // ---------- 건의함 ----------
  {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.0, 8), M.woodDark(), 0, 0.5, 0));
    g.add(mesh(rbox(0.42, 0.36, 0.32, 0.04), M.color('#b65d4c', 0.7), 0, 1.18, 0));
    g.add(mesh(rbox(0.46, 0.06, 0.36, 0.02), M.woodDark(), 0, 1.38, 0));
    g.add(mesh(rbox(0.2, 0.02, 0.01, 0.005), M.color('#2a1a14'), 0, 1.25, 0.165));
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const draw = () => { const p = c.getContext('2d'); p.fillStyle = '#f3e6cf'; p.fillRect(0, 0, 256, 96); p.fillStyle = '#5a3d2b'; p.textAlign = 'center'; p.textBaseline = 'middle'; p.font = '700 30px "Gowun Batang", serif'; p.fillText('서점지기에게 한마디', 128, 50); };
    draw();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), new THREE.MeshStandardMaterial({ map: t }));
    lab.position.set(0, 1.12, 0.165);
    g.add(lab);
    g.traverse((o) => { o.userData.suggest = true; });
    g.position.set(-6.6, 0, CABIN.maxZ - 0.35);
    scene.add(g);
    obst(footprint(-6.6, CABIN.maxZ - 0.35, 0.5, 0.4));
    room.suggest = V(-6.6, 0, CABIN.maxZ - 0.95);
  }

  // ---------- 비밀 서재 (남서쪽, 책장 문 뒤) ----------
  secretStudy(scene, room, books);

  // ---------- 화분 · 고양이 상자 ----------
  for (const [x, z, s] of [[CABIN.maxX - 0.4, DOOR.z1 + 0.6, 1.0], [CABIN.maxX - 0.4, DOOR.z0 - 0.6, 0.9], [-0.4, CABIN.maxZ - 0.45, 0.8], [-7.6, -6.4, 0.9], [CABIN.minX + 0.4, -2.2, 0.9], [1.2, -4.9, 0.8], [-11.6, 6.0, 1.0]]) plant(scene, room, x, z, s, rnd);
  {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.6, 0.32, 0.45, 0.02), M.color('#c9a77a', 1), 0, 0.16, 0));
    g.add(mesh(rbox(0.52, 0.02, 0.38, 0.01), M.color('#3a2a20', 1), 0, 0.31, 0, { cast: false }));
    g.position.set(1.4, 0, -1.6);
    g.rotation.y = 0.3;
    scene.add(g);
    obst(footprint(1.4, -1.6, 0.62, 0.5, 0.3));
    room.boxes.push({ floor: V(1.4, 0, -1.05), inside: V(1.4, 0.12, -1.6), rotY: 0.3, key: 'bookbox' });
  }

  room.spawn = V((FRONT.x0 + FRONT.x1) / 2, 0, CABIN.maxZ - 0.9);
  room.firstWalk = V(-2.6, 0, 6.2);
  return room;
}

// ---------- 루프탑: 널 깔린 옥상 테라스 + 바깥 계단 ----------
function buildRooftop(scene, roof, room) {
  const R = ROOF.rect;
  const w = R.maxX - R.minX, d = R.maxZ - R.minZ;
  const obst = (r) => { r.lv = 3; room.obstacles.push(r); };
  // 바닥 널
  const deckM = M.woodMid();
  const plankGeo = rbox(0.28, 0.06, d, 0.01);
  for (let x = R.minX + 0.15; x < R.maxX; x += 0.3) roof.add(mesh(plankGeo, deckM, x, RY - 0.03, (R.minZ + R.maxZ) / 2, { cast: false }));
  roof.add(mesh(new THREE.BoxGeometry(w, 0.3, d), M.woodDark(), (R.minX + R.maxX) / 2, RY - 0.22, (R.minZ + R.maxZ) / 2));
  // 남쪽 처마 받침 기둥 (땅에서)
  for (const x of [-14.2, -11, -6, 0.6, 5, R.maxX - 0.3]) {
    scene.add(mesh(rbox(0.2, RY, 0.2, 0.03), M.woodDark(), x, RY / 2, R.maxZ - 0.2));
    room.obstacles.push(footprint(x, R.maxZ - 0.2, 0.24, 0.24));
  }
  // 난간
  const railM = M.woodDark();
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    const r = mesh(rbox(0.06, 0.06, len, 0.02), railM, (x0 + x1) / 2, RY + 0.95, (z0 + z1) / 2); r.rotation.y = ang; roof.add(r);
    const r2 = mesh(rbox(0.04, 0.04, len, 0.01), railM, (x0 + x1) / 2, RY + 0.5, (z0 + z1) / 2); r2.rotation.y = ang; roof.add(r2);
    const n = Math.ceil(len / 1.2);
    for (let i = 0; i <= n; i++) { const t = i / n; roof.add(mesh(rbox(0.07, 0.95, 0.07, 0.01), railM, x0 + (x1 - x0) * t, RY + 0.47, z0 + (z1 - z0) * t)); }
    const pad = 0.12;
    const o = footprint((x0 + x1) / 2, (z0 + z1) / 2, 0.1, len, ang, pad);
    obst(o);
  };
  rail(R.minX + 0.05, R.minZ + 0.05, R.maxX - 0.05, R.minZ + 0.05);
  rail(R.minX + 0.05, R.minZ + 0.05, R.minX + 0.05, R.maxZ - 0.05);
  rail(R.maxX - 0.05, R.minZ + 0.05, R.maxX - 0.05, R.maxZ - 0.05);
  rail(R.minX + 0.05, R.maxZ - 0.05, ROOF.ramp.bottom - 0.2, R.maxZ - 0.05);     // 남쪽: 계단 자리는 열어 둠
  rail(ROOF.ramp.top + 0.2, R.maxZ - 0.05, R.maxX - 0.05, R.maxZ - 0.05);
  // 다락 위 박공 지붕 (북쪽 띠, 뒤에 숨는 구석이 생김)
  {
    const bx0 = -13.8, bx1 = -3.2, bz0 = R.minZ + 0.35, bz1 = -5.0;
    const bw = bx1 - bx0, bd = bz1 - bz0, rise = 1.5;
    const rm = new THREE.MeshStandardMaterial({ map: logTexture('#6d4b36', 21), roughness: 0.95 });
    const slope = Math.hypot(bd / 2, rise), ang = Math.atan2(rise, bd / 2);
    for (const s of [-1, 1]) { const p = mesh(boxUV(bw, 0.14, slope, 2), rm, (bx0 + bx1) / 2, RY + rise / 2, (bz0 + bz1) / 2 + s * bd / 4); p.rotation.x = s * ang; roof.add(p); }
    roof.add(mesh(new THREE.BoxGeometry(bw - 0.1, rise - 0.1, bd - 0.3), M.woodDark(), (bx0 + bx1) / 2, RY + rise / 2 - 0.05, (bz0 + bz1) / 2));
    obst({ minX: bx0, maxX: bx1, minZ: bz0 - 0.1, maxZ: bz1 + 0.1 });
    // 둥근 창 두 개 (바깥쪽 장식)
    for (const x of [-12, -5.5]) roof.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20).rotateX(Math.PI / 2), M.woodLight(), x, RY + 0.75, bz1 + 0.02));
  }
  // 굴뚝
  const chim = mesh(rbox(0.8, 2.0, 0.9, 0.04), new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 1 }), CABIN.minX + 0.45, RY + 0.9, 2.0);
  roof.add(chim);
  obst(footprint(CABIN.minX + 0.45, 2.0, 0.9, 1.0));
  // 자리들
  const o = { fy: RY, lv: 3 };
  const start = room.seats.length;
  rug(roof, 2.6, 2.4, 4.0, 3.0, ['#c98f6b', '#efe0c7'], { fy: RY });
  beanbag(roof, room, 1.4, 1.4, face(1.4, 1.4, 2.6, 2.4), '#d97c5c', { ...o, name: '루프탑 빈백' });
  beanbag(roof, room, 3.8, 1.5, face(3.8, 1.5, 2.6, 2.4), '#7f97a8', { ...o, name: '루프탑 빈백' });
  beanbag(roof, room, 1.6, 3.6, face(1.6, 3.6, 2.6, 2.4), '#e8c86a', { ...o, name: '루프탑 빈백' });
  beanbag(roof, room, 3.8, 3.5, face(3.8, 3.5, 2.6, 2.4), '#a9bba0', { ...o, name: '루프탑 빈백' });
  // 화로와 캠핑 의자
  firebowl(roof, room, -7.5, 4.5, RY, { id: 'roof', name: '루프탑 화로', lv: 3 });
  woodpile(roof, room, -7.6, 6.9, RY, 0, 'roof', { lv: 3 });
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; const sx = -7.5 + Math.cos(a) * 1.6, sz = 4.5 + Math.sin(a) * 1.6; campChair(roof, room, sx, sz, face(sx, sz, -7.5, 4.5), ['#d97c5c', '#5f6b4e', '#7f97a8', '#e8c86a'][k], { ...o, name: '루프탑 화로 곁 캠핑 의자' }); }
  // 해먹 (기둥 둘 사이)
  hammock(roof, room, -12.5, 7.6, 0.2, '#e8c86a', { ...o, name: '루프탑 해먹', posts: true });
  // 작은 바 (주전자 · 머그)
  {
    const g = new THREE.Group();
    plank(g, 2.0, 0.9, 0.5, 0, 0.45, 0, M.woodLight(), 0.03);
    plank(g, 2.1, 0.05, 0.6, 0, 0.92, 0, M.wood(), 0.02);
    g.add(mesh(new THREE.SphereGeometry(0.12, 14, 10), M.color('#9aa0a8', 0.3, { metalness: 0.6 }), -0.5, 1.05, 0));
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.08, 12), M.color(['#f6efe4', '#d9a07a', '#a9bba0'][i], 0.35), 0.2 + i * 0.18, 0.99, -0.1));
    g.position.set(4.5, RY, 9.6);
    roof.add(g);
    obst(footprint(4.5, 9.6, 2.1, 0.6));
    for (const xx of [3.7, 4.5, 5.3]) stool(roof, room, xx, 8.85, 0, 0.72, '#c98f6b', { ...o, name: '루프탑 바', appr: -0.45, desk: { h: 0.95, d: 0.62 } });
  }
  // 망원경 (동쪽 난간)
  {
    const tele = new THREE.Group();
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const leg = mesh(new THREE.CylinderGeometry(0.012, 0.014, 1.1, 6), M.woodDark(), Math.cos(a) * 0.22, 0.55, Math.sin(a) * 0.22); leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); tele.add(leg); }
    const tube = mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 12).rotateX(Math.PI / 2), M.color('#5a4a3a', 0.4, { metalness: 0.4 }), 0, 1.15, 0);
    tube.rotation.set(-0.45, 0.6, 0);
    tele.add(tube);
    tele.position.set(7.0, RY, -6.5);
    roof.add(tele);
    obst(footprint(7.0, -6.5, 0.55, 0.55));
    stool(roof, room, 6.3, -5.7, face(6.3, -5.7, 9, -8), 0.46, '#a9bba0', { ...o, name: '망원경 옆 걸상', nook: true });
  }
  // 지붕 뒤 숨는 구석 (박공 지붕 양옆)
  cushion(roof, room, -15.1, -8.6, 0, '#d9a07a', { ...o, name: '루프탑 지붕 뒤 구석', nook: true });
  cushion(roof, room, -15.1, -7.5, 0, '#a9bba0', { ...o, name: '루프탑 지붕 뒤 구석', nook: true });
  cushion(roof, room, -2.2, -8.8, Math.PI, '#e6cf9c', { ...o, name: '루프탑 지붕 뒤 구석', nook: true });
  cushion(roof, room, -1.2, -8.8, Math.PI, '#c98f6b', { ...o, name: '루프탑 지붕 뒤 구석', nook: true });
  // 화분 · 전구 줄
  for (const [x, z] of [[-3.5, -3.5], [6.5, 6.0], [-14.5, 9.0], [0.5, -8.0]]) { roof.add(mesh(rbox(1.0, 0.4, 0.4, 0.03), M.woodLight(), x, RY + 0.2, z)); for (let i = 0; i < 5; i++) roof.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), M.color(['#86b479', '#f2a7a0', '#7ead6f', '#f6d36b', '#93c084'][i], 1), x - 0.4 + i * 0.2, RY + 0.5, z)); obst(footprint(x, z, 1.0, 0.4)); }
  const bulbs = [];
  for (const [x0, z0, x1, z1] of [[-15.5, -4.5, 7.5, -4.5], [-15.5, 10.9, 7.5, 10.9], [-15.5, -4.5, -15.5, 10.9], [7.5, -4.5, 7.5, 10.9]]) {
    const pts = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(V(x0 + (x1 - x0) * t, RY + 2.5 - Math.sin(t * Math.PI) * 0.3, z0 + (z1 - z0) * t));
      if (i > 0 && i < n) {
        const m = new THREE.MeshStandardMaterial({ color: '#ffe3a0', emissive: '#ffcf7a', emissiveIntensity: 0.1 });
        roof.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), m, pts[i].x, pts[i].y - 0.06, pts[i].z, { cast: false }));
        bulbs.push(m);
      }
    }
    roof.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.006, 4), M.color('#5a4636')));
  }
  for (const [x, z] of [[-15.5, -4.5], [7.5, -4.5], [-15.5, 10.9], [7.5, 10.9]]) { roof.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.5, 8), M.woodDark(), x, RY + 1.25, z)); }
  room.nightParts.push((dt, t, n) => { bulbs.forEach((m, i) => { m.emissiveIntensity = 0.1 + n * (1.6 + Math.sin(t * 1.4 + i) * 0.3); }); });
  for (let i = start; i < room.seats.length; i++) room.seats[i].rooftop = true;
  // 바깥 계단 (남쪽 벽 따라 x 방향)
  {
    const Rr = ROOF.ramp;
    const steps = 22;
    const len = Rr.top - Rr.bottom;
    const sz = (Rr.minZ + Rr.maxZ) / 2, sw = Rr.maxZ - Rr.minZ;
    for (let i = 0; i < steps; i++) {
      const y = RY * (i + 1) / steps, x = Rr.bottom + len * (i + 0.5) / steps;
      scene.add(mesh(rbox(len / steps + 0.04, 0.06, sw, 0.012), M.wood(), x, y - 0.03, sz));
    }
    const ang = Math.atan2(RY, len), sl = Math.hypot(RY, len);
    for (const zz of [Rr.minZ + 0.03, Rr.maxZ - 0.03]) {
      const s = mesh(rbox(sl, 0.3, 0.06, 0.02), M.woodDark(), (Rr.top + Rr.bottom) / 2, RY / 2 - 0.1, zz); s.rotation.z = ang; scene.add(s);
      const r = mesh(rbox(sl, 0.05, 0.05, 0.01), M.woodDark(), (Rr.top + Rr.bottom) / 2, RY / 2 + 0.85, zz); r.rotation.z = ang; scene.add(r);
    }
    for (let i = 0; i <= 8; i++) { const t = i / 8; const x = Rr.bottom + len * t; for (const zz of [Rr.minZ + 0.03, Rr.maxZ - 0.03]) scene.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), M.woodDark(), x, RY * t + 0.45, zz)); }
    // 받침 기둥
    for (let i = 1; i <= 3; i++) { const t = i / 4; const x = Rr.bottom + len * t; for (const zz of [Rr.minZ + 0.08, Rr.maxZ - 0.08]) scene.add(mesh(rbox(0.1, RY * t - 0.1, 0.1, 0.02), M.woodDark(), x, (RY * t - 0.1) / 2, zz)); }
    // 계단 아래 낮은 쪽은 못 지나감 · 루프탑에서는 계단 위로 걸어 나가지 못함 (끝에서만 내려감)
    room.obstacles.push({ minX: Rr.bottom + 0.7, maxX: Rr.bottom + len * 0.45, minZ: Rr.minZ - 0.05, maxZ: Rr.maxZ + 0.05 });
    obst({ minX: Rr.bottom - 0.3, maxX: Rr.top - 0.5, minZ: Rr.minZ - 0.05, maxZ: Rr.maxZ + 0.1 });
  }
}

// ---------- 비밀 서재 ----------
function secretStudy(scene, room, books) {
  const x0 = CABIN.minX, x1 = -12.2, z0 = 5.8, z1 = CABIN.maxZ;
  const wallM = new THREE.MeshStandardMaterial({ map: logTexture('#c08e5e', 5), roughness: 0.9 });
  const obst = (r) => room.obstacles.push(r);
  // 안쪽 벽 두 장 (동쪽 벽엔 책장 문 자리)
  const doorZ0 = 7.1, doorZ1 = 8.4;
  const gN = new THREE.Group(), gE = new THREE.Group();
  gN.add(mesh(boxUV(x1 - x0, CABIN.H, 0.18), wallM, (x0 + x1) / 2, CABIN.H / 2, z0, { cast: false }));
  obst({ minX: x0, maxX: x1 + 0.1, minZ: z0 - 0.1, maxZ: z0 + 0.1 });
  for (const [a, b] of [[z0, doorZ0], [doorZ1, z1]]) { gE.add(mesh(boxUV(0.18, CABIN.H, b - a), wallM, x1, CABIN.H / 2, (a + b) / 2, { cast: false })); obst({ minX: x1 - 0.1, maxX: x1 + 0.1, minZ: a, maxZ: b }); }
  gE.add(mesh(rbox(0.3, 0.1, doorZ1 - doorZ0 + 0.2, 0.02), M.woodDark(), x1, 2.35, (doorZ0 + doorZ1) / 2));
  scene.add(gN, gE);
  // 카메라와 나 사이에 오면 접힘 (서재 근처에 있을 때만)
  room.walls.push({ group: gN, normal: V(0, 0, -1), at: z0, opacity: 1, span: [x0 - 0.5, x1 + 0.5], spanAxis: 'x' });
  room.walls.push({ group: gE, normal: V(1, 0, 0), at: x1, opacity: 1, span: [z0 - 0.5, z1 + 0.5], spanAxis: 'z' });
  // 책장 문: 경첩이 z = doorZ1 쪽, 서재 안쪽(-x)으로 열림
  const hinge = new THREE.Group();
  hinge.position.set(x1 + 0.06, 0, doorZ1);
  const leaf = new THREE.Group();
  leaf.position.z = -(doorZ1 - doorZ0) / 2;
  bookcase(leaf, { obstacles: [], seats: [] }, { x: 0, z: 0, rotY: Math.PI / 2, w: doorZ1 - doorZ0 - 0.04, h: 2.25, d: 0.32, rows: 5, books: [[]], live: true });
  hinge.add(leaf);
  scene.add(hinge);
  // 벽에 붙은 양옆 책장 (문과 이어져 보이게)
  bookcase(scene, room, { x: x1 + 0.16, z: (z0 + doorZ0) / 2 + 0.05, rotY: Math.PI / 2, w: doorZ0 - z0 - 0.1, h: 2.25, d: 0.32, rows: 5, noBooks: false, books: [[]] });
  bookcase(scene, room, { x: x1 + 0.16, z: (doorZ1 + z1) / 2 - 0.05, rotY: Math.PI / 2, w: z1 - doorZ1 - 0.1, h: 2.25, d: 0.32, rows: 5, books: [[]] });
  let open = 0;
  const center = new THREE.Vector3(x1, 0, (doorZ0 + doorZ1) / 2);
  room.doors.push({ center, update(dt, near) { open += ((near ? 1 : 0) - open) * (1 - Math.exp(-4 * dt)); hinge.rotation.y = -open * 1.5; } });
  // 서재 안
  const cxs = (x0 + x1) / 2, czs = (z0 + z1) / 2;
  rug(scene, cxs, czs, 3.0, 3.2, ['#5a3a30', '#c9a24a']);
  const desk = lowTable(scene, room, -14.4, 9.2, 0, 1.4, 0.65, 0.76, { book: '#7a3b2a' });
  deskLamp(desk, room, 0.45, 0.76, -0.15);
  desk.add(mesh(new THREE.SphereGeometry(0.14, 16, 12), M.color('#7fa36d', 0.6), -0.45, 0.76 + 0.2, 0.0));   // 지구본
  desk.add(mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.12, 8), M.woodDark(), -0.45, 0.76 + 0.06, 0.0));
  chair(scene, room, -14.4, 8.45, Math.PI, '#5a3a30', { name: '비밀 서재 책상', nook: true, appr: -0.5, desk: { h: 0.77, d: 0.55 } });
  armchair(scene, room, -15.2, 6.6, face(-15.2, 6.6, -13.5, 7.5), '#5a3a30', { name: '비밀 서재 안락의자', nook: true, blanket: '#c9a24a' });
  armchair(scene, room, -13.1, 6.6, face(-13.1, 6.6, -14.5, 7.5), '#3b4660', { name: '비밀 서재 안락의자', nook: true });
  cushion(scene, room, -12.9, 9.4, Math.PI, '#c9a24a', { name: '비밀 서재 구석 방석', nook: true });
  // 옛 지도 · 촛불 · 낮은 서랍장
  {
    const c = document.createElement('canvas'); c.width = 256; c.height = 192;
    const g = c.getContext('2d');
    g.fillStyle = '#d8c39a'; g.fillRect(0, 0, 256, 192);
    g.strokeStyle = '#6b4b36'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(30, 120); g.bezierCurveTo(60, 40, 150, 50, 220, 90); g.bezierCurveTo(200, 150, 100, 170, 30, 120); g.stroke();
    g.beginPath(); g.arc(190, 50, 18, 0, 7); g.stroke();
    for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(190, 50); g.lineTo(190 + Math.cos(i * 0.785) * 26, 50 + Math.sin(i * 0.785) * 26); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const fr = new THREE.Group();
    fr.add(mesh(rbox(1.5, 1.15, 0.04, 0.015), M.woodDark(), 0, 0, 0, { cast: false }));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    pic.position.z = 0.022;
    fr.add(pic);
    fr.position.set(-14.1, 2.2, z0 + 0.1);
    scene.add(fr);
    const candle = new THREE.MeshStandardMaterial({ color: '#f3ead8', emissive: '#ffb347', emissiveIntensity: 0 });
    for (const [x, z] of [[-12.9, 9.5], [-15.6, 9.4]]) {
      scene.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10), candle, x, 0.85, z));
      const gl = glowSprite('#ffb347', 0.6); gl.position.set(x, 0.98, z); scene.add(gl);
      room.nightParts.push((dt, t2, n) => { candle.emissiveIntensity = 0.3 + n * 1.2 + Math.sin(t2 * 11) * 0.1; gl.material.opacity = 0.2 + n * 0.5; });
      scene.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.76, 12), M.woodDark(), x, 0.38, z));
      obst(footprint(x, z, 0.34, 0.34));
    }
    const light = new THREE.PointLight('#ffb766', 0.3, 5, 1.6);
    light.position.set(cxs, 1.8, czs);
    scene.add(light);
    room.nightParts.push((dt, t2, n) => { light.intensity = 0.4 + n * 3.5; });
  }
  room.secret = { minX: x0, maxX: x1, minZ: z0, maxZ: z1 };
}

// ---------- 작은 부품들 ----------
function stairZ(scene, room, pl, mat) {
  const R = pl.ramp;
  const steps = 14;
  const len = R.bottom - R.top;
  const sw = R.maxX - R.minX, sx = (R.minX + R.maxX) / 2;
  for (let i = 0; i < steps; i++) {
    const y = pl.y * (i + 1) / steps, z = R.bottom - len * (i + 0.5) / steps;
    scene.add(mesh(rbox(sw, 0.06, len / steps + 0.04, 0.012), mat, sx, y - 0.03, z));
  }
  const ang = Math.atan2(pl.y, len), sl = Math.hypot(pl.y, len);
  for (const xx of [R.minX + 0.03, R.maxX - 0.03]) { const st = mesh(rbox(0.06, 0.3, sl, 0.02), M.woodDark(), xx, pl.y / 2 - 0.1, (R.top + R.bottom) / 2); st.rotation.x = ang; scene.add(st); }
  const rail = mesh(new THREE.CylinderGeometry(0.03, 0.03, sl, 8).rotateX(Math.PI / 2), M.woodDark(), R.maxX - 0.03, pl.y / 2 + 0.85, (R.top + R.bottom) / 2);
  rail.rotation.x = ang;
  scene.add(rail);
  for (let i = 0; i <= 4; i++) { const t = i / 4; scene.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), M.woodDark(), R.maxX - 0.03, pl.y * t + 0.45, R.bottom - len * t)); }
  room.obstacles.push({ minX: R.minX - 0.1, maxX: R.maxX + 0.04, minZ: R.top, maxZ: R.bottom - 0.5 });
}

export function readingTent(parent, room, x, z, rotY, o = {}) {
  const g = new THREE.Group();
  const fab = new THREE.MeshStandardMaterial({ map: M.fabric(o.color || '#efe0c7').map, roughness: 1, side: THREE.DoubleSide });
  const cone = mesh(new THREE.ConeGeometry(0.95, 1.7, 7, 1, true, 0.45, Math.PI * 2 - 0.9), fab, 0, 0.85, 0);
  cone.rotation.y = Math.PI / 2;
  g.add(cone);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; const pole = mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.95, 6), M.woodDark(), Math.cos(a) * 0.5, 0.95, Math.sin(a) * 0.5); pole.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(pole); }
  g.add(mesh(rbox(1.2, 0.08, 1.2, 0.04, 3), M.fabric('#d9a07a'), 0, 0.04, 0));
  g.position.set(x, o.fy || 0, z);
  g.rotation.y = rotY;
  parent.add(g);
  const ob = footprint(x, z, 1.0, 1.0, rotY); if (o.lv) ob.lv = o.lv; room.obstacles.push(ob);
  // 안에 앉는 자리 (입구는 +x 쪽)
  const f = V(Math.cos(rotY), 0, -Math.sin(rotY));
  const s = addSeat(room, x - f.x * 0.1, (o.fy || 0) + 0.12, z - f.z * 0.1, rotY + Math.PI / 2, { ...o, kind: 'floor', nook: true, appr: 0.95 });
  s.appr.set(x + f.x * 1.0, o.fy || 0, z + f.z * 1.0);
  room.boxes.push({ floor: V(x + f.x * 1.0, o.fy || 0, z + f.z * 1.0), inside: V(x - f.x * 0.2, (o.fy || 0) + 0.04, z - f.z * 0.2), rotY: rotY + Math.PI / 2, key: `tent:${x.toFixed(1)}:${z.toFixed(1)}`, lv: o.lv || 0, outdoor: !!o.outdoor });
  return s;
}

export function campChair(parent, room, x, z, rotY, color, o = {}) {
  const g = new THREE.Group();
  const fab = M.fabric(color);
  const fr = M.color('#4a4036', 0.5, { metalness: 0.4 });
  g.add(mesh(rbox(0.5, 0.03, 0.46, 0.01), fab, 0, 0.42, 0.02));
  const back = mesh(rbox(0.5, 0.5, 0.03, 0.01), fab, 0, 0.68, -0.2); back.rotation.x = -0.25; g.add(back);
  for (const sx of [-0.24, 0.24]) {
    const a = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6), fr, sx, 0.47, 0); a.rotation.x = 0.45; g.add(a);
    const b = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 6), fr, sx, 0.3, 0); b.rotation.x = -0.6; g.add(b);
    g.add(mesh(rbox(0.05, 0.02, 0.3, 0.01), M.woodMid(), sx, 0.6, 0.02));
  }
  g.position.set(x, o.fy || 0, z);
  g.rotation.y = rotY;
  parent.add(g);
  const ob = footprint(x, z, 0.54, 0.5, rotY); if (o.lv) ob.lv = o.lv; room.obstacles.push(ob);
  return addSeat(room, x, (o.fy || 0) + 0.46, z, rotY, { ...o, appr: o.appr ?? 0.55 });
}

export function hammock(parent, room, x, z, rotY, color, o = {}) {
  const g = new THREE.Group();
  const L = 2.4;
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(V((t - 0.5) * (L - 0.4), 1.15 - Math.sin(t * Math.PI) * 0.6, 0)); }
  const fab = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.22, 8), M.fabric(color));
  fab.scale.z = 1.6;
  fab.castShadow = true;
  g.add(fab);
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), M.color('#d9c7a5'), s * (L / 2 - 0.25), 1.2, 0));
    if (o.posts) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 8), M.woodDark(), s * L / 2, 0.75, 0));
  }
  g.position.set(x, o.fy || 0, z);
  g.rotation.y = rotY;
  parent.add(g);
  const ob = footprint(x, z, L - 0.6, 0.7, rotY); if (o.lv) ob.lv = o.lv; room.obstacles.push(ob);
  const s = addSeat(room, x, (o.fy || 0) + 0.62, z, rotY, { ...o, kind: 'hammock', appr: 0.7 });
  room.nightParts.push((dt, t) => { g.rotation.z = Math.sin(t * 0.9 + x) * 0.03; });
  return s;
}

// 화로 · 모닥불. o.id 를 주면 「장작 넣기 · 불멍」이 되는 불로 등록됩니다 (room.fires).
// 불 세기 = 밤이면 은은하게(0.6) + 넣은 장작(하나에 0.4, 2분 30초쯤 타서 줄어듦) + 막 넣었을 때 확 일어나는 불길
export const LOG_FUEL = 0.4, FUEL_MAX = 1.6, BURN = LOG_FUEL / 150;
let _spark;
function sparkTex() {
  if (_spark) return _spark;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.35, 'rgba(255,170,80,0.9)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  _spark = new THREE.CanvasTexture(c);
  return _spark;
}
export function firebowl(parent, room, x, z, fy = 0, o = {}) {
  const g = new THREE.Group();
  const iron = M.color('#3b3432', 0.6, { metalness: 0.35 });
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.3, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#3b3432', roughness: 0.6, metalness: 0.35, side: THREE.DoubleSide }), 0, 0.4, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 18), iron, 0, 0.26, 0));
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const leg = mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 6), iron, Math.cos(a) * 0.25, 0.14, Math.sin(a) * 0.25); leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); g.add(leg); }
  // 화로 안 장작 (타면 붉게 달아오름)
  const coal = new THREE.MeshStandardMaterial({ map: M.woodMid().map, color: '#6b4a33', emissive: '#ff4a12', emissiveIntensity: 0, roughness: 0.9 });
  for (let i = 0; i < 3; i++) { const l = mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.5, 8), coal, 0, 0.36, 0); l.rotation.set(Math.PI / 2, i * 1.05, 0); g.add(l); }
  const embers = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 18), new THREE.MeshBasicMaterial({ color: '#ff5a1a', transparent: true, opacity: 0 }), 0, 0.3, 0, { cast: false });
  g.add(embers);
  // 불꽃: 바깥 주황 + 안쪽 노랑
  const fm = new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: '#ff7a1f', emissiveIntensity: 0, transparent: true, opacity: 0.92 });
  const fy2 = new THREE.MeshStandardMaterial({ color: '#3a2008', emissive: '#ffd36a', emissiveIntensity: 0, transparent: true, opacity: 0.95 });
  const flames = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const f = mesh(new THREE.ConeGeometry(0.1, 0.42, 8).translate(0, 0.21, 0), fm, Math.cos(a) * 0.11, 0.38, Math.sin(a) * 0.11, { cast: false }); g.add(f); flames.push({ m: f, k: 1, ph: i * 1.7 }); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; const f = mesh(new THREE.ConeGeometry(0.06, 0.3, 8).translate(0, 0.15, 0), fy2, Math.cos(a) * 0.05, 0.38, Math.sin(a) * 0.05, { cast: false }); g.add(f); flames.push({ m: f, k: 0.75, ph: i * 2.3 + 1 }); }
  const light = new THREE.PointLight('#ff8c3a', 0, o.range || 7, 1.6);
  light.position.set(0, 0.8, 0);
  g.add(light);
  const gl = glowSprite('#ff9a4a', 2.0); gl.position.set(0, 0.7, 0); g.add(gl);
  // 불티 (작은 점이 위로 날아오름)
  const NS = 40;
  const sp = new Float32Array(NS * 3), sv = new Float32Array(NS * 3), sl = new Float32Array(NS);
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: '#ff9a3c', map: sparkTex(), size: 0.07, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false;
  for (let i = 0; i < NS; i++) sp[i * 3 + 1] = -99;
  g.add(sparks);
  let spawnAcc = 0;
  g.position.set(x, fy, z);
  parent.add(g);
  const ob = footprint(x, z, 0.9, 0.9); if (o.lv) ob.lv = o.lv; room.obstacles.push(ob);
  const rec = { id: o.id || null, name: o.name || '화로', g, fuel: o.fuel || 0, flare: 0, level: 0, lv: o.lv || 0, pile: null, world: () => g.getWorldPosition(new THREE.Vector3()) };
  if (o.id) {
    g.traverse((m) => { if (m.isMesh) m.userData.fireId = o.id; });
    (room.fires ||= []).push(rec);
  }
  room.nightParts.push((dt, t, n) => {
    rec.fuel = Math.max(0, rec.fuel - dt * BURN);
    rec.flare = Math.max(0, rec.flare - dt * 0.55);
    const base = o.always ? 1 : n * 0.6;
    const lvl = Math.min(FUEL_MAX + 0.2, base + rec.fuel + rec.flare * 0.6);
    rec.level = lvl;
    const f = 0.85 + Math.sin(t * 7.3 + x) * 0.1 + Math.sin(t * 12.1) * 0.06;
    const on = Math.min(1, lvl / 0.25);
    fm.emissiveIntensity = on * (1.6 + lvl * 0.8) * f;
    fy2.emissiveIntensity = on * (1.8 + lvl) * f;
    coal.emissiveIntensity = Math.min(1.2, (rec.fuel > 0 || n > 0.3 ? 0.25 : 0) + lvl * 0.5);
    embers.material.opacity = Math.min(0.85, lvl * 0.7);
    light.intensity = lvl * (o.power || 7) * 0.9 * f;
    gl.material.opacity = Math.min(0.9, lvl * 0.55) * f;
    gl.scale.setScalar(2 * (0.75 + lvl * 0.35));
    const tall = 0.55 + lvl * 0.55 + rec.flare * 0.6;
    for (const fl of flames) {
      fl.m.visible = lvl > 0.12;
      fl.m.scale.set(fl.k * (0.8 + lvl * 0.25), fl.k * tall * (0.75 + Math.sin(t * 9 + fl.ph) * 0.28 + Math.sin(t * 15 + fl.ph * 2) * 0.1), fl.k * (0.8 + lvl * 0.25));
      fl.m.rotation.z = Math.sin(t * 3 + fl.ph) * 0.12;
    }
    // 불티
    spawnAcc += dt * (lvl > 0.15 ? lvl * 10 + rec.flare * 50 : 0);
    for (let i = 0; i < NS; i++) {
      if (sl[i] > 0) {
        sl[i] -= dt;
        sv[i * 3 + 1] -= dt * 0.15;
        sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += sv[i * 3 + 2] * dt;
        if (sl[i] <= 0) sp[i * 3 + 1] = -99;
      } else if (spawnAcc >= 1) {
        spawnAcc -= 1;
        sl[i] = 0.8 + Math.random() * 1.2;
        sp[i * 3] = (Math.random() - 0.5) * 0.3; sp[i * 3 + 1] = 0.5; sp[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        sv[i * 3] = (Math.random() - 0.5) * 0.35; sv[i * 3 + 1] = 0.7 + Math.random() * 0.9 + rec.flare; sv[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
      }
    }
    if (spawnAcc > 3) spawnAcc = 3;
    sGeo.attributes.position.needsUpdate = true;
    sparks.material.opacity = 0.6 + Math.sin(t * 20) * 0.3;
  });
  return g;
}

// 장작더미: 말뚝 둘 사이에 통나무를 세 줄로 쌓고, 옆에 도끼 꽂힌 그루터기. 누르면 그 불에 장작을 넣음
export function woodpile(parent, room, x, z, fy = 0, rotY = 0, fireId, o = {}) {
  const g = new THREE.Group();
  const bark = [M.color('#6e4e36', 0.95), M.color('#7d5a3e', 0.95), M.color('#5e4330', 0.95)];
  const cut = M.color('#d9b98c', 0.8);
  const logs = [];
  const R = 0.075, L = 0.5;
  const rows = [6, 5, 4];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * R * 2.05, ly = R + r * R * 1.75;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(R * (0.9 + ((i * 7 + r) % 3) * 0.06), R, L, 9).rotateX(Math.PI / 2), [bark[(i + r) % 3], cut, cut]);
      m.position.set(lx, ly, ((i * 13 + r * 5) % 5 - 2) * 0.012);
      m.castShadow = m.receiveShadow = true;
      g.add(m); logs.push(m);
    }
  });
  for (const sx of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.62, 6), M.woodDark(), sx * (R * 6.4), 0.31, 0));
  // 그루터기 + 도끼
  const stump = new THREE.Group();
  stump.add(mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.38, 12), M.color('#7d5a3e', 0.95), 0, 0.19, 0));
  stump.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 12), cut, 0, 0.385, 0));
  const axe = new THREE.Group();
  axe.add(mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.5, 6), M.woodMid(), 0, 0.25, 0));
  axe.add(mesh(rbox(0.12, 0.08, 0.02, 0.005), M.color('#6d7276', 0.35, { metalness: 0.7 }), 0.04, 0.02, 0));
  axe.position.set(0.02, 0.4, 0); axe.rotation.z = -0.5;
  stump.add(axe);
  stump.position.set(R * 6.4 + 0.42, 0, 0.05);
  g.add(stump);
  // 쪼갠 장작 두어 개
  for (const [px, pz, ry] of [[-0.62, 0.22, 0.6], [-0.5, 0.32, -0.4]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.8, R * 0.8, 0.42, 3).rotateX(Math.PI / 2), [bark[0], cut, cut]); m.position.set(px, R * 0.65, pz); m.rotation.y = ry; m.castShadow = true; g.add(m); }
  g.position.set(x, fy, z);
  g.rotation.y = rotY;
  g.traverse((m) => { if (m.isMesh) m.userData.woodpile = fireId; });
  parent.add(g);
  const ob = footprint(x + Math.cos(rotY) * 0.22, z - Math.sin(rotY) * 0.22, 1.5, 0.6, rotY); if (o.lv) ob.lv = o.lv; room.obstacles.push(ob);
  const rec = (room.fires || []).find((f) => f.id === fireId);
  const pile = { g, logs, fireId, lv: o.lv || 0, world: () => g.getWorldPosition(new THREE.Vector3()), restock: 0 };
  // 장작을 집으러 서는 자리: 더미와 불 사이 (더미의 -z 쪽이 불을 향함)
  pile.stand = () => g.localToWorld(new THREE.Vector3(0, 0, -0.7)).setY(fy);
  pile.top = () => { const vis = logs.filter((l) => l.visible); const l = vis[vis.length - 1] || logs[0]; return l.getWorldPosition(new THREE.Vector3()); };
  if (rec) rec.pile = pile;
  return pile;
}

function pendant(scene, room, x, y, z) {
  const m = new THREE.MeshStandardMaterial({ color: '#f3dcb6', emissive: '#ffbf66', emissiveIntensity: 0.4 });
  const p = mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, x, y, z, { cast: false });
  p.rotation.x = Math.PI;
  scene.add(p);
  scene.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), M.color('#3e3029'), x, y + 0.15, z, { cast: false }));
  const gl = glowSprite('#ffc979', 1.1);
  gl.position.set(x, y - 0.1, z);
  scene.add(gl);
  room.nightParts.push((dt, t, n) => { m.emissiveIntensity = 0.5 + n; gl.material.opacity = 0.18 + n * 0.45; });
}

function signBoard(scene, x, y, z, a, b) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const draw = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 160);
    g.fillStyle = '#7a5134'; g.beginPath(); g.roundRect(0, 0, 512, 160, 40); g.fill();
    g.fillStyle = '#f7e6c8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 64px "Gowun Batang", serif'; g.fillText(a, 256, 64);
    g.font = '600 28px "Gowun Dodum", sans-serif'; g.fillText(b, 256, 122);
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.44), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8 }));
  m.position.set(x, y, z);
  m.rotation.y = Math.PI;
  m.userData.noHit = true;
  scene.add(m);
}

function endSign(scene, x, z, a, b) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const draw = () => {
    const p = c.getContext('2d');
    p.fillStyle = '#3b2a20'; p.fillRect(0, 0, 512, 128);
    p.fillStyle = '#f3e6cf'; p.textAlign = 'center'; p.textBaseline = 'middle';
    p.font = '700 40px "Gowun Batang", serif';
    p.fillText(`← ${b}`, 256, 40);
    p.fillText(`${a} →`, 256, 92);
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.155), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  m.position.set(x, 1.85, z + 0.03);
  m.userData.noHit = true;
  scene.add(m);
}

function windowFrame(g, along, at, ho, normal) {
  const mat = M.wood();
  const w = ho.a1 - ho.a0, h = ho.y1 - ho.y0, c = (ho.a0 + ho.a1) / 2, cy = (ho.y0 + ho.y1) / 2;
  const f = 0.09;
  const inward = -(normal.x + normal.z);
  const put = (m, a, y, off = 0) => {
    if (along === 'x') m.position.set(a, y, at + inward * off);
    else { m.position.set(at + inward * off, y, a); m.rotation.y = Math.PI / 2; }
    g.add(m);
  };
  put(mesh(rbox(w + f * 2, f, 0.26, 0.025), mat), c, ho.y1 + f / 2);
  put(mesh(rbox(w + f * 2 + 0.1, f * 0.8, 0.34, 0.025), mat), c, ho.y0 - f * 0.4, 0.05);
  put(mesh(rbox(f, h, 0.26, 0.025), mat), ho.a0 - f / 2, cy);
  put(mesh(rbox(f, h, 0.26, 0.025), mat), ho.a1 + f / 2, cy);
  put(mesh(rbox(0.045, h, 0.06, 0.012), mat), c, cy);
  put(mesh(rbox(w, 0.045, 0.06, 0.012), mat), c, cy + h * 0.15);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: '#dfeff5', transparent: true, opacity: 0.14, roughness: 0.05, side: THREE.DoubleSide }));
  glass.userData.noHit = true;
  put(glass, c, cy);
}

function frontDoor(g) {
  const z = CABIN.maxZ - 0.02;
  const x0 = FRONT.x0, x1 = FRONT.x1, h = FRONT.h;
  const w = x1 - x0, cx = (x0 + x1) / 2;
  const fm = M.woodDark();
  g.add(mesh(rbox(0.08, h, 0.24, 0.02), fm, x0 - 0.04, h / 2, z));
  g.add(mesh(rbox(0.08, h, 0.24, 0.02), fm, x1 + 0.04, h / 2, z));
  g.add(mesh(rbox(w + 0.16, 0.08, 0.24, 0.02), fm, cx, h + 0.04, z));
  g.add(mesh(rbox(1.2, 0.02, 0.6, 0.04), M.fabric('#c7865e'), cx, 0.01, CABIN.maxZ - 0.45, { cast: false }));
}

// 다가가면 열리는 문 (양문). axis: 문이 놓인 벽 방향
function swingDoor(scene, center, width, h, axis) {
  const half = width / 2;
  const glass = new THREE.MeshStandardMaterial({ color: '#d9ecf2', transparent: true, opacity: 0.35, roughness: 0.05 });
  const leaves = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    const leaf = new THREE.Group();
    const w = half - 0.02;
    leaf.add(mesh(rbox(0.05, h - 0.05, 0.07, 0.015), M.woodMid(), 0, h / 2, -s * (w / 2 - 0.035)));
    leaf.add(mesh(rbox(0.05, h - 0.05, 0.07, 0.015), M.woodMid(), 0, h / 2, s * (w / 2 - 0.035)));
    for (const y of [0.05, h * 0.42, h - 0.06]) leaf.add(mesh(rbox(0.05, 0.08, w, 0.015), M.woodMid(), 0, y, 0));
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.015, h - 0.2, w - 0.1), glass);
    pane.position.y = h / 2;
    leaf.add(pane);
    leaf.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), M.color('#c9a24a', 0.3, { metalness: 0.6 }), 0.05, 1.0, -s * (w / 2 - 0.1)));
    leaf.position.z = -s * half / 2;
    hinge.add(leaf);
    if (axis === 'z') hinge.position.set(center.x + 0.04, 0, center.z + s * half);
    else { hinge.position.set(center.x - s * half, 0, center.z + 0.04); hinge.rotation.y = -Math.PI / 2; }
    scene.add(hinge);
    leaves.push({ hinge, s });
  }
  let open = 0;
  return {
    center: center.clone(),
    update(dt, near) {
      open += ((near ? 1 : 0) - open) * (1 - Math.exp(-5 * dt));
      for (const L of leaves) L.hinge.rotation.y = (axis === 'z' ? 0 : -Math.PI / 2) + L.s * open * 1.45;
    },
  };
}

function plant(scene, room, x, z, s, rnd) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.34, 16), M.color('#d8916e', 0.9), 0, 0.17, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16), M.color('#6b4b36', 1), 0, 0.345, 0, { cast: false }));
  const leafCols = ['#7ead6f', '#8fbd7e', '#6e9c62', '#a0c88d'];
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2;
    const h = 0.5 + rnd() * 0.55;
    const leaf = mesh(new THREE.SphereGeometry(0.12, 10, 8), M.color(leafCols[i % 4], 1), Math.cos(a) * (0.08 + h * 0.3), 0.34 + h, Math.sin(a) * (0.08 + h * 0.3));
    leaf.scale.set(1, 0.35, 0.6);
    leaf.rotation.set(0, -a, 0.5);
    g.add(leaf);
    const stem = mesh(new THREE.CylinderGeometry(0.008, 0.01, h, 5), M.color('#5d8452'), Math.cos(a) * 0.04, 0.34 + h / 2, Math.sin(a) * 0.04);
    stem.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    g.add(stem);
  }
  g.scale.setScalar(s);
  g.position.set(x, 0, z);
  scene.add(g);
  room.obstacles.push({ minX: x - 0.25 * s, maxX: x + 0.25 * s, minZ: z - 0.25 * s, maxZ: z + 0.25 * s });
}

export { boxUV };
void CONFIG;

// 도서목록 판: 책장 옆에 세워 둔 액자. 누르면 그 분야의 서가 목록이 열림
export function catalogBoard(scene, room, x, z, rotY, field, title, lines = [], color = '#3b2a20') {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 384; c.height = 512;
  const draw = () => {
    const p = c.getContext('2d');
    p.fillStyle = '#f3e6cf'; p.fillRect(0, 0, 384, 512);
    p.fillStyle = color; p.fillRect(0, 0, 384, 86);
    p.fillStyle = '#f7ecd8'; p.textAlign = 'center'; p.textBaseline = 'middle';
    p.font = '700 40px "Gowun Batang", serif'; p.fillText(title, 192, 44);
    p.fillStyle = '#3f2c20'; p.textAlign = 'left';
    p.font = '26px "Gowun Dodum", sans-serif';
    lines.slice(0, 11).forEach((l, i) => p.fillText(l.length > 15 ? l.slice(0, 14) + '…' : l, 22, 122 + i * 34));
    p.fillStyle = '#7d6553'; p.font = '22px "Gowun Dodum", sans-serif'; p.textAlign = 'center';
    p.fillText('눌러서 도서목록 보기', 192, 488);
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
  g.add(mesh(rbox(0.9, 1.2, 0.05, 0.015), M.woodDark(), 0, 1.3, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.07), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  face.position.set(0, 1.3, 0.03);
  g.add(face);
  for (const s of [-0.3, 0.3]) { const leg = mesh(rbox(0.04, 0.75, 0.04, 0.01), M.woodDark(), s, 0.37, -0.12); leg.rotation.x = 0.3; g.add(leg); g.add(mesh(rbox(0.04, 0.75, 0.04, 0.01), M.woodDark(), s, 0.37, 0.0)); }
  g.traverse((o) => { o.userData.catalog = field; });
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
  room.obstacles.push(footprint(x, z, 0.9, 0.3, rotY));
  return g;
}

// 도구 손수레: 지도 · 놀이판 · 계보가 놓인 손수레. 누르면 도구 모음이 열림
export function toolCart(scene, room, x, z, rotY) {
  const g = new THREE.Group();
  plank(g, 1.3, 0.05, 0.6, 0, 0.78, 0, M.wood(), 0.02);
  plank(g, 1.3, 0.05, 0.6, 0, 0.38, 0, M.woodLight(), 0.02);
  for (const sx of [-0.6, 0.6]) for (const sz of [-0.25, 0.25]) plank(g, 0.04, 0.78, 0.04, sx, 0.39, sz, M.woodMid(), 0.01);
  for (const sx of [-0.45, 0.45]) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16).rotateZ(Math.PI / 2), M.woodDark(), sx, 0.1, 0.33));
  g.add(mesh(new THREE.SphereGeometry(0.13, 16, 12), M.color('#7fa36d', 0.6), -0.42, 0.98, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.12, 8), M.woodDark(), -0.42, 0.86, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 10).rotateZ(Math.PI / 2), M.color('#e8dcc0', 0.9), 0.05, 0.84, -0.15));
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.46, 10).rotateZ(Math.PI / 2), M.color('#d9c7a5', 0.9), 0.1, 0.84, 0.1));
  g.add(mesh(rbox(0.3, 0.14, 0.24, 0.02), M.color('#1f6f6b', 0.8), 0.4, 0.88, 0.05));
  g.add(mesh(rbox(0.28, 0.02, 0.22, 0.01), M.color('#f0b93a', 0.8), 0.4, 0.96, 0.05));
  g.add(mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), M.color('#8a7b6c', 0.3, { metalness: 0.6 }), -0.1, 0.83, 0.22));
  g.add(mesh(rbox(0.5, 0.2, 0.4, 0.02), M.color('#c9a77a', 1), -0.3, 0.5, 0));
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const draw = () => { const p = c.getContext('2d'); p.fillStyle = '#3e3a36'; p.fillRect(0, 0, 256, 96); p.fillStyle = '#f2e7d3'; p.textAlign = 'center'; p.textBaseline = 'middle'; p.font = '700 34px "Gowun Batang", serif'; p.fillText('도구 모음', 128, 36); p.font = '20px "Gowun Dodum", sans-serif'; p.fillText('과학 놀이판 · 지도', 128, 72); };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.22), new THREE.MeshStandardMaterial({ map: t }));
  sign.position.set(0, 0.62, 0.31);
  g.add(sign);
  g.traverse((o) => { o.userData.tools = true; });
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
  room.obstacles.push(footprint(x, z, 1.4, 0.7, rotY));
  room.toolCart = V(x, 0, z);
  return g;
}

// 캣타워 앞 작은 나무 명판 (이름만 — 광고 문구 없이)
function namePlate(p) {
  const name = CONFIG.products[p.key]?.name;
  if (!name) return;
  const [x0, x1, , z1] = p.navBounds || [-0.4, 0.4, 0, 0.2];
  const c = document.createElement('canvas'); c.width = 384; c.height = 72;
  const draw = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 384, 72);
    g.fillStyle = '#e8cfa6'; g.beginPath(); g.roundRect(2, 2, 380, 68, 12); g.fill();
    g.strokeStyle = '#8a5a3c'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#5a3a26'; g.font = '700 30px "Gowun Batang", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, 192, 38);
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.116), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
  m.position.set((x0 + x1) / 2 + Math.min(0.6, (x1 - x0) * 0.3), 0.1, z1 + 0.012);
  m.userData.product = p.key;
  p.root.add(m);
}

// 벽난로 옆 장작 바구니 (등나무 바구니에 장작 아홉 개)
function logBasket(scene, room, x, z, fireId) {
  const g = new THREE.Group();
  const wick = M.color('#b88a52', 0.95);
  const W = 0.62, D = 0.42, Hb = 0.34;
  g.add(mesh(rbox(W, 0.04, D, 0.02), wick, 0, 0.02, 0));
  for (const s of [-1, 1]) { g.add(mesh(rbox(W, Hb, 0.03, 0.01), wick, 0, Hb / 2, s * D / 2)); g.add(mesh(rbox(0.03, Hb, D, 0.01), wick, s * W / 2, Hb / 2, 0)); }
  for (let i = 0; i < 5; i++) g.add(mesh(rbox(W + 0.01, 0.012, D + 0.01, 0.004), M.color('#8f6436', 0.9), 0, 0.06 + i * 0.065, 0, { cast: false }));
  for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 14, Math.PI), M.color('#8f6436', 0.9), s * (W / 2 - 0.02), Hb + 0.01, 0); h.rotation.y = Math.PI / 2; g.add(h); }
  const bark = [M.color('#6e4e36', 0.95), M.color('#7d5a3e', 0.95)], cut = M.color('#d9b98c', 0.8);
  const logs = [];
  [[4, 0.14], [3, 0.27], [2, 0.39]].forEach(([n, y], r) => {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.55, 8).rotateZ(Math.PI / 2), [bark[(i + r) % 2], cut, cut]);
      m.position.set(((i * 5 + r) % 3 - 1) * 0.02, y, (i - (n - 1) / 2) * 0.12);
      m.castShadow = true;
      g.add(m); logs.push(m);
    }
  });
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 2;
  g.traverse((m) => { if (m.isMesh) m.userData.woodpile = fireId; });
  scene.add(g);
  room.obstacles.push(footprint(x, z, D + 0.08, W + 0.08));
  const rec = (room.fires || []).find((f) => f.id === fireId);
  const pile = { g, logs, fireId, lv: 0, restock: 0, world: () => g.getWorldPosition(new THREE.Vector3()) };
  pile.stand = () => V(x + 0.8, 0, z - 0.1);
  pile.top = () => { const vis = logs.filter((l) => l.visible); const l = vis[vis.length - 1] || logs[0]; return l.getWorldPosition(new THREE.Vector3()); };
  if (rec) rec.pile = pile;
}

// 카운터 왼쪽 끝: 고양이 장난감 바구니 (누르면 장난감 대여)
function toyBasket(scene, x, y, z) {
  const g = new THREE.Group();
  const wick = M.color('#c9a06a', 0.95);
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.16, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#c9a06a', roughness: 0.95, side: THREE.DoubleSide }), 0, 0.08, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 16), wick, 0, 0.005, 0));
  // 깃털 낚싯대 두 개
  for (const [a, col] of [[0.35, '#e86f8a'], [-0.25, '#6fb7e8']]) {
    const w = new THREE.Group();
    w.add(mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.6, 6), M.woodMid(), 0, 0.3, 0));
    w.add(mesh(new THREE.ConeGeometry(0.035, 0.12, 6), M.color(col, 0.9), 0, 0.62, 0));
    w.position.set(a * 0.15, 0.05, 0); w.rotation.z = a;
    g.add(w);
  }
  g.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), M.color('#f1c45b', 0.6, { metalness: 0.3 }), 0.06, 0.17, 0.06));
  g.add(mesh(new THREE.SphereGeometry(0.05, 10, 8).scale(1, 0.8, 1.6), M.color('#9a9a96', 1), -0.07, 0.17, -0.03));
  g.add(mesh(rbox(0.12, 0.05, 0.09, 0.02), M.color('#9cc58a', 1), 0.0, 0.18, -0.08));
  // 작은 이름표
  const tag = textSprite('🧸 장난감 빌리기', { height: 0.05 });
  tag.position.set(0, 0.62, 0); tag.userData.noHit = true;
  g.add(tag);
  g.position.set(x, y, z);
  g.traverse((o) => { o.userData.toys = true; });
  tag.userData.toys = false;
  scene.add(g);
}

// 카운터 오른쪽 끝: 「고양이서가」 작은 안내판 (누를 때만 스마트스토어 링크 카드)
function storeStand(scene, x, y, z) {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const draw = () => {
    const p = c.getContext('2d');
    p.fillStyle = '#f4ecdf'; p.fillRect(0, 0, 256, 320);
    p.strokeStyle = '#a8744a'; p.lineWidth = 6; p.strokeRect(6, 6, 244, 308);
    p.fillStyle = '#6d4630'; p.textAlign = 'center';
    p.font = '700 34px "Gowun Batang", serif'; p.fillText('고양이서가', 128, 64);
    p.font = '22px "Gowun Dodum", sans-serif';
    ['이 서점의 캣타워는', '모두 고양이서가', '원목 캣타워예요', '', '눌러서 둘러보기'].forEach((s2, i) => p.fillText(s2, 128, 122 + i * 34));
    // 고양이 얼굴
    p.fillStyle = '#c4935f';
    p.beginPath(); p.arc(128, 286, 16, 0, Math.PI * 2); p.fill();
    p.beginPath(); p.moveTo(114, 278); p.lineTo(116, 262); p.lineTo(124, 272); p.fill();
    p.beginPath(); p.moveTo(142, 278); p.lineTo(140, 262); p.lineTo(132, 272); p.fill();
  };
  draw();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.ready.then(() => { draw(); tex.needsUpdate = true; });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.275), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  board.position.set(0, 0.16, 0.012); board.rotation.x = -0.12;
  g.add(board);
  g.add(mesh(rbox(0.24, 0.3, 0.018, 0.006), M.woodMid(), 0, 0.16, 0));
  const leg = mesh(rbox(0.03, 0.22, 0.02, 0.005), M.woodMid(), 0, 0.12, -0.08); leg.rotation.x = 0.35; g.add(leg);
  g.position.set(x, y, z);
  g.rotation.y = 0.25 + Math.PI;
  g.traverse((o) => { o.userData.store = true; });
  scene.add(g);
}

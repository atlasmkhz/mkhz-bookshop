// 오두막 독립서점 실내: 나무 들보, 벽난로, 높은 책장, 사다리, 스탠드 조명, 2층 다락
// 숨어 읽는 자리: 책장 사이 막다른 골목, 계단 뒤 구석, 다락 구석, 창가 독서 의자, 벽난로 앞 방석
import * as THREE from 'three';
import { M, rbox, mesh, plank, floorTexture, logTexture, stoneTexture, mulberry, footprint, glowSprite } from './kit.js';
import { CABIN, DOOR, FRONT, PLATFORMS } from './nav.js';
import { armchair, cushion, beanbag, stool, bench, floorLamp, deskLamp, rug, lowTable, chair, addSeat } from './furniture.js';
import { bookcase, displayTable } from './shelves.js';

const WT = 0.22;
const H = CABIN.H;
const LOFT = PLATFORMS[0];
const LY = LOFT.y;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

// 판자 크기에 맞춰 무늬 반복 (늘어나 보이지 않게)
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

export function buildCabin(scene, books) {
  const room = {
    walls: [], seats: [], obstacles: [], beams: [], nightParts: [], benchSpots: [], gardenSpots: [], sunSpots: [],
    boxes: [], climbs: [], hideables: [], update: () => {}, bookHits: [], counter: null, suggest: null,
  };
  const rnd = mulberry(42);
  const W = CABIN.maxX - CABIN.minX, D = CABIN.maxZ - CABIN.minZ;
  const cx = (CABIN.minX + CABIN.maxX) / 2;
  const byShelf = (atlas, shelf) => books.filter((b) => b.atlas === atlas && (!shelf || b.shelf === shelf));
  const half = (arr, k) => (k === 0 ? arr.slice(0, Math.ceil(arr.length / 2)) : arr.slice(Math.ceil(arr.length / 2)));

  // ---------- 마루 ----------
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.66 });
  floorMat.map.repeat.set(W / 4, D / 4);
  const floor = mesh(new THREE.BoxGeometry(W, 0.06, D), floorMat, cx, 0.0, 0, { cast: false });
  floor.position.y = -0.03;
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
      // 안쪽 면은 밝은 통나무, 바깥은 짙은 통나무
      const outer = mesh(geo, logMat, px, my, pz, { cast: false });
      g.add(outer);
      const innerGeo = along === 'x' ? boxUV(len, hh, 0.02) : boxUV(0.02, hh, len);
      g.add(mesh(innerGeo, logIn, along === 'x' ? mid : at - normal.x * 0.012, my, along === 'x' ? at - normal.z * 0.012 : mid, { cast: false }));
      const sh = new THREE.Mesh(geo, shadowOnly);
      sh.position.set(px, my, pz);
      sh.castShadow = true;
      sh.userData.noHit = true;
      scene.add(sh);
    }
    // 창틀
    for (const ho of holes) if (ho.win) windowFrame(g, along, at, ho, normal);
    if (extra) extra(g);
    scene.add(g);
    // 벽이 내려가도 바닥 둘레에 낮은 턱이 남음
    const len = a1 - a0;
    const lip = mesh(rbox(along === 'x' ? len + WT * 2 : WT, 0.24, along === 'x' ? WT : len, 0.03), M.woodDark(),
      along === 'x' ? (a0 + a1) / 2 : at + normal.x * WT / 2, 0.12, along === 'x' ? at + normal.z * WT / 2 : (a0 + a1) / 2, { cast: false });
    lip.userData.noHit = true;
    scene.add(lip);
    g.userData.fade = 1;
    const wall = { group: g, normal, at, opacity: 1 };
    room.walls.push(wall);
    return wall;
  }

  // 북쪽(뒤) 벽: 다락 둥근 창
  makeWall('back', V(0, 0, -1), CABIN.minZ, 'x', CABIN.minX - WT, CABIN.maxX + WT, [
    { a0: -6.1, a1: -4.9, y0: 3.5, y1: 4.7, win: true, round: true },
  ]);
  // 서쪽 벽: 벽난로 굴뚝이 지나감
  makeWall('west', V(-1, 0, 0), CABIN.minX, 'z', CABIN.minZ, CABIN.maxZ, [
    { a0: 5.6, a1: 6.6, y0: 1.0, y1: 2.3, win: true },
  ]);
  // 동쪽 벽: 정원 문 + 창가 독서 의자 창 + 퇴창
  makeWall('east', V(1, 0, 0), CABIN.maxX, 'z', CABIN.minZ, CABIN.maxZ, [
    { a0: -5.6, a1: -3.0, y0: 0.85, y1: 2.5, win: true },
    { a0: DOOR.z0, a1: DOOR.z1, y0: 0, y1: DOOR.h },
    { a0: 2.2, a1: 4.6, y0: 0.7, y1: 2.3, win: true },
  ], (g) => {
    const lamp = mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffcf7a', emissiveIntensity: 0.2 }), CABIN.maxX + WT + 0.14, 2.75, 1.25, { cast: false });
    g.add(lamp);
    room.nightParts.push((dt, t, n) => { lamp.material.emissiveIntensity = 0.2 + n * 1.8; });
  });
  // 남쪽(앞) 벽: 현관 + 소파 위 창
  makeWall('front', V(0, 0, 1), CABIN.maxZ, 'x', CABIN.minX - WT, CABIN.maxX + WT, [
    { a0: FRONT.x0, a1: FRONT.x1, y0: 0, y1: FRONT.h },
    { a0: 0.6, a1: 3.4, y0: 1.2, y1: 2.6, win: true },
    { a0: -7.6, a1: -6.0, y0: 1.6, y1: 2.6, win: true },
  ], (g) => frontDoor(g));
  room.walls.forEach((w) => { w.isCabin = true; });

  // 벽 = 장애물 (정원 문만 지나갈 수 있음). 오두막 바깥 남 · 북쪽은 숲이라 못 들어감
  room.obstacles.push(
    { minX: CABIN.maxX - 0.05, maxX: CABIN.maxX + WT + 0.05, minZ: CABIN.minZ - 1, maxZ: DOOR.z0, wall: true },
    { minX: CABIN.maxX - 0.05, maxX: CABIN.maxX + WT + 0.05, minZ: DOOR.z1, maxZ: CABIN.maxZ + 1, wall: true },
    { minX: CABIN.minX - 2, maxX: CABIN.maxX + WT + 0.05, minZ: -40, maxZ: CABIN.minZ, wall: true },
    { minX: CABIN.minX - 2, maxX: CABIN.maxX + WT + 0.05, minZ: CABIN.maxZ, maxZ: 40, wall: true },
  );

  // ---------- 들보 · 기둥 ----------
  const beamMat = M.woodDark();
  // 들보는 카메라와 나 사이에 오면 잠시 접힘 (위에서 내려다보는 시점이라)
  for (const z of [-5.2, -1.4, 2.4, 5.6]) {
    const b = mesh(rbox(W + WT * 2, 0.26, 0.24, 0.03), beamMat, cx, H - 0.35, z);
    b.userData.noHit = true; b.castShadow = true;
    scene.add(b);
    room.beams.push({ m: b, axis: 'z', at: z });
  }
  for (const x of [-6.5, -2.5, 1.5]) {
    const b = mesh(rbox(0.2, 0.2, D, 0.03), beamMat, x, H - 0.1, 0);
    b.userData.noHit = true;
    scene.add(b);
    room.beams.push({ m: b, axis: 'x', at: x });
  }
  // 다락 앞 기둥
  for (const x of [-7.4, -5.2, -3.0, -1.3]) {
    scene.add(mesh(rbox(0.2, LY, 0.2, 0.03), beamMat, x, LY / 2, LOFT.rect.maxZ + 0.05));
    room.obstacles.push(footprint(x, LOFT.rect.maxZ + 0.05, 0.22, 0.22));
  }

  // ---------- 지붕 (밖에 있을 때만 보임) ----------
  const roof = new THREE.Group();
  {
    const rm = new THREE.MeshStandardMaterial({ map: logTexture('#6d4b36', 21), roughness: 0.95 });
    const span = D / 2 + 0.7, rise = 2.6;
    const slope = Math.hypot(span, rise);
    const ang = Math.atan2(rise, span);
    for (const s of [-1, 1]) {
      const p = mesh(boxUV(W + 1.4, 0.18, slope, 2), rm, cx, H + rise / 2, s * span / 2);
      p.rotation.x = s * ang;
      roof.add(p);
    }
    const ch = mesh(rbox(0.8, 2.4, 0.9, 0.04), new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 1 }), CABIN.minX + 0.4, H + 1.6, 3.9);
    roof.add(ch);
    roof.traverse((o) => { o.userData.noHit = true; });
    scene.add(roof);
  }
  room.roof = roof;

  // ---------- 벽난로 (서쪽 벽) ----------
  const fire = { x: CABIN.minX + 0.45, z: 3.9 };
  {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ map: stoneTexture('#9d9284'), roughness: 1 });
    g.add(mesh(rbox(0.9, 1.5, 2.2, 0.05), stone, 0, 0.75, 0));
    g.add(mesh(rbox(0.6, H - 1.5, 1.2, 0.04), stone, -0.1, 1.5 + (H - 1.5) / 2, 0));
    g.add(mesh(rbox(1.15, 0.12, 2.4, 0.03), M.woodDark(), 0.08, 1.56, 0));   // 선반
    g.add(mesh(rbox(1.1, 0.1, 2.5, 0.03), stone, 0.3, 0.05, 0));             // 앞 돌판
    const hole = mesh(rbox(0.3, 0.8, 1.2, 0.04), M.color('#1c120c', 1), 0.33, 0.55, 0, { cast: false });
    g.add(hole);
    const fireMat = new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: '#ff8a2a', emissiveIntensity: 1 });
    const logs = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const l = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 8).rotateX(Math.PI / 2), M.woodMid(), 0.36, 0.22 + (i === 2 ? 0.1 : 0), (i - 1) * 0.12);
      l.rotation.y = (i - 1) * 0.3;
      logs.add(l);
    }
    g.add(logs);
    const flames = [];
    for (let i = 0; i < 5; i++) {
      const f = mesh(new THREE.ConeGeometry(0.08 + (i % 2) * 0.04, 0.34, 8), fireMat, 0.38, 0.42, (i - 2) * 0.12, { cast: false });
      g.add(f); flames.push(f);
    }
    const glow = glowSprite('#ff9a4a', 1.6);
    glow.position.set(0.6, 0.6, 0);
    g.add(glow);
    // 선반 위 소품: 촛대 · 책 · 시계
    for (const [zz, c] of [[-0.8, '#7a3b2a'], [-0.7, '#1f2c4d'], [-0.62, '#1f6f6b']]) g.add(mesh(rbox(0.22, 0.3, 0.06, 0.01), M.color(c), 0.05, 1.77, zz));
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), M.color('#f3ead8'), 0.1, 1.72, 0.7));
    const light = new THREE.PointLight('#ff8c3a', 1.5, 7, 1.7);
    light.position.set(0.9, 0.7, 0);
    g.add(light);
    g.position.set(fire.x, 0, fire.z);
    scene.add(g);
    room.obstacles.push({ minX: CABIN.minX - 0.1, maxX: CABIN.minX + 1.0, minZ: fire.z - 1.15, maxZ: fire.z + 1.15 });
    room.stoveSpot = V(CABIN.minX + 1.35, 0, fire.z + 0.3);
    room.fire = V(fire.x + 0.4, 0.4, fire.z);
    room.nightParts.push((dt, t, n) => {
      const f = 0.85 + Math.sin(t * 7.3) * 0.08 + Math.sin(t * 13.1) * 0.06 + Math.sin(t * 3.1) * 0.05;
      fireMat.emissiveIntensity = (1.1 + n * 0.9) * f;
      light.intensity = (1.4 + n * 6) * f;
      glow.material.opacity = (0.35 + n * 0.4) * f;
      flames.forEach((fl, i) => { fl.scale.y = 0.8 + Math.sin(t * 9 + i * 1.7) * 0.25; });
    });
  }
  // 벽난로 앞: 러그 + 방석 + 의자
  rug(scene, -7.9, fire.z, 2.4, 2.8, ['#8f4a37', '#e3c79a']);
  const fx = fire.x + 0.4;
  cushion(scene, room, -8.4, 3.25, face(-8.4, 3.25, fx, fire.z), '#c98f6b', { name: '벽난로 앞 방석' });
  cushion(scene, room, -8.4, 4.55, face(-8.4, 4.55, fx, fire.z), '#a9bba0', { name: '벽난로 앞 방석' });
  cushion(scene, room, -7.55, 3.9, face(-7.55, 3.9, fx, fire.z), '#e6cf9c', { name: '벽난로 앞 방석' });
  armchair(scene, room, -7.15, 2.4, face(-7.15, 2.4, fx, fire.z), '#8a5a44', { name: '벽난로 곁 안락의자', blanket: '#d79a7c' });
  armchair(scene, room, -7.15, 5.3, face(-7.15, 5.3, fx, fire.z), '#5f6b4e', { name: '벽난로 곁 안락의자' });
  beanbag(scene, room, -6.25, 3.9, face(-6.25, 3.9, fx, fire.z), '#b6a27c', { name: '벽난로 앞 빈백' });
  room.benchSpots.push(V(-8.9, 0.1, 3.9));

  // ---------- 계단 (다락으로) ----------
  {
    const R = LOFT.ramp;
    const steps = 14;
    const len = R.bottom - R.top;
    const sw = R.maxX - R.minX;
    const sx = (R.minX + R.maxX) / 2;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const y = LY * (i + 1) / steps;
      const z = R.bottom - len * (t0 + 0.5 / steps);
      scene.add(mesh(rbox(sw, 0.06, len / steps + 0.04, 0.012), M.wood(), sx, y - 0.03, z));
    }
    // 옆판 · 난간
    const ang = Math.atan2(LY, len);
    const sl = Math.hypot(LY, len);
    for (const xx of [R.minX + 0.03, R.maxX - 0.03]) {
      const st = mesh(rbox(0.06, 0.3, sl, 0.02), M.woodDark(), xx, LY / 2 - 0.1, (R.top + R.bottom) / 2);
      st.rotation.x = ang;
      scene.add(st);
    }
    const rail = mesh(new THREE.CylinderGeometry(0.03, 0.03, sl, 8).rotateX(Math.PI / 2), M.woodDark(), R.maxX - 0.03, LY / 2 + 0.85, (R.top + R.bottom) / 2);
    rail.rotation.x = ang;
    scene.add(rail);
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const y = LY * t;
      scene.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), M.woodDark(), R.maxX - 0.03, y + 0.45, R.bottom - len * t));
    }
    // 계단 아래 (바닥에선 못 들어감)
    room.obstacles.push({ minX: R.minX - 0.1, maxX: R.maxX + 0.04, minZ: R.top, maxZ: R.bottom - 0.5 });
  }

  // ---------- 다락 (2층) ----------
  const loft = new THREE.Group();
  {
    const R = LOFT.rect;
    const lw = R.maxX - R.minX + 0.1, ld = R.maxZ - R.minZ + 0.1;
    const lfm = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.7 });
    lfm.map = lfm.map.clone(); lfm.map.needsUpdate = true; lfm.map.repeat.set(lw / 4, ld / 4);
    const lf = mesh(new THREE.BoxGeometry(lw, 0.16, ld), lfm, (R.minX + R.maxX) / 2, LY - 0.08, (R.minZ + R.maxZ) / 2);
    lf.name = 'loftFloor';
    loft.add(lf);
    loft.add(mesh(rbox(lw, 0.24, 0.24, 0.03), beamMat, (R.minX + R.maxX) / 2, LY - 0.2, R.maxZ + 0.02));
    // 난간 (계단 쪽은 열림)
    const railM = M.woodDark();
    const rz = R.maxZ - 0.02;
    loft.add(mesh(rbox(R.maxX - LOFT.ramp.maxX, 0.06, 0.08, 0.02), railM, (LOFT.ramp.maxX + R.maxX) / 2, LY + 0.88, rz));
    for (let x = LOFT.ramp.maxX + 0.05; x <= R.maxX + 0.01; x += 0.35) loft.add(mesh(rbox(0.04, 0.88, 0.04, 0.01), railM, x, LY + 0.44, rz));
    loft.add(mesh(rbox(0.08, 0.06, ld, 0.02), railM, R.maxX - 0.02, LY + 0.88, (R.minZ + R.maxZ) / 2));
    for (let z = R.minZ + 0.1; z < R.maxZ; z += 0.35) loft.add(mesh(rbox(0.04, 0.88, 0.04, 0.01), railM, R.maxX - 0.02, LY + 0.44, z));
    // 다락 서까래 (낮은 지붕 느낌)
    for (let x = R.minX + 0.6; x < R.maxX; x += 1.5) {
      const r = mesh(rbox(0.12, 0.12, ld, 0.02), beamMat, x, LY + 2.1, (R.minZ + R.maxZ) / 2);
      r.userData.noHit = true;
      loft.add(r);
      room.beams.push({ m: r, axis: 'x', at: x });
    }
    scene.add(loft);
  }
  const loftRoomStart = room.seats.length;
  const lo = { fy: LY, lv: 1 };
  // 북쪽 낮은 책장 (장식 책)
  bookcase(loft, room, { x: -5.4, z: -6.68, w: 5.4, h: 0.95, d: 0.36, rows: 2, fy: LY, lv: 1 });
  // 다락 구석: 커튼 친 담요 굴
  {
    const g = new THREE.Group();
    const cur = M.fabric('#c9b6e4');
    for (let i = 0; i < 5; i++) {
      const f = mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 10), cur, -8.45, LY + 0.95, -6.75 + i * 0.12);
      f.scale.z = 0.5;
      g.add(f);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.4, 6).rotateX(Math.PI / 2), M.woodDark(), -8.45, LY + 1.92, -5.7));
    g.add(mesh(rbox(1.3, 0.12, 2.0, 0.05, 3), M.fabric('#efe0c7'), -9.25, LY + 0.06, -5.8));
    const lights = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.MeshStandardMaterial({ color: '#ffe3a0', emissive: '#ffcf7a', emissiveIntensity: 0.2 });
      g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), m, -9.85, LY + 1.5 - Math.sin(i / 8 * Math.PI) * 0.25, -6.7 + i * 0.25, { cast: false }));
      lights.push(m);
    }
    room.nightParts.push((dt, t, n) => lights.forEach((m, i) => { m.emissiveIntensity = 0.3 + n * (1.4 + Math.sin(t * 1.5 + i) * 0.3); }));
    loft.add(g);
  }
  cushion(loft, room, -9.3, -6.3, Math.PI / 2, '#d9a07a', { ...lo, name: '다락 구석', nook: true });
  cushion(loft, room, -9.3, -5.35, Math.PI / 2, '#a9bba0', { ...lo, name: '다락 구석', nook: true });
  beanbag(loft, room, -7.2, -5.3, face(-7.2, -5.3, -6, -4), '#c98f6b', { ...lo, name: '다락 빈백' });
  beanbag(loft, room, -5.6, -5.6, 0.4, '#7f97a8', { ...lo, name: '다락 빈백' });
  beanbag(loft, room, -4.0, -5.4, -0.5, '#b6a27c', { ...lo, name: '다락 빈백' });
  cushion(loft, room, -3.5, -3.8, 0, '#e6cf9c', { ...lo, name: '다락 난간 자리', nook: true });
  cushion(loft, room, -2.6, -3.8, 0, '#c98f6b', { ...lo, name: '다락 난간 자리', nook: true });
  {
    const desk = lowTable(loft, room, -1.95, -6.4, 0, 1.0, 0.55, 0.74, { ...lo, book: '#5f6b2e' });
    deskLamp(desk, room, 0.3, 0.74, -0.1);
    chair(loft, room, -1.95, -5.75, Math.PI, '#7f97a8', { ...lo, name: '다락 책상', appr: -0.5 });
  }
  rug(loft, -5.6, -5.0, 3.2, 1.8, ['#7f97a8', '#e9d6b9'], { fy: LY });
  {
    const light = new THREE.PointLight('#ffc27a', 0.3, 7, 1.6);
    light.position.set(-5.5, LY + 1.6, -5.2);
    loft.add(light);
    room.nightParts.push((dt, t, n) => { light.intensity = 0.3 + n * 5; });
    // 둥근 창으로 드는 빛
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 2.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff2cc', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
    shaft.position.set(-5.5, LY + 1.0, -6.2);
    shaft.rotation.x = 0.6;
    shaft.userData.noHit = true;
    loft.add(shaft);
    room.nightParts.push((dt, t, n) => { shaft.material.opacity = 0.08 * (1 - n); });
  }
  for (let i = loftRoomStart; i < room.seats.length; i++) room.seats[i].loft = true;
  room.hideables.push({ group: loft, rect: LOFT.rect, lv: 1 });

  // ---------- 다락 아래: 책장 골목 (역사아틀라스) ----------
  {
    const H2 = LY - 0.2;
    const hist = (s) => byShelf('history', s);
    const korea = hist('history'), world = hist('world_history');
    const units = [
      { x: -7.4, books: [half(korea, 0), hist('biographies')], label: ['우리 역사', '인물열전'] },
      { x: -5.2, books: [half(world, 0), half(korea, 1)], label: ['세계사', '우리 역사'] },
      { x: -3.0, books: [hist('literature'), half(world, 1)], label: ['옛 문학', '세계사'] },
    ];
    for (const u of units) {
      bookcase(scene, room, { x: u.x, z: -5.55, rotY: Math.PI / 2, w: 2.6, h: H2, d: 0.5, rows: 5, sides: 2, books: u.books });
      endSign(scene, u.x, -4.2, `역사 · ${u.label[0]}`, `역사 · ${u.label[1]}`);
    }
    // 골목 끝 의자 (막다른 골목)
    armchair(scene, room, -6.3, -6.35, 0, '#8a5a44', { name: '책장 골목 끝 의자', nook: true });
    armchair(scene, room, -4.1, -6.35, 0, '#5f6b4e', { name: '책장 골목 끝 의자', nook: true });
    armchair(scene, room, -8.25, -6.35, 0.25, '#7f97a8', { name: '책장 골목 끝 의자', nook: true });
    // 계단 뒤 구석
    cushion(scene, room, -9.4, -5.0, Math.PI / 2, '#d79a7c', { name: '계단 뒤 구석', nook: true });
    cushion(scene, room, -9.4, -4.1, Math.PI / 2, '#e6cf9c', { name: '계단 뒤 구석', nook: true });
    // 골목 중간 방석
    cushion(scene, room, -5.72, -4.9, -Math.PI / 2, '#a9bba0', { name: '책장 사이 방석', nook: true });
    cushion(scene, room, -3.55, -4.9, -Math.PI / 2, '#c98f6b', { name: '책장 사이 방석', nook: true });
    // 다락 아래 펜던트 등
    for (const x of [-8.25, -6.3, -4.1, -2.0]) {
      const m = new THREE.MeshStandardMaterial({ color: '#f3dcb6', emissive: '#ffbf66', emissiveIntensity: 0.4 });
      const p = mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, x, LY - 0.45, -5.4, { cast: false });
      p.rotation.x = Math.PI;
      scene.add(p);
      scene.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), M.color('#3e3029'), x, LY - 0.3, -5.4, { cast: false }));
      const gl = glowSprite('#ffc979', 1.1);
      gl.position.set(x, LY - 0.55, -5.4);
      scene.add(gl);
      room.nightParts.push((dt, t, n) => { m.emissiveIntensity = 0.5 + n; gl.material.opacity = 0.18 + n * 0.45; });
    }
  }

  // ---------- 높은 책장 + 사다리 (과학아틀라스, 북동쪽 벽) ----------
  {
    const sci = byShelf('science');
    bookcase(scene, room, { x: 1.4, z: CABIN.minZ + 0.25, w: 4.8, h: 4.8, d: 0.46, rows: 9, books: [sci], label: '과학아틀라스' });
    // 바퀴 달린 사다리
    const g = new THREE.Group();
    const lx = 2.3, z0 = -5.85, z1 = -6.42, top = 4.65;
    const len = Math.hypot(top, z0 - z1);
    const ang = Math.atan2(z0 - z1, top);
    for (const s of [-0.24, 0.24]) {
      const r = mesh(rbox(0.05, len, 0.06, 0.015), M.woodMid(), lx + s, top / 2, (z0 + z1) / 2);
      r.rotation.x = -ang;
      g.add(r);
    }
    const rungs = [];
    for (let i = 1; i < 13; i++) {
      const t = i / 13;
      const y = top * t, z = z0 + (z1 - z0) * t;
      g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6).rotateZ(Math.PI / 2), M.woodMid(), lx, y, z));
      rungs.push(V(lx, y + 0.03, z));
    }
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.6, 6).rotateZ(Math.PI / 2), M.color('#8a7b6c', 0.4, { metalness: 0.6 }), 1.4, top + 0.05, -6.48));
    scene.add(g);
    room.obstacles.push({ minX: lx - 0.3, maxX: lx + 0.3, minZ: -6.5, maxZ: z0 + 0.08 });
    // 고양이가 사다리를 타고 책장 꼭대기로
    room.climbs.push({ key: 'ladder', rotY: 0, path: [V(lx + 0.55, 0, -5.55), rungs[2], rungs[5], rungs[8], rungs[11], V(2.9, 4.83, CABIN.minZ + 0.25), V(0.6, 4.83, CABIN.minZ + 0.25)] });
    // 창가 독서 의자 (동쪽 창)
    armchair(scene, room, 3.2, -4.95, Math.PI / 2, '#8a5a44', { name: '창가 독서 의자', nook: true, blanket: '#c9b6e4' });
    armchair(scene, room, 3.2, -3.65, Math.PI / 2, '#a7865f', { name: '창가 독서 의자', nook: true });
    lowTable(scene, room, 3.45, -5.85, 0, 0.45, 0.45, 0.5, { cup: true });
    floorLamp(scene, room, 3.55, -2.85, { light: true });
    room.benchSpots.push(V(3.86, 0.86, -4.3));
  }

  // ---------- 가운데 책장 섬 (철학 · 정치) ----------
  bookcase(scene, room, {
    x: -5.3, z: -1.2, w: 2.8, h: 1.5, d: 0.52, rows: 3, sides: 2,
    books: [byShelf('politics'), byShelf('philo')], label: '정치  |  철학',
  });
  room.climbs.push({ key: 'island', rotY: Math.PI, path: [V(-3.55, 0, -0.45), V(-3.75, 0.47, -0.2), V(-4.4, 1.53, -1.2)] });
  stool(scene, room, -3.75, -0.2, -Math.PI / 2, 0.46, '#c98f6b', { name: '책장 섬 걸상' });
  stool(scene, room, -6.95, -0.2, Math.PI / 2, 0.46, '#a9bba0', { name: '책장 섬 걸상' });

  // ---------- 평대 (이번 달의 책) ----------
  {
    const pick = [];
    for (const a of ['history', 'philo', 'science', 'politics']) {
      const list = books.filter((b) => b.atlas === a && b.cover);
      const day = Math.floor(Date.now() / 86400000 / 30);
      for (let k = 0; k < 2 && list.length; k++) pick.push(list[(day * 7 + k * 13) % list.length]);
    }
    room.bookHits.push(...displayTable(scene, room, -1.75, 1.9, pick));
  }

  // ---------- 함께 읽는 긴 책상 ----------
  {
    const g = lowTable(scene, room, -4.3, 3.3, 0, 2.4, 0.95, 0.76, { book: '#7a3b2a' });
    deskLamp(g, room, -0.6, 0.76, 0.1);
    deskLamp(g, room, 0.7, 0.76, -0.1);
    [-5.1, -4.3, -3.5].forEach((xx, i) => {
      chair(scene, room, xx, 2.5, 0, ['#c98f6b', '#a9bba0', '#e6cf9c'][i], { name: '긴 책상', appr: -0.5 });
      chair(scene, room, xx, 4.1, Math.PI, '#7f97a8', { name: '긴 책상', appr: -0.5 });
    });
  }

  // ---------- 카운터 (음료) ----------
  {
    const g = new THREE.Group();
    const L = 3.0, Dd = 0.62, Hh = 1.02;
    plank(g, L, Hh - 0.05, Dd, 0, (Hh - 0.05) / 2, 0, M.woodLight(), 0.03);
    plank(g, L + 0.1, 0.06, Dd + 0.1, 0, Hh - 0.03, 0, M.wood(), 0.02);
    for (let i = 0; i < 6; i++) plank(g, 0.025, Hh - 0.2, 0.02, -L / 2 + 0.25 + i * 0.5, Hh / 2, -Dd / 2 - 0.005, M.wood(), 0.008);
    // 주전자 · 컵 · 유리병
    g.add(mesh(rbox(0.4, 0.4, 0.32, 0.06), M.color('#e9e2d6', 0.4), -0.9, Hh + 0.2, 0.05));
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 12), M.color(['#f6efe4', '#d9a07a', '#a9bba0', '#f6efe4'][i], 0.35), -0.3 + i * 0.13, Hh + 0.045, -0.12));
    for (let i = 0; i < 3; i++) {
      g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 14), M.color('#e8f1f2', 0.1, { transparent: true, opacity: 0.45 }), 0.5 + i * 0.18, Hh + 0.1, 0.05, { cast: false }));
      g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 14), M.color(['#f0b93a', '#d0505a', '#b8803e'][i], 1), 0.5 + i * 0.18, Hh + 0.05, 0.05));
    }
    // 메뉴판
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
    board.position.set(0.15, Hh + 0.45, -0.1);
    board.rotation.set(-0.15, Math.PI, 0);
    g.add(board);
    const back = new THREE.Group();
    back.add(board);
    // 위에서 보이도록 메뉴판을 손님 쪽으로
    board.rotation.set(-0.25, 0, 0);
    board.position.set(0.15, Hh + 0.42, -0.2);
    g.add(back);
    g.traverse((o) => { o.userData.counter = true; });
    g.position.set(-7.4, 0, CABIN.maxZ - 0.5);
    scene.add(g);
    room.obstacles.push({ minX: -7.4 - L / 2 - 0.05, maxX: -7.4 + L / 2 + 0.05, minZ: CABIN.maxZ - 0.85, maxZ: CABIN.maxZ });
    room.counter = V(-7.4, 0, CABIN.maxZ - 1.45);
    for (const xx of [-8.3, -7.4, -6.5]) stool(scene, room, xx, CABIN.maxZ - 1.25, 0, 0.72, '#c98f6b', { name: '카운터 걸상', appr: -0.45 });
    // 카운터 위 펜던트
    for (const xx of [-8.3, -6.5]) {
      const m = new THREE.MeshStandardMaterial({ color: '#f3dcb6', emissive: '#ffbf66', emissiveIntensity: 0.4 });
      const p = mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, xx, 2.4, CABIN.maxZ - 0.5, { cast: false });
      p.rotation.x = Math.PI;
      scene.add(p);
      const gl = glowSprite('#ffc979', 1.2);
      gl.position.set(xx, 2.3, CABIN.maxZ - 0.5);
      scene.add(gl);
      room.nightParts.push((dt, t, n) => { m.emissiveIntensity = 0.5 + n; gl.material.opacity = 0.15 + n * 0.5; });
    }
  }

  // ---------- 건의함 ----------
  {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.0, 8), M.woodDark(), 0, 0.5, 0));
    g.add(mesh(rbox(0.42, 0.36, 0.32, 0.04), M.color('#b65d4c', 0.7), 0, 1.18, 0));
    g.add(mesh(rbox(0.46, 0.06, 0.36, 0.02), M.woodDark(), 0, 1.38, 0));
    g.add(mesh(rbox(0.2, 0.02, 0.01, 0.005), M.color('#2a1a14'), 0, 1.25, 0.165));
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const draw = () => {
      const p = c.getContext('2d');
      p.fillStyle = '#f3e6cf'; p.fillRect(0, 0, 256, 96);
      p.fillStyle = '#5a3d2b'; p.textAlign = 'center'; p.textBaseline = 'middle';
      p.font = '700 30px "Gowun Batang", serif'; p.fillText('서점지기에게 한마디', 128, 50);
    };
    draw();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), new THREE.MeshStandardMaterial({ map: t }));
    lab.position.set(0, 1.12, 0.165);
    g.add(lab);
    g.traverse((o) => { o.userData.suggest = true; });
    g.position.set(-4.4, 0, CABIN.maxZ - 0.35);
    scene.add(g);
    room.obstacles.push(footprint(-4.4, CABIN.maxZ - 0.35, 0.5, 0.4));
    room.suggest = V(-4.4, 0, CABIN.maxZ - 0.95);
  }

  // ---------- 남동쪽: 소파 읽는 자리 ----------
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
    g.position.set(2.0, 0, CABIN.maxZ - 0.55);
    g.rotation.y = Math.PI;
    scene.add(g);
    room.obstacles.push(footprint(2.0, CABIN.maxZ - 0.55, L, Dd, 0));
    addSeat(room, 1.45, 0.54, CABIN.maxZ - 0.62, Math.PI, { name: '창 아래 소파', appr: 0.6 });
    addSeat(room, 2.55, 0.54, CABIN.maxZ - 0.62, Math.PI, { name: '창 아래 소파', appr: 0.6 });
    room.benchSpots.push(V(2.0, 0.55, CABIN.maxZ - 0.5));
    rug(scene, 2.0, 5.1, 2.6, 1.7, ['#d9b48a', '#7f97a8']);
    lowTable(scene, room, 2.0, 5.0, 0, 1.0, 0.5, 0.42, { cup: true, book: '#1f2c4d' });
    floorLamp(scene, room, 3.6, CABIN.maxZ - 0.4, { light: true });
    armchair(scene, room, 0.25, 4.7, face(0.25, 4.7, 2, 5.2), '#c98f6b', { name: '소파 곁 의자' });
  }
  // 동쪽 퇴창 벤치
  bench(scene, room, CABIN.maxX - 0.3, 3.4, -Math.PI / 2, 2.2, 2, { cushion: '#e3c79a', name: '퇴창 벤치', nook: true });
  room.benchSpots.push(V(CABIN.maxX - 0.3, 0.52, 2.6));

  // ---------- 화분 ----------
  for (const [x, z, s] of [[CABIN.maxX - 0.4, DOOR.z1 + 0.5, 1.0], [CABIN.maxX - 0.4, DOOR.z0 - 0.5, 0.9], [-0.4, CABIN.maxZ - 0.45, 0.8], [-3.0, CABIN.maxZ - 0.4, 1.0], [CABIN.minX + 0.4, -2.6, 0.9], [0.0, -2.0, 0.8]]) plant(scene, room, x, z, s, rnd);

  // 고양이 상자 (책 상자)
  {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.6, 0.32, 0.45, 0.02), M.color('#c9a77a', 1), 0, 0.16, 0));
    g.add(mesh(rbox(0.52, 0.02, 0.38, 0.01), M.color('#3a2a20', 1), 0, 0.31, 0, { cast: false }));
    g.add(mesh(rbox(0.3, 0.04, 0.2, 0.01), M.color('#f3ead8'), 0.12, 0.33, 0.05));
    g.position.set(-0.6, 0, -3.0);
    g.rotation.y = 0.3;
    scene.add(g);
    room.obstacles.push(footprint(-0.6, -3.0, 0.62, 0.5, 0.3));
    room.boxes.push({ floor: V(-0.6, 0, -2.45), inside: V(-0.6, 0.12, -3.0), rotY: 0.3, key: 'bookbox' });
  }

  room.spawn = V((FRONT.x0 + FRONT.x1) / 2, 0, CABIN.maxZ - 0.9);
  room.firstWalk = V(-1.75, 0, 4.4);
  return room;
}

// 책장 끝에 붙은 갈래 안내판 (양쪽 글)
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
  g.add(mesh(rbox(w - 0.02, h - 0.02, 0.06, 0.02), M.woodMid(), cx, h / 2, z + 0.04));
  g.add(mesh(rbox(w - 0.4, 0.6, 0.01, 0.1), M.color('#d6e7ee', 0.1, { transparent: true, opacity: 0.6 }), cx, h * 0.7, z));
  g.add(mesh(new THREE.SphereGeometry(0.04, 12, 8), M.color('#c9a24a', 0.3, { metalness: 0.6 }), x0 + 0.15, 1.0, z - 0.02));
  g.add(mesh(rbox(1.2, 0.02, 0.6, 0.04), M.fabric('#c7865e'), cx, 0.01, CABIN.maxZ - 0.45, { cast: false }));
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

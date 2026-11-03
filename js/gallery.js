// 미술관 (동쪽으로 넓힌 땅, 억새 언덕 건너) — 손님이 직접 찍은 사진 30점을 거는 통유리 전시관
// 바깥벽은 모두 유리, 작품은 유리 안쪽에 떠 있듯 선 흰 패널 18장과 가운데 양면 벽(12점)에 걸림
// 서버는 채팅 서버와 따로인 gallery-server/ (사진 창고 R2 · 자동 검사 · 하트 · 본 사람 · 신고 · 대기열)
// 요청 수: 미술관에 다가갈 때 벽 목록 1건 · 나갈 때 본 작품 모아 1건 · 하트 · 신고 · 올리기는 누를 때만.
//         사진은 R2 공개 주소(config gallery.imageBase)에서 바로 받으면 서버 요청에 잡히지 않음.
import * as THREE from 'three';
import { M, rbox, mesh, glowSprite, textSprite } from './kit.js';
import { bench } from './furniture.js';

export const HALL = { x0: 62.5, x1: 72.5, z0: -7, z1: 9, H: 4.2, door: [0.0, 2.0] };
export const inHall = (p, m = 0) => p.x > HALL.x0 - m && p.x < HALL.x1 + m && p.z > HALL.z0 - m && p.z < HALL.z1 + m && p.y < 1.5;
export const SLOTS = 30;

// 벽 자리 30곳: [x, z, 바라보는 방향(rotY)]
function slotSpots() {
  const { x0, x1, z0, z1 } = HALL, out = [];
  const IN = 0.78;   // 통유리 벽에서 패널 앞면까지
  for (const x of [64.0, 66.3, 68.7, 71.0]) out.push([x, z0 + IN, 0]);
  for (const z of [-5.25, -2.75, -0.25, 2.25, 4.75, 7.25]) out.push([x1 - IN, z, -Math.PI / 2]);
  for (const x of [71.0, 68.7, 66.3, 64.0]) out.push([x, z1 - IN, Math.PI]);
  for (const z of [7.2, 4.6, -2.6, -5.2]) out.push([x0 + IN, z, Math.PI / 2]);
  for (const z of [-3.75, -1.85, 0.05, 1.95, 3.85, 5.75]) out.push([67.5 - 0.16, z, -Math.PI / 2]);
  for (const z of [5.75, 3.85, 1.95, 0.05, -1.85, -3.75]) out.push([67.5 + 0.16, z, Math.PI / 2]);
  return out;
}

function waitingTexture(no, text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 512, 384);
  const hue = (no * 37) % 360;
  gr.addColorStop(0, `hsl(${hue},35%,92%)`); gr.addColorStop(1, `hsl(${(hue + 40) % 360},40%,84%)`);
  g.fillStyle = gr; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = 'rgba(40,50,70,0.25)'; g.lineWidth = 3; g.setLineDash([12, 10]); g.strokeRect(28, 28, 456, 328);
  g.fillStyle = 'rgba(40,50,70,0.65)'; g.textAlign = 'center';
  g.font = '700 44px "Gowun Dodum", sans-serif'; g.fillText(`${no}번 벽`, 256, 170);
  g.font = '28px "Gowun Dodum", sans-serif'; g.fillText(text, 256, 222);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildGallery(scene, room, { obst, excl }) {
  const { x0, x1, z0, z1, H } = HALL;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
  excl.push([cx, cz, 10.5], [60.8, 1.0, 2.6]);
  room.buildingRects = room.buildingRects || [];
  room.buildingRects.push({ minX: x0 - 3, maxX: x1 + 1.5, minZ: z0 - 1.5, maxZ: z1 + 1.5 });
  const white = new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.6 });
  const inner = new THREE.MeshStandardMaterial({ color: '#fafaf8', roughness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.35, metalness: 0.15 });
  const steel = new THREE.MeshStandardMaterial({ color: '#1e2126', roughness: 0.4, metalness: 0.6 });
  // 받침 + 반들반들한 짙은 바닥
  scene.add(mesh(new THREE.BoxGeometry(W + 1.2, 0.16, D + 1.2), M.color('#cfd2d4', 0.8), cx, 0.03, cz, { cast: false }));
  scene.add(mesh(new THREE.BoxGeometry(W - 0.2, 0.02, D - 0.2), dark, cx, 0.12, cz, { cast: false }));
  // 앞마당 (넓은 판석)
  for (let i = 0; i < 12; i++) scene.add(mesh(new THREE.BoxGeometry(0.9, 0.06, 0.9), M.color(i % 2 ? '#d8dadb' : '#c9ccce', 0.8), 61.1 - (i % 2) * 0.95, 0.03, -2.2 + Math.floor(i / 2) * 0.95, { cast: false }));
  // 벽 (흰 판) — 잘라 보기에 등록
  const wall = (normal, at, along, a0, a1, gaps = [], glass = false) => {
    const g = new THREE.Group(), T = 0.2, off = at + (normal.x + normal.z) * T / 2;
    let st = a0;
    const pieces = [];
    for (const [g0, g1] of gaps) { if (g0 > st) pieces.push([st, g0, 0, H]); pieces.push([g0, g1, 2.6, H]); st = g1; }
    if (a1 > st) pieces.push([st, a1, 0, H]);
    for (const [p0, p1, y0, y1] of pieces) {
      const len = p1 - p0, mid = (p0 + p1) / 2;
      if (glass) {
        // 유리벽: 가는 검은 세로살
        const hh = y1 - y0, my = (y0 + y1) / 2;
        const gp = mesh(along === 'x' ? new THREE.BoxGeometry(len, hh, 0.03) : new THREE.BoxGeometry(0.03, hh, len), glassMat, along === 'x' ? mid : off, my, along === 'x' ? off : mid, { cast: false });
        gp.renderOrder = 2; gp.castShadow = false; g.add(gp);
        const n = Math.max(1, Math.round(len / 1.6));
        for (let k = 0; k <= n; k++) { const a = p0 + (len * k) / n; g.add(mesh(along === 'x' ? new THREE.BoxGeometry(0.045, hh, 0.07) : new THREE.BoxGeometry(0.07, hh, 0.045), steel, along === 'x' ? a : off, my, along === 'x' ? off : a)); }
        for (const yy of [y0 + 0.03, y1 - 0.03]) g.add(mesh(along === 'x' ? new THREE.BoxGeometry(len, 0.06, 0.07) : new THREE.BoxGeometry(0.07, 0.06, len), steel, along === 'x' ? mid : off, yy, along === 'x' ? off : mid));
        continue;
      }
      g.add(mesh(along === 'x' ? new THREE.BoxGeometry(len, y1 - y0, T) : new THREE.BoxGeometry(T, y1 - y0, len), white, along === 'x' ? mid : off, (y0 + y1) / 2, along === 'x' ? off : mid, { cast: false }));
      g.add(mesh(along === 'x' ? new THREE.BoxGeometry(len, y1 - y0, 0.02) : new THREE.BoxGeometry(0.02, y1 - y0, len), inner, along === 'x' ? mid : at - normal.x * 0.012, (y0 + y1) / 2, along === 'x' ? at - normal.z * 0.012 : mid, { cast: false }));
    }
    scene.add(g);
    if (!glass) room.walls.push({ group: g, normal, at, opacity: 1, span: [(along === 'x' ? x0 : z0) - 0.5, (along === 'x' ? x1 : z1) + 0.5], spanAxis: along === 'x' ? 'x' : 'z' });
    let s0 = a0 - 0.1;
    for (const [g0, g1] of [...gaps, [a1 + 0.1, a1 + 0.1]]) { if (g0 > s0) obst(along === 'x' ? s0 : at - 0.13, along === 'x' ? g0 : at + 0.13, along === 'x' ? at - 0.13 : s0, along === 'x' ? at + 0.13 : g0); s0 = g1; }
  };
  // 건물 전체 통유리 (밤엔 안의 작품 조명이 밖으로 비침)
  const glassMat = new THREE.MeshStandardMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.4, depthWrite: false, side: THREE.DoubleSide });
  wall(new THREE.Vector3(0, 0, -1), z0, 'x', x0, x1, [], true);
  wall(new THREE.Vector3(0, 0, 1), z1, 'x', x0, x1, [], true);
  wall(new THREE.Vector3(1, 0, 0), x1, 'z', z0, z1, [], true);
  wall(new THREE.Vector3(-1, 0, 0), x0, 'z', z0, z1, [HALL.door], true);
  // 유리 문 (양쪽 문짝, 가는 손잡이)
  for (const zz of [0.5, 1.5]) { scene.add(mesh(new THREE.BoxGeometry(0.03, 2.5, 0.96), glassMat, x0 - 0.3, 1.37, zz + (zz < 1 ? -0.48 : 0.48), { cast: false })); scene.add(mesh(new THREE.BoxGeometry(0.04, 0.5, 0.03), steel, x0 - 0.3, 1.2, zz + (zz < 1 ? 0.0 : 0.0))); }
  // 작품 패널 (통유리 안쪽에 떠 있듯 선 흰 판, 바닥과 사이가 살짝 떠 있음)
  const panelMat = new THREE.MeshStandardMaterial({ color: '#f6f6f3', roughness: 0.7 });
  const panelAt = (x, z, rotY) => {
    const pm = mesh(new THREE.BoxGeometry(1.6, 2.75, 0.14), panelMat, 0, 0, 0);
    pm.position.set(x - Math.sin(rotY) * 0.09, 1.63, z - Math.cos(rotY) * 0.09);
    pm.rotation.y = rotY;
    scene.add(pm);
    const w = Math.abs(Math.sin(rotY)) > 0.5;
    obst(pm.position.x - (w ? 0.12 : 0.82), pm.position.x + (w ? 0.12 : 0.82), pm.position.z - (w ? 0.82 : 0.12), pm.position.z + (w ? 0.82 : 0.12));
  };
  // 가운데 세운 벽 (양면)
  scene.add(mesh(new THREE.BoxGeometry(0.3, 3.1, 11.0), white, 67.5, 1.55 + 0.12, 1.0));
  obst(67.3, 67.7, -4.5, 6.5);
  // 떠 있는 지붕 판 + 밤에 빛나는 가장자리 띠 — 안에 들어가면 접힘
  const roof = new THREE.Group();
  roof.add(mesh(new THREE.BoxGeometry(W + 2.4, 0.28, D + 2.0), white, cx + 0.2, H + 0.32, cz));
  const led = new THREE.MeshStandardMaterial({ color: '#dff6ff', emissive: '#9fe7ff', emissiveIntensity: 0.15 });
  for (const [w, d, x, z] of [[W + 2.4, 0.05, cx + 0.2, cz - (D + 2) / 2], [W + 2.4, 0.05, cx + 0.2, cz + (D + 2) / 2], [0.05, D + 2, cx + 0.2 - (W + 2.4) / 2, cz], [0.05, D + 2, cx + 0.2 + (W + 2.4) / 2, cz]]) roof.add(mesh(new THREE.BoxGeometry(w, 0.06, d), led, x, H + 0.17, z, { cast: false }));
  // 천창 줄 (빛 띠)
  for (const z of [-4, 1, 6]) roof.add(mesh(new THREE.BoxGeometry(W - 1, 0.02, 0.35), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }), cx, H + 0.17, z, { cast: false }));
  scene.add(roof);
  (room.roofs ||= []).push({ g: roof, rect: { minX: x0 - 0.3, maxX: x1 + 0.3, minZ: z0 - 0.3, maxZ: z1 + 0.3 } });
  // 지붕을 받치는 가는 기둥 (밖으로 나온 처마)
  for (const [x, z] of [[x0 - 1.0, z0 - 0.8], [x0 - 1.0, z1 + 0.8]]) { scene.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, H + 0.2, 10), steel, x, (H + 0.2) / 2, z)); obst(x - 0.1, x + 0.1, z - 0.1, z + 0.1); }
  // 앞마당 빛의 고리 (조형물)
  const ringMat = new THREE.MeshStandardMaterial({ color: '#e9eef2', emissive: '#7fd8ff', emissiveIntensity: 0.1, metalness: 0.6, roughness: 0.25 });
  const ring = mesh(new THREE.TorusGeometry(1.0, 0.07, 14, 60), ringMat, 59.6, 1.35, -4.6);
  ring.rotation.y = 0.6; scene.add(ring);
  scene.add(mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 20), steel, 59.6, 0.12, -4.6));
  obst(59.2, 60.0, -5.0, -4.2);
  // 간판
  const sign = textSprite('MK 갤러리 · 손님이 찍은 사진 30점', { height: 0.26, bg: 'rgba(30,33,38,0.88)', color: '#eaf6ff', font: '500 44px "Gowun Dodum", sans-serif' });
  sign.position.set(x0 - 0.3, 3.2, -1.6); sign.userData.noHit = true; roof.add(sign);   // 안에 들어가면 지붕과 함께 접힘
  room.nightParts.push((dt, t, n) => {
    led.emissiveIntensity = 0.15 + n * 2.4;
    ringMat.emissiveIntensity = 0.1 + n * (1.6 + Math.sin(t * 0.8) * 0.4);
    ring.rotation.y = 0.6 + t * 0.15;
  });
  // 실내 쉼터 벤치
  bench(scene, room, 65.0, 1.0, Math.PI / 2, 1.6, 2, { name: '미술관 벤치', back: false });
  bench(scene, room, 70.0, 1.0, -Math.PI / 2, 1.6, 2, { name: '미술관 벤치', back: false });
  // 작품 올리기 기둥 (입구 안쪽)
  {
    const g = new THREE.Group();
    g.add(mesh(rbox(0.5, 1.4, 0.12, 0.04), steel, 0, 0.7 + 0.12, 0));
    const scr = document.createElement('canvas'); scr.width = 256; scr.height = 384;
    const p = scr.getContext('2d');
    const draw = () => { const gr = p.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, '#1d3b55'); gr.addColorStop(1, '#2c6b8a'); p.fillStyle = gr; p.fillRect(0, 0, 256, 384); p.fillStyle = '#eaf6ff'; p.textAlign = 'center'; p.font = '700 40px "Gowun Dodum", sans-serif'; p.fillText('📷', 128, 120); p.fillText('작품', 128, 190); p.fillText('올리기', 128, 240); p.font = '22px "Gowun Dodum", sans-serif'; p.fillText('내가 찍은 사진', 128, 300); p.fillText('한 시간씩 걸려요', 128, 332); };
    draw();
    const tx = new THREE.CanvasTexture(scr); tx.colorSpace = THREE.SRGBColorSpace;
    document.fonts?.ready.then(() => { draw(); tx.needsUpdate = true; });
    g.add(mesh(new THREE.PlaneGeometry(0.42, 0.63), new THREE.MeshBasicMaterial({ map: tx }), 0, 1.08 + 0.12, 0.062, { cast: false }));
    g.position.set(x0 + 0.9, 0, 3.0);
    g.rotation.y = Math.PI / 2;
    g.traverse((o) => { if (o.isMesh) o.userData.artKiosk = true; });
    scene.add(g);
    obst(x0 + 0.75, x0 + 1.05, 2.7, 3.3);
  }
  // ---------- 작품 자리 30 ----------
  const frames = [];
  slotSpots().forEach(([x, z, rotY], i) => { if (i < 18) panelAt(x, z, rotY); });
  slotSpots().forEach(([x, z, rotY], i) => {
    const g = new THREE.Group();
    const border = mesh(rbox(1.16, 0.92, 0.04, 0.01), steel, 0, 0, 0);
    const mat = mesh(new THREE.PlaneGeometry(1.08, 0.84), M.color('#ffffff', 0.9), 0, 0, 0.021, { cast: false });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: waitingTexture(i + 1, '작품을 기다려요'), toneMapped: false }));
    pic.position.z = 0.023; pic.scale.set(1.0, 0.75, 1);
    g.add(border, mat, pic);
    // 이름표 (제목 · 찍은 사람 · 👁 · ❤)
    const lc = document.createElement('canvas'); lc.width = 512; lc.height = 128;
    const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace;
    const label = mesh(new THREE.PlaneGeometry(0.62, 0.155), new THREE.MeshBasicMaterial({ map: lt, transparent: true }), 0.25, -0.62, 0.02, { cast: false });
    g.add(label);
    // 작품 위 조명 (빛 원뿔)
    const cone = mesh(new THREE.ConeGeometry(0.55, 1.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#fff6e0', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), 0, 0.85, 0.35, { cast: false });
    cone.rotation.x = -0.35; cone.userData.noHit = true; g.add(cone);
    g.position.set(x, 1.6 + 0.12, z);
    g.rotation.y = rotY;
    g.traverse((o) => { if (o.isMesh) o.userData.artSlot = i; });
    cone.userData.artSlot = undefined;
    scene.add(g);
    frames.push({ g, pic, label, lc, lt, cone, pos: new THREE.Vector3(x, 1.6, z), rotY, no: i + 1 });
  });
  const strip = new THREE.MeshStandardMaterial({ color: '#f4fbff', emissive: '#cfeeff', emissiveIntensity: 0.1 });
  for (const [w, d, x, z] of [[W - 0.3, 0.05, cx, z0 + 0.12], [W - 0.3, 0.05, cx, z1 - 0.12], [0.05, D - 0.3, x0 + 0.12, cz], [0.05, D - 0.3, x1 - 0.12, cz]]) scene.add(mesh(new THREE.BoxGeometry(w, 0.02, d), strip, x, 0.14, z, { cast: false }));
  const hallLight = new THREE.PointLight('#fff4e0', 0, 16, 1.4); hallLight.position.set(cx, 3.4, cz); scene.add(hallLight);
  room.nightParts.push((dt, t, n) => { for (const f of frames) f.cone.material.opacity = 0.04 + n * 0.1; strip.emissiveIntensity = 0.1 + n * 1.6; hallLight.intensity = 0.4 + n * 5; });
  room.gallery = { frames, door: new THREE.Vector3(x0 - 1.0, 0, 1.0), center: new THREE.Vector3(cx, 0, cz) };
}

// ---------- 전시 상태 (서버에서 받아 와 벽에 걸기) ----------
export class GalleryClient {
  constructor(room, cfg, uid) {
    this.room = room; this.cfg = cfg || {}; this.uid = uid;
    this.slots = new Array(SLOTS).fill(null);
    this.queue = 0;
    this.loaded = false; this.loading = false;
    this.seen = new Set(); this.sent = new Set();
    this.hearted = new Set();
    try { this.hearted = new Set(JSON.parse(localStorage.getItem('mkhzbook.hearts') || '[]')); } catch { /* 무시 */ }
    this.loader = new THREE.TextureLoader();
    this.loader.setCrossOrigin('anonymous');
    this.wasIn = false;
  }
  get on() { return !!this.cfg.api; }
  url(path) { return this.cfg.api.replace(/\/$/, '') + path; }
  imgUrl(s) { return s.img || (this.cfg.imageBase ? `${this.cfg.imageBase.replace(/\/$/, '')}/art/${s.id}.jpg` : this.url(`/img/${s.id}`)); }

  async load() {
    if (!this.on || this.loading) return;
    this.loading = true;
    try {
      const r = await fetch(this.url('/wall'), { cache: 'no-store' });
      const d = await r.json();
      this.apply(d);
      this.loaded = true;
      // 대기 중인 작품이 있으면, 다음 교대 시각에 한 번만 다시 받음 (그때 미술관 근처에 있을 때만)
      clearTimeout(this.nextT);
      const next = (d.slots || []).filter((s) => s && s.until).map((s) => s.until).sort((a, b) => a - b)[0];
      if (d.queue > 0 && next) this.nextT = setTimeout(() => { if (this.near) this.load(); else this.loaded = false; }, Math.max(60000, next - d.now + 5000));
    } catch (e) { console.warn('[미술관] 벽 목록을 못 받았어요', e); }
    this.loading = false;
  }

  apply(d) {
    this.queue = d.queue || 0;
    (d.slots || []).forEach((s, i) => {
      const f = this.room.gallery.frames[i];
      const old = this.slots[i];
      this.slots[i] = s && s.id ? s : null;
      if (!s || !s.id) { if (old) { f.pic.material.map = waitingTexture(i + 1, '작품을 기다려요'); f.pic.scale.set(1, 0.75, 1); } this.drawLabel(i); return; }
      if (!old || old.id !== s.id) {
        this.loader.load(this.imgUrl(s), (tx) => {
          tx.colorSpace = THREE.SRGBColorSpace;
          const ar = tx.image.width / tx.image.height;
          f.pic.material.map = tx; f.pic.material.needsUpdate = true;
          f.pic.scale.set(ar >= 1 ? 1.0 : 0.78 * ar, ar >= 1 ? 1.0 / ar : 0.78, 1);
        });
      }
      this.drawLabel(i);
    });
  }

  drawLabel(i) {
    const f = this.room.gallery.frames[i], s = this.slots[i], g = f.lc.getContext('2d');
    g.clearRect(0, 0, 512, 128);
    g.fillStyle = 'rgba(255,255,255,0.94)'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#23262b'; g.textBaseline = 'middle';
    if (s) {
      g.font = '700 34px "Gowun Dodum", sans-serif'; g.fillText((s.title || '무제').slice(0, 14), 18, 38);
      g.font = '26px "Gowun Dodum", sans-serif'; g.fillStyle = '#5b6068'; g.fillText(`${(s.name || '손님').slice(0, 10)}`, 18, 92);
      g.textAlign = 'right'; g.fillStyle = '#23262b'; g.fillText(`👁 ${s.views || 0}  ❤ ${s.hearts || 0}`, 496, 92); g.textAlign = 'left';
    } else { g.font = '26px "Gowun Dodum", sans-serif'; g.fillStyle = '#5b6068'; g.fillText(`${i + 1}번 벽 · 비어 있음`, 18, 64); }
    f.lt.needsUpdate = true;
  }

  // 미술관 안에서 작품 앞 3 m 안에 2초 넘게 서 있으면 「봤다」 (나갈 때 한 번에 보냄)
  update(dt, me) {
    const G = this.room.gallery;
    this.near = Math.hypot(me.x - G.center.x, me.z - G.center.z) < 32;
    if (this.near && !this.loaded) this.load();
    const inside = inHall(me);
    if (inside) {
      for (let i = 0; i < SLOTS; i++) {
        const s = this.slots[i]; if (!s || this.seen.has(s.id)) continue;
        const f = G.frames[i];
        const nx = Math.sin(f.rotY), nz = Math.cos(f.rotY);
        const dx = me.x - f.pos.x, dz = me.z - f.pos.z;
        const front = dx * nx + dz * nz;
        if (front > 0.3 && front < 3.2 && Math.abs(dx * nz - dz * nx) < 1.6) {
          s._t = (s._t || 0) + dt;
          if (s._t > 2) { this.seen.add(s.id); s.views = (s.views || 0) + 1; this.drawLabel(i); }
        }
      }
    }
    if (this.wasIn && !inside) this.flushSeen();
    this.wasIn = inside;
  }

  flushSeen(beacon = false) {
    const ids = [...this.seen].filter((id) => !this.sent.has(id));
    if (!ids.length || !this.on) return;
    ids.forEach((id) => this.sent.add(id));
    const body = JSON.stringify({ uid: this.uid, ids });
    if (beacon && navigator.sendBeacon) navigator.sendBeacon(this.url('/seen'), new Blob([body], { type: 'text/plain' }));
    else fetch(this.url('/seen'), { method: 'POST', body, headers: { 'content-type': 'text/plain' } }).catch(() => {});
  }

  async heart(slot) {
    const s = this.slots[slot];
    if (!s || this.hearted.has(s.id) || !this.on) return false;
    this.hearted.add(s.id);
    try { localStorage.setItem('mkhzbook.hearts', JSON.stringify([...this.hearted].slice(-500))); } catch { /* 무시 */ }
    s.hearts = (s.hearts || 0) + 1; this.drawLabel(slot);
    fetch(this.url('/heart'), { method: 'POST', body: JSON.stringify({ uid: this.uid, id: s.id }), headers: { 'content-type': 'text/plain' } }).catch(() => {});
    return true;
  }

  async report(slot) {
    const s = this.slots[slot];
    if (!s || !this.on) return { ok: false, msg: '지금은 신고를 받을 수 없어요' };
    this.flushSeen();
    try {
      const r = await fetch(this.url('/report'), { method: 'POST', body: JSON.stringify({ uid: this.uid, id: s.id }), headers: { 'content-type': 'text/plain' } });
      const d = await r.json();
      if (d.hidden) { this.slots[slot] = null; this.apply({ slots: this.slots, queue: this.queue }); this.loaded = false; }
      return d;
    } catch { return { ok: false, msg: '신고를 보내지 못했어요. 잠시 뒤 다시 해 주세요' }; }
  }

  // 사진 줄이기: 긴 쪽 1280px JPEG — 다시 그려 저장하므로 위치 정보(GPS) 같은 사진 속 정보가 모두 지워짐
  async shrink(file) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    let q = 0.86, url = c.toDataURL('image/jpeg', q);
    while (url.length > 560000 && q > 0.5) { q -= 0.08; url = c.toDataURL('image/jpeg', q); }
    return { url, w: c.width, h: c.height };
  }

  async upload({ file, title, name }) {
    if (!this.on) return { ok: false, msg: '미술관 서버가 아직 열리지 않았어요' };
    let img;
    try { img = await this.shrink(file); } catch { return { ok: false, msg: '사진을 읽지 못했어요. JPG · PNG 사진으로 다시 골라 주세요' }; }
    try {
      const r = await fetch(this.url('/upload'), { method: 'POST', body: JSON.stringify({ uid: this.uid, title, name, image: img.url.split(',')[1] }), headers: { 'content-type': 'text/plain' } });
      const d = await r.json();
      if (d.ok) this.loaded = false;
      return d;
    } catch { return { ok: false, msg: '올리지 못했어요. 잠시 뒤 다시 해 주세요' }; }
  }
}

// 책장과 책
// - 진짜 책(아틀라스 시리즈 한 권 = 책 한 권)은 책등에 제목을 써서 한 덩어리로 합쳐 그림 → 누르면 책 카드
// - 빈칸을 채우는 장식 책은 한 번에 그리는 인스턴스(InstancedMesh)로 가볍게
// - 평대(누워 있는 표지 책)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, rbox, mesh, plank, footprint, mulberry } from './kit.js';
import { drawCover } from './covers.js';

const real = [];      // { book, matrix, w, h, d }
const fillers = [];   // { matrix, color }
const rnd = mulberry(91);
const FILL = ['#8c6a52', '#a8835f', '#6f7a6a', '#b9a27f', '#7d6858', '#c7b08a', '#5e6b74', '#9a7b6b', '#d1bf9c', '#7b5a48', '#a29276', '#6b5d4f'];
let ATLAS = {};
export function setAtlases(list) { ATLAS = Object.fromEntries(list.map((a) => [a.id, a])); }

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();

// 책장 하나. 앞면이 +z(sides 2면 뒷면 -z 도). books: [앞면 책들, 뒷면 책들]
let curHost = null;   // 다락처럼 통째로 숨는 무리에 놓인 책장이면 그 무리 (책 덩어리도 그 안에 넣음)
export function bookcase(scene, room, o) {
  curHost = o.host || null;
  const { x, z, rotY = 0, w = 2.4, h = 2.2, d = 0.42, rows = 5, sides = 1, fy = 0, lv = 0 } = o;
  const g = new THREE.Group();
  const wm = o.mat || M.woodDark();
  const inner = o.inner || M.wood();
  plank(g, 0.05, h, d, -w / 2, h / 2, 0, wm, 0.012);
  plank(g, 0.05, h, d, w / 2, h / 2, 0, wm, 0.012);
  plank(g, w + 0.06, 0.05, d + 0.02, 0, h - 0.025, 0, wm, 0.012);
  plank(g, w, 0.08, d, 0, 0.04, 0, wm, 0.012);
  if (sides === 1) plank(g, w - 0.04, h - 0.1, 0.02, 0, h / 2, -d / 2 + 0.01, inner, 0.005);
  else plank(g, w - 0.04, h - 0.1, 0.02, 0, h / 2, 0, inner, 0.005);
  const rowH = (h - 0.13) / rows;
  for (let i = 1; i < rows; i++) plank(g, w - 0.04, 0.03, d - 0.02, 0, 0.08 + i * rowH, 0, wm, 0.008);
  g.position.set(x, fy, z);
  g.rotation.y = rotY;
  scene.add(g);
  g.updateMatrixWorld(true);
  const ob = footprint(x, z, w + 0.06, d + 0.04, rotY);
  if (lv) ob.lv = lv;
  room.obstacles.push(ob);
  if (o.noBooks) return g;

  // 앞판에서 안쪽으로 책이 들어갈 깊이
  const front = d / 2 - 0.015;
  const faceDepth = sides === 2 ? d / 2 - 0.03 : d - 0.05;
  for (let side = 0; side < sides; side++) {
    // 칸 단위로 정한 책장: rowSpec[side] = [{ label, books }] (위 칸부터). 책은 칸 왼쪽부터 차례로, 칸마다 시대 이름표
    if (o.rowSpec) {
      const spec = o.rowSpec[side] || [];
      const order = o.rowOrder || [...Array(rows).keys()].reverse();
      for (let i = 0; i < rows; i++) {
        const k = order.indexOf(i);
        const r = k >= 0 ? spec[k] : null;
        const y0 = 0.08 + i * rowH + 0.015;
        const maxH = Math.min(rowH - 0.05, 0.44);
        // 뒷면은 좌우를 뒤집어, 어느 면에서 봐도 왼쪽부터 오래된 책
        const sx = side === 0 ? 1 : -1;
        let xx = -w / 2 + 0.05;
        const end = w / 2 - 0.05;
        if (r) {
          // 칸 이름표: 칸 바닥 왼쪽에 세운 판 (그 칸의 책은 이름표 오른쪽부터)
          if (r.label) { rowPlate(g, side, r.label, sx * (xx + 0.21), y0, front, o.labelColor); xx += 0.45; }
          for (const b of r.books) {
            const bw = THREE.MathUtils.clamp(0.04 + b.parts * 0.0022, 0.045, 0.11);
            if (xx + bw > end) break;
            const bh = Math.min(maxH, 0.31 + (b.parts % 5) * 0.012);
            addBook(g, side, sx * (xx + bw / 2), y0, bh, bw, Math.min(faceDepth, 0.24), front, b);
            xx += bw + 0.006;
          }
          if (r.books.length) {
            // 책받침 (진짜 책과 장식 책 사이)
            const bh = Math.min(maxH, 0.2);
            const be = mesh(new THREE.BoxGeometry(0.012, bh, Math.min(faceDepth, 0.2)), M.color('#6b5d4f', 0.5, { metalness: 0.4 }), sx * (xx + 0.012), y0 + bh / 2, side === 0 ? front - 0.12 : -(front - 0.12));
            be.userData.noHit = true; g.add(be);
            xx += 0.05;
          }
        }
        while (xx < end - 0.03) {
          if (rnd() < 0.04) { xx += 0.1 + rnd() * 0.12; continue; }
          const bw = 0.025 + rnd() * 0.035;
          const bh = Math.min(maxH, 0.2 + rnd() * 0.16);
          if (xx + bw > end) break;
          addFiller(g, side, sx * (xx + bw / 2), y0, bh, bw, Math.min(faceDepth, 0.18 + rnd() * 0.06), front - 0.012, 0);
          xx += bw + 0.003;
        }
      }
      continue;
    }
    const list = (o.books && o.books[side]) || [];
    // 진짜 책은 눈높이 칸부터
    const rowsOrder = [];
    for (let i = 0; i < rows; i++) rowsOrder.push(i);
    const eye = rowsOrder.filter((i) => { const y = fy + 0.08 + i * rowH; return y > 0.3 && y < 1.9; });
    const realRows = (eye.length ? eye : rowsOrder);
    const perRow = realRows.map(() => []);
    list.forEach((b, k) => perRow[k % realRows.length].push(b));
    for (let i = 0; i < rows; i++) {
      const y0 = 0.08 + i * rowH + 0.015;
      const maxH = Math.min(rowH - 0.05, 0.44);
      const mine = perRow[realRows.indexOf(i)] || [];
      // 빈 칸 수를 정해 진짜 책 사이사이에 장식 책
      let xx = -w / 2 + 0.05;
      const end = w / 2 - 0.05;
      const slots = mine.length;
      const span = end - xx;
      const at = mine.map((_, k) => xx + span * ((k + 0.5) / slots) - 0.04);
      let next = 0;
      let gap = rnd() < 0.5 ? 1 : 0;
      while (xx < end - 0.03) {
        if (next < mine.length && xx >= at[next]) {
          const b = mine[next++];
          const bw = THREE.MathUtils.clamp(0.04 + b.parts * 0.0022, 0.045, 0.11);
          const bh = Math.min(maxH, 0.31 + (b.parts % 5) * 0.012);
          addBook(g, side, xx + bw / 2, y0, bh, bw, Math.min(faceDepth, 0.24), front, b);
          xx += bw + 0.006;
          continue;
        }
        // 가끔 빈자리 · 기울어진 책
        if (gap && rnd() < 0.05) { xx += 0.12 + rnd() * 0.15; continue; }
        const bw = 0.025 + rnd() * 0.035;
        const bh = Math.min(maxH, 0.2 + rnd() * 0.16);
        if (xx + bw > end) break;
        const lean = rnd() < 0.04 ? 0.18 : 0;
        if (o.live) {
          // 움직이는 책장(문)은 책을 진짜 메시로 붙임
          const d2 = Math.min(faceDepth, 0.18 + rnd() * 0.06);
          const m = mesh(new THREE.BoxGeometry(bw, bh, d2), M.color(FILL[Math.floor(rnd() * FILL.length)], 0.85), xx + bw / 2, y0 + bh / 2, side === 0 ? front - 0.012 - d2 / 2 : -(front - 0.012 - d2 / 2));
          m.rotation.z = lean;
          g.add(m);
        } else addFiller(g, side, xx + bw / 2, y0, bh, bw, Math.min(faceDepth, 0.18 + rnd() * 0.06), front - 0.012, lean);
        xx += bw + 0.003 + lean * 0.12;
        gap = 1;
      }
    }
  }
  if (o.label) shelfLabel(g, o.label, w, h, d, sides, o.labelColor);
  return g;
}

// 제품 가구(집사4호 같은 책장 캣타워)의 열린 칸에 책 꽂기. slots 는 root 기준 좌표 {x, y0, w, h, d, front}
export function fillSlots(root, slots, list) {
  root.updateMatrixWorld(true);
  const per = slots.map(() => []);
  list.forEach((b, k) => per[k % slots.length].push(b));
  slots.forEach((sl, i) => {
    const mine = per[i];
    let xx = sl.x - sl.w / 2 + 0.02;
    const end = sl.x + sl.w / 2 - 0.02;
    const maxH = Math.min(sl.h - 0.03, 0.44);
    const at = mine.map((_, k) => xx + (end - xx) * ((k + 0.5) / mine.length) - 0.04);
    let next = 0;
    while (xx < end - 0.03) {
      if (next < mine.length && xx >= at[next]) {
        const b = mine[next++];
        const bw = THREE.MathUtils.clamp(0.04 + b.parts * 0.0022, 0.045, 0.11);
        const bh = Math.min(maxH, 0.25 + (b.parts % 5) * 0.012);
        addBook(root, 0, xx + bw / 2, sl.y0, bh, bw, Math.min(sl.d, 0.24), sl.front, b);
        xx += bw + 0.006;
        continue;
      }
      if (rnd() < 0.08) { xx += 0.06 + rnd() * 0.08; continue; }
      const bw = 0.025 + rnd() * 0.035;
      const bh = Math.min(maxH, 0.17 + rnd() * 0.12);
      if (xx + bw > end) break;
      addFiller(root, 0, xx + bw / 2, sl.y0, bh, bw, Math.min(sl.d, 0.18 + rnd() * 0.05), sl.front - 0.012, 0);
      xx += bw + 0.003;
    }
  });
}

// side 0: 앞(+z)으로 책등, side 1: 뒤(-z). front = 책등이 서는 면
function addBook(g, side, x, y0, h, w, d, front, book) {
  const ry = side === 0 ? 0 : Math.PI;
  const zc = side === 0 ? front - d / 2 : -(front - d / 2);
  const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y0 + h / 2, zc), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
  const world = new THREE.Matrix4().multiplyMatrices(g.matrixWorld, local);
  real.push({ book, matrix: world, w, h, d, host: curHost });
}

function addFiller(g, side, x, y0, h, w, d, front, lean) {
  const ry = side === 0 ? 0 : Math.PI;
  const zc = side === 0 ? front - d / 2 : -(front - d / 2);
  tmpQ.setFromEuler(new THREE.Euler(0, ry, lean));
  tmpP.set(x, y0 + h / 2 - lean * 0.02, zc);
  tmpS.set(w, h, d);
  const local = new THREE.Matrix4().compose(tmpP, tmpQ, tmpS);
  fillers.push({ matrix: new THREE.Matrix4().multiplyMatrices(g.matrixWorld, local), color: FILL[Math.floor(rnd() * FILL.length)], host: curHost });
}

// 칸 이름표 (칸 앞 턱에 붙은 작은 판 — 「고대 · 이야기 루트」)
function rowPlate(g, side, text, cx, y0, front, color = '#3b2a20') {
  const c = document.createElement('canvas'); c.width = 384; c.height = 64;
  const draw = () => {
    const p = c.getContext('2d');
    p.clearRect(0, 0, 384, 64);
    p.fillStyle = '#efe2c8'; p.beginPath(); p.roundRect(2, 2, 380, 60, 10); p.fill();
    p.fillStyle = color; p.fillRect(2, 2, 10, 60);
    p.fillStyle = '#2f241c'; p.font = '700 30px "Gowun Dodum", sans-serif'; p.textBaseline = 'middle';
    p.fillText(text.length > 18 ? text.slice(0, 17) + '…' : text, 22, 34);
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.07), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  m.position.set(cx, y0 + 0.05, side === 0 ? front - 0.01 : -(front - 0.01));
  m.rotation.y = side === 0 ? 0 : Math.PI;
  m.userData.noHit = true;
  g.add(m);
}

export function shelfLabel(g, text, w, h, d, sides, color = '#3b2a20') {
  if (Array.isArray(text)) { text.forEach((tx, s) => { if (tx) shelfLabelOne(g, tx, w, h, d, s, color); }); return; }
  for (let s = 0; s < sides; s++) shelfLabelOne(g, text, w, h, d, s, color);
}
function shelfLabelOne(g, text, w, h, d, s, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const draw = () => {
    const x = c.getContext('2d');
    x.clearRect(0, 0, 512, 96);
    x.fillStyle = '#f3e6cf'; x.beginPath(); x.roundRect(4, 4, 504, 88, 14); x.fill();
    x.strokeStyle = color; x.lineWidth = 4; x.stroke();
    let fs = 46;
    x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
    do { x.font = `700 ${fs}px "Gowun Batang", serif`; fs -= 2; } while (fs > 24 && x.measureText(text).width > 480);
    x.fillText(text, 256, 50);
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
  const lw = Math.min(1.3, w * 0.6);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(lw, lw * 96 / 512), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  m.position.set(0, h + 0.13, s === 0 ? d / 2 - 0.02 : -d / 2 + 0.02);
  m.rotation.y = s === 0 ? 0 : Math.PI;
  m.userData.noHit = true;
  g.add(m);
}

// 진짜 책이 꽂힌 자리 (첫 방문 길잡이가 가까운 책장을 찾을 때)
export function bookSpots() { return real.map((r) => new THREE.Vector3().setFromMatrixPosition(r.matrix)); }

// ---------- 다 놓은 뒤 한 번에 그리기 ----------
const CW = 32, CH = 256, AW = 1024, AH = 4096, COLS = AW / CW;   // 책등 512권까지
export function finalizeBooks(scene) {
  // 장식 책 (놓인 무리별로 한 덩어리)
  const fillHosts = new Map();
  for (const f of fillers) { const h = f.host || scene; if (!fillHosts.has(h)) fillHosts.set(h, []); fillHosts.get(h).push(f); }
  for (const [host, list] of fillHosts) {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85 }), list.length);
    const col = new THREE.Color();
    host.updateMatrixWorld(true);
    const inv = host === scene ? null : new THREE.Matrix4().copy(host.matrixWorld).invert();
    list.forEach((f, i) => { im.setMatrixAt(i, inv ? new THREE.Matrix4().multiplyMatrices(inv, f.matrix) : f.matrix); im.setColorAt(i, col.set(f.color)); });
    im.instanceMatrix.needsUpdate = true;
    im.receiveShadow = true;
    im.userData.filler = true;
    host.add(im);
  }
  if (!real.length) return null;
  // 책등 글씨 모음 그림
  const canvas = document.createElement('canvas'); canvas.width = AW; canvas.height = AH;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const paint = () => {
    const g = canvas.getContext('2d');
    g.fillStyle = '#efe4cf'; g.fillRect(0, 0, AW, AH);
    real.forEach((r, i) => {
      const cx = (i % COLS) * CW, cy = Math.floor(i / COLS) * CH;
      const a = ATLAS[r.book.atlas];
      const base = new THREE.Color(a?.spine || '#555').offsetHSL(((r.book.no || 0) % 5 - 2) * 0.008, 0, ((r.book.no || 0) % 3 - 1) * 0.035);
      g.fillStyle = '#' + base.getHexString(); g.fillRect(cx, cy, CW, CH);
      g.fillStyle = '#d9b86a';
      g.fillRect(cx + 2, cy + 14, CW - 4, 2); g.fillRect(cx + 2, cy + 20, CW - 4, 1);
      g.fillRect(cx + 2, cy + CH - 38, CW - 4, 1);
      g.save();
      g.translate(cx + CW / 2 + 1, cy + 30);
      g.rotate(Math.PI / 2);
      g.fillStyle = '#f6ecd6';
      g.font = '700 17px "Gowun Batang", serif';
      g.textBaseline = 'middle';
      let t = r.book.title;
      while (g.measureText(t).width > CH - 80 && t.length > 2) t = t.slice(0, -2) + '…';
      g.fillText(t, 0, 0);
      g.restore();
      g.fillStyle = '#f6ecd6';
      g.font = '600 11px "Gowun Dodum", sans-serif';
      g.textAlign = 'center';
      g.fillText(a?.short || '', cx + CW / 2, cy + CH - 22);
      g.textAlign = 'left';
    });
    // 책장 넘기는 쪽(종이) 색 자리: 마지막 칸
    tex.needsUpdate = true;
  };
  paint();
  document.fonts?.ready.then(paint);
  const hosts = new Map();
  real.forEach((r, i) => {
    const hk = r.host || scene;
    if (!hosts.has(hk)) hosts.set(hk, { geos: [], ids: [] });
    const { geos, ids } = hosts.get(hk);
    const geo = new THREE.BoxGeometry(r.w, r.h, r.d);
    const cx = (i % COLS) * CW, cy = Math.floor(i / COLS) * CH;
    const u0 = cx / AW, u1 = (cx + CW) / AW, vt = 1 - cy / AH, vb = 1 - (cy + CH) / AH;
    const uv = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const idx = f * 4 + k;
        const u = uv.getX(idx), v = uv.getY(idx);
        if (f === 4) uv.setXY(idx, u0 + u * (u1 - u0), vb + v * (vt - vb));           // +z 책등
        else if (f === 2 || f === 3) uv.setXY(idx, 0.002 + u * 0.004, 0.002 + v * 0.004); // 위아래: 종이
        else uv.setXY(idx, u0 + 0.3 * (u1 - u0) + u * 0.2 * (u1 - u0), vb + 0.5 * (vt - vb) + v * 0.02); // 겉장
      }
    }
    hk.updateMatrixWorld(true);
    geo.applyMatrix4(hk === scene ? r.matrix : new THREE.Matrix4().copy(hk.matrixWorld).invert().multiply(r.matrix));
    geos.push(geo);
    ids.push(r.book.id);
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  let m = null;
  for (const [hk, { geos, ids }] of hosts) {
    const mm = new THREE.Mesh(mergeGeometries(geos, false), mat);
    mm.castShadow = false;
    mm.receiveShadow = true;
    mm.userData.bookIds = ids;
    mm.userData.trisPerBook = 12;
    hk.add(mm);
    if (!m) m = mm;
  }
  // 책 위치 (찾아가기용)
  const where = new Map();
  real.forEach((r) => { const p = new THREE.Vector3().setFromMatrixPosition(r.matrix); if (!where.has(r.book.id)) where.set(r.book.id, p); });
  return { mesh: m, where };
}

// 평대: 표지가 보이게 눕혀 둔 책들
export function displayTable(scene, room, x, z, books, o = {}) {
  const g = new THREE.Group();
  const W = 1.9, D = 1.0, H = 0.78;
  plank(g, W, 0.06, D, 0, H - 0.03, 0, M.wood(), 0.02);
  plank(g, W - 0.1, 0.5, D - 0.1, 0, 0.3, 0, M.woodDark(), 0.02);
  g.position.set(x, 0, z);
  g.rotation.y = o.rotY || 0;
  scene.add(g);
  room.obstacles.push(footprint(x, z, W, D, o.rotY || 0));
  const list = books.slice(0, 8);
  const hits = [];
  list.forEach((b, i) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 384;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const draw = (img) => { drawCover(c.getContext('2d'), 256, 384, b, ATLAS[b.atlas], img); t.needsUpdate = true; };
    draw(null);
    if (b.cover) {
      const img = new Image();
      img.onload = () => draw(img);
      img.src = b.cover;
    } else document.fonts?.ready.then(() => draw(null));
    const mats = [M.color('#e9dcc2'), M.color('#e9dcc2'), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), M.color('#e9dcc2'), M.color('#e9dcc2'), M.color('#e9dcc2')];
    const bk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03 + (b.parts % 4) * 0.008, 0.45), mats);
    const col = i % 4, row = Math.floor(i / 4);
    bk.position.set(-0.69 + col * 0.46, H + 0.02, -0.24 + row * 0.5);
    bk.rotation.y = (rnd() - 0.5) * 0.16;
    bk.castShadow = true;
    bk.userData.bookId = b.id;
    g.add(bk);
    hits.push(bk);
  });
  // 작은 안내판
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const draw = () => {
    const x2 = c.getContext('2d');
    x2.fillStyle = '#3e3a36'; x2.fillRect(0, 0, 256, 128);
    x2.fillStyle = '#f2e7d3'; x2.textAlign = 'center';
    x2.font = '700 34px "Gowun Batang", serif'; x2.fillText(o.title || '이번 달의 책', 128, 58);
    x2.font = '22px "Gowun Dodum", sans-serif'; x2.fillText('눌러서 펼쳐 보세요', 128, 98);
  };
  draw();
  const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.ready.then(() => { draw(); tt.needsUpdate = true; });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: tt }));
  sign.position.set(0, H + 0.2, D / 2 - 0.05);
  sign.rotation.x = -0.4;
  sign.userData.noHit = true;
  g.add(sign);
  return hits;
}

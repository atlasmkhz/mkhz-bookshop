// 고양이서가 제품 가구: 오르미캣타워, 커스텀B 월캣타워, 월스텝 선반, 계단형 숨숨집, 집사4호(책장 캣타워), 벨라4호
// 커스텀B · 계단형 숨숨집 · 집사4호 · 벨라4호는 스마트스토어 치수표 그대로(cm → m) 만들었습니다.
// - 처음엔 코드로 만든 모델을 쓰고, config.js 에 glb 경로를 넣으면 그 파일로 바뀝니다.
// - 고양이가 오르내리는 길(path)과 숨숨집(box) 자리는 모델과 따로 정의되어 있어
//   GLB로 바꿔도 고양이 동작은 그대로 유지됩니다.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { M, rbox, mesh, plank } from './kit.js';

const U = 0.45;   // 오르미 한 칸 폭 · 깊이 (m)
const T = 0.03;   // 판재 두께
const POST = 0.042;

// ---------- 부품 ----------
function sisalMaterial() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#cdb38a'; g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 4) {
    g.fillStyle = '#a98a5e'; g.fillRect(0, y, 64, 1.5);
    g.fillStyle = '#e2cca4'; g.fillRect(0, y + 2, 64, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
}
let _sisal;
const sisal = () => (_sisal ||= sisalMaterial());

// 둥근 구멍 뚫린 판 (숨숨집 앞판)
function holePanel(w, h, holeR, holeY, mat) {
  const s = new THREE.Shape();
  const r = 0.012;
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const hole = new THREE.Path();
  hole.absarc(0, holeY, holeR, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: T - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 28 });
  geo.translate(0, 0, -(T - 0.008) / 2);
  // 나뭇결 UV 크기 보정
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.6, uv.getY(i) * 1.6);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// 아치(둥근 지붕 문) 구멍이 뚫린 판 — 숨숨집 앞판
function archPanel(w, h, aw, ah, mat, ax = 0, thick = T) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
  const hole = new THREE.Path();
  const y0 = -h / 2 + 0.012, r = aw / 2;
  hole.moveTo(ax - r, y0); hole.lineTo(ax - r, y0 + ah - r); hole.absarc(ax, y0 + ah - r, r, Math.PI, 0, true); hole.lineTo(ax + r, y0); hole.lineTo(ax - r, y0);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 20 });
  geo.translate(0, 0, -thick / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.6, uv.getY(i) * 1.6);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
// 네모 구멍 판 (커스텀B 맨 아래 왼쪽 입구)
function squarePanel(w, h, sw, sh, mat, sx = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
  const hole = new THREE.Path();
  const y0 = -h / 2 + 0.03;
  hole.moveTo(sx - sw / 2, y0); hole.lineTo(sx - sw / 2, y0 + sh); hole.lineTo(sx + sw / 2, y0 + sh); hole.lineTo(sx + sw / 2, y0); hole.lineTo(sx - sw / 2, y0);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false });
  geo.translate(0, 0, -T / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
const white = () => (white._m ||= new THREE.MeshStandardMaterial({ color: '#f4f0e8', roughness: 0.82 }));
const pine = () => M.woodLight();
// 상자 하나: 바닥 · 뒤 · 양옆 · 위 + 앞판(아치 · 네모 구멍 · 막힘 · 없음). x0~x1, y0~y1, 깊이 D(앞이 +z)
function box(g, x0, x1, y0, y1, D, mat, front = 'open', o = {}) {
  const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  plank(g, w, T, D, cx, y0 + T / 2, 0, o.floorMat || mat, 0.004);
  plank(g, w, T, D, cx, y1 - T / 2, 0, o.topMat || mat, 0.004);
  plank(g, T, h - T * 2, D, x0 + T / 2, cy, 0, mat, 0.004);
  plank(g, T, h - T * 2, D, x1 - T / 2, cy, 0, mat, 0.004);
  if (o.back !== false) plank(g, w - T * 2, h - T * 2, T, cx, cy, -D / 2 + T / 2, o.backMat || mat, 0.004);
  const fw = w - T * 2 + 0.002, fh = h - T * 2 + 0.002;
  let f = null;
  if (front === 'arch') f = archPanel(fw, fh, o.aw || Math.min(0.2, fw * 0.55), o.ah || Math.min(0.26, fh * 0.8), o.frontMat || mat, o.ax || 0);
  else if (front === 'square') f = squarePanel(fw, fh, o.sw || 0.16, o.sh || 0.16, o.frontMat || mat, o.sx || 0);
  else if (front === 'solid') f = mesh(rbox(fw, fh, T, 0.004), o.frontMat || mat);
  if (f) { f.position.set(cx, cy, D / 2 - T / 2); g.add(f); }
  if (o.paw) {
    // 앞판 발자국 구멍 느낌 (작은 원 네 개 + 큰 원)
    const pm = M.color('#d9d2c6', 0.9);
    const px = o.paw[0], py = o.paw[1];
    g.add(mesh(new THREE.CircleGeometry(0.012, 10), pm, cx + px, cy + py, D / 2 + 0.001));
    for (const [dx, dy] of [[-0.02, 0.02], [-0.007, 0.03], [0.007, 0.03], [0.02, 0.02]]) g.add(mesh(new THREE.CircleGeometry(0.005, 8), pm, cx + px + dx, cy + py + dy, D / 2 + 0.001));
  }
  return { cx, cy, w, h };
}
function pad(g, x, y, w, d, color = '#d9d2c6', z = 0) {
  g.add(mesh(rbox(w, 0.016, d, 0.006), M.fabric(color), x, y + 0.008, z));
}
// 지그재그 계단: 디딤판 목록 [x, y(윗면)], 깊이 D, 디딤판 폭 w. 앞 디딤판 왼쪽 끝에서 다음 디딤판으로 세로판이 이어짐
function zigzag(g, steps, D, w, mat, dir = -1) {
  for (let i = 0; i < steps.length; i++) {
    const [x, y] = steps[i];
    plank(g, w, T, D - 0.01, x, y - T / 2, 0, mat, 0.004);
    pad(g, x, y, w - 0.03, D - 0.1);
    if (i < steps.length - 1) {
      const y2 = steps[i + 1][1];
      const rx = x + dir * w / 2;
      plank(g, T, y2 - y + T, D - 0.01, rx, (y + y2) / 2, 0, mat, 0.004);
    }
  }
}

// 열린 프레임 한 칸 (기둥 4개 + 위판 + 아래 테두리)
function frameColumn(g, cx, H, opts = {}) {
  const wood = M.wood();
  const dark = M.woodMid();
  const half = U / 2 - POST / 2;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    if (opts.skipPosts && opts.skipPosts.includes(`${dx},${dz}`)) continue;
    const isSisal = opts.sisal && dx === 1 && dz === 1;
    if (isSisal) {
      const m = mesh(new THREE.CylinderGeometry(0.036, 0.036, H - T, 18), sisal(), cx + dx * half, (H - T) / 2, dz * half);
      g.add(m);
    } else {
      plank(g, POST, H - T, POST, cx + dx * half, (H - T) / 2, dz * half, dark, 0.008);
    }
  }
  // 위판 (조금 튀어나오게)
  plank(g, U + 0.02, T, U + 0.02, cx, H - T / 2, 0, wood, 0.012);
  // 아래 테두리
  plank(g, U - POST, 0.03, 0.025, cx, 0.05, half, dark, 0.006);
  plank(g, U - POST, 0.03, 0.025, cx, 0.05, -half, dark, 0.006);
  if (opts.midShelf) plank(g, U - 0.01, T * 0.8, U - 0.01, cx, opts.midShelf, 0, wood, 0.01);
}

// 숨숨집 상자 한 칸 (구멍 뚫린 닫힌 상자, 위가 첫 계단)
function hideBox(g, cx, H) {
  const wood = M.woodLight();
  const mid = M.wood();
  // 바닥
  plank(g, U, T, U, cx, T / 2, 0, mid, 0.01);
  // 옆판, 뒤판
  plank(g, T, H - T * 2, U, cx - U / 2 + T / 2, H / 2, 0, wood, 0.01);
  plank(g, T, H - T * 2, U, cx + U / 2 - T / 2, H / 2, 0, wood, 0.01);
  plank(g, U - T * 2, H - T * 2, T, cx, H / 2, -U / 2 + T / 2, wood, 0.01);
  // 앞판 (둥근 입구)
  const front = holePanel(U - T * 2 + 0.004, H - T * 2, 0.13, -0.02, wood);
  front.position.set(cx, H / 2, U / 2 - T / 2);
  g.add(front);
  // 위판 = 계단
  plank(g, U + 0.02, T, U + 0.02, cx, H - T / 2, 0, M.wood(), 0.012);
  // 안쪽 쿠션
  const cushion = mesh(rbox(U - 0.08, 0.04, U - 0.08, 0.018), M.fabric('#efe4d2'), cx, T + 0.02, 0);
  g.add(cushion);
}

// 옆 수납칸 (서랍 + 열린 칸)
function sideStorage(g, cx, w, H) {
  const wood = M.woodLight();
  const mid = M.wood();
  plank(g, w, T, U, cx, T / 2, 0, mid, 0.01);
  plank(g, T, H - T, U, cx - w / 2 + T / 2, (H - T) / 2 + T / 2, 0, wood, 0.01);
  plank(g, T, H - T, U, cx + w / 2 - T / 2, (H - T) / 2 + T / 2, 0, wood, 0.01);
  plank(g, w - T * 2, H - T, T, cx, (H - T) / 2 + T / 2, -U / 2 + T / 2, wood, 0.01);
  plank(g, w + 0.02, T, U + 0.02, cx, H - T / 2, 0, M.wood(), 0.012);
  plank(g, w - T * 2, T * 0.8, U - T, cx, H * 0.45, 0, mid, 0.01);
  // 아래 서랍
  const dh = H * 0.45 - T * 1.5;
  plank(g, w - T * 2 - 0.01, dh - 0.01, T, cx, T + dh / 2, U / 2 - T / 2, M.woodLight(), 0.01);
  const knob = mesh(new THREE.SphereGeometry(0.017, 14, 10), M.woodDark(), cx, T + dh / 2, U / 2 + 0.008);
  g.add(knob);
  // 위 칸 안의 소품: 장난감 공, 털실
  const ball = mesh(new THREE.SphereGeometry(0.045, 16, 12), M.color('#e98b7a', 0.9), cx - 0.04, H * 0.45 + 0.06, 0.05);
  g.add(ball);
  const yarn = mesh(new THREE.TorusKnotGeometry(0.03, 0.012, 40, 6, 2, 3), M.color('#8fb3c9', 1), cx + 0.06, H * 0.45 + 0.055, -0.04);
  g.add(yarn);
}

function felt(g, x, y, color = '#d9d2c6') {
  const m = mesh(rbox(U - 0.06, 0.018, U - 0.06, 0.008), M.fabric(color), x, y + 0.009, 0);
  g.add(m);
}

// ---------- 오르미캣타워 ----------
// 로컬 좌표: x = 길이 방향, +z = 앞, 원점 = 바닥 중심
export function buildOrmiModel() {
  const g = new THREE.Group();
  hideBox(g, -U, U);                                   // 1칸: 숨숨집 상자 (위가 첫 계단)
  frameColumn(g, 0, U * 2, { midShelf: U });           // 2칸
  frameColumn(g, U, U * 3, { midShelf: U * 1.5, sisal: true }); // 3칸 (스크래쳐 기둥)
  sideStorage(g, U * 1.5 + 0.15, 0.3, U * 2);          // 옆 수납칸
  felt(g, 0, U * 2, '#d8cfc1');
  felt(g, U, U * 3, '#c9b8a3');
  // 위층 연결 받침
  return g;
}
const ORMI_NAV = {
  // 고양이 길: 양 끝이 바닥(y=0)이면 바닥과 이어진 출입구
  path: [
    [-U, 0, 0.62],
    [-U, U, 0],
    [0, U * 2, 0],
    [U, U * 3, 0],
    [U * 1.5 + 0.15, U * 2, 0.02],
    [U * 1.5 + 0.15, 0, 0.62],
  ],
  boxes: [{ floor: [-U, 0, 0.62], inside: [-U, 0.07, -0.02] }],
  bounds: [-U * 1.5 - 0.02, U * 1.5 + 0.31, -U / 2 - 0.02, U / 2 + 0.02],
};

// ---------- 커스텀B 월캣타워 (실제 치수: 폭 40 + 90 + 120 = 250, 깊이 46, 높이 179.8 cm) ----------
// 왼쪽 40: 칸 다섯(23.8 · 26 · 29.2 · 29.2 · 60.4) — 아래 둘은 흰 문 · 서랍, 위는 열린 칸에 펠트
// 가운데 90: 흰 숨숨집 상자를 계단처럼 쌓음(아치 문 · 발판 30×20)
// 오른쪽 120: 37.6 칸 세 줄 — 맨 윗칸 뒤판에 둥근 구멍, 오른쪽 위 흰 숨숨집, 지그재그 계단
export function buildCustomBModel() {
  const g = new THREE.Group();
  const D = 0.46, H = 1.798, wd = pine(), wh = white();
  // 왼쪽 기둥 (x -1.25 ~ -0.85)
  {
    const x0 = -1.25, x1 = -0.85;
    plank(g, T, H, D, x0 + T / 2, H / 2, 0, wd, 0.004);
    plank(g, T, H, D, x1 - T / 2, H / 2, 0, wd, 0.004);
    plank(g, x1 - x0 - T * 2, H - T * 2, T, (x0 + x1) / 2, H / 2, -D / 2 + T / 2, wd, 0.004);
    for (const y of [0.009, 0.635, 0.945, 1.255, 1.533, 1.789]) plank(g, x1 - x0, T, D, (x0 + x1) / 2, y, 0, wd, 0.004);
    // 흰 문(맨 아래) · 흰 서랍 둘
    const fw = x1 - x0 - T * 2 - 0.004;
    plank(g, fw, 0.6, T, (x0 + x1) / 2, 0.018 + 0.3, D / 2 - T / 2, wh, 0.004);
    plank(g, fw, 0.28, T, (x0 + x1) / 2, 0.644 + 0.14, D / 2 - T / 2, wh, 0.004);
    plank(g, fw, 0.28, T, (x0 + x1) / 2, 0.954 + 0.14, D / 2 - T / 2, wh, 0.004);
    for (const y of [0.32, 0.784, 1.094]) plank(g, 0.05, 0.012, 0.01, (x0 + x1) / 2, y, D / 2 + 0.004, M.woodMid(), 0.003);
    pad(g, (x0 + x1) / 2, 1.264, 0.34, 0.38);
  }
  // 가운데 흰 상자들 (x -0.85 ~ 0.05)
  {
    const x0 = -0.85, x1 = 0.05;
    box(g, x0, x1, 0.0, 0.31, D, wh, 'square', { sw: 0.18, sh: 0.17, sx: -0.3 });          // 맨 아래: 네모 입구
    const f1 = archPanel(0.3, 0.27, 0.18, 0.22, wh, 0.0);                                 // 맨 아래 오른쪽 아치
    f1.position.set(x1 - 0.2, 0.155, D / 2 - T / 2 + 0.001); g.add(f1);
    box(g, x0, x1, 0.31, 0.60, D, wh, 'arch', { aw: 0.19, ah: 0.24, ax: 0.1 });
    pad(g, x0 + 0.25, 0.60, 0.3, 0.2, '#d9d2c6', D / 2 + 0.08);                          // 튀어나온 발판
    plank(g, 0.3, T, 0.2, x0 + 0.25, 0.60 - T / 2, D / 2 + 0.08, wd, 0.004);
    box(g, x0, x1, 0.60, 0.90, D, wh, 'arch', { aw: 0.19, ah: 0.24, ax: -0.2 });
    pad(g, x1 - 0.2, 0.90, 0.3, 0.2, '#d9d2c6', D / 2 + 0.08);
    plank(g, 0.3, T, 0.2, x1 - 0.2, 0.90 - T / 2, D / 2 + 0.08, wd, 0.004);
    box(g, x0, x0 + 0.5, 0.90, 1.20, D, wh, 'arch', { aw: 0.18, ah: 0.23, ax: 0.08, paw: [-0.17, -0.06] });
    plank(g, 0.4, T, D, x1 - 0.2, 1.20 - T / 2, 0, wd, 0.004);                           // 오른쪽 위 나무 선반 (46 cm)
    box(g, x0, x0 + 0.4, 1.20, 1.50, D, wh, 'solid', { paw: [-0.12, -0.08] });            // 맨 위 흰 상자
    plank(g, x1 - x0, T, D, (x0 + x1) / 2, 1.789, 0, wd, 0.004);                         // 상판
    plank(g, T, H, D, x1 - T / 2, H / 2, 0, wd, 0.004);                                   // 가운데·오른쪽 사이 기둥
    pad(g, x0 + 0.2, 1.50, 0.34, 0.38, '#cfc6b8');
  }
  // 오른쪽 세 줄 (x 0.05 ~ 1.25)
  {
    const x0 = 0.05, x1 = 1.25;
    const div = [0.059, 0.453, 0.847, 1.241];
    const cols = [0.256, 0.65, 1.044];
    for (const x of div) plank(g, T, H, D, x, H / 2, 0, wd, 0.004);
    plank(g, x1 - x0, T, D, (x0 + x1) / 2, 0.009, 0, wd, 0.004);
    plank(g, x1 - x0, T, D, (x0 + x1) / 2, 1.789, 0, wd, 0.004);
    plank(g, x1 - x0, T, D, (x0 + x1) / 2, 1.415, 0, wd, 0.004);
    // 맨 윗칸 뒤판 둥근 구멍
    for (const cx of cols) { const bp = holePanel(0.376, 0.356, 0.1, 0, wd); bp.position.set(cx, 1.602, -D / 2 + T / 2); g.add(bp); }
    // 그 아래 뒤판(열린 느낌으로 얇게)
    plank(g, x1 - x0 - T * 2, 1.4, T, (x0 + x1) / 2, 0.72, -D / 2 + T / 2, wd, 0.004);
    plank(g, 0.376, T, D, cols[0], 0.947, 0, wd, 0.004);                                  // 1열 선반 (계단 도착)
    plank(g, 0.376, T, D, cols[1], 1.059, 0, wd, 0.004);
    plank(g, 0.376, T, D, cols[2], 1.059, 0, wd, 0.004);
    plank(g, 0.376, T, D, cols[2], 0.703, 0, wd, 0.004);
    // 오른쪽 위 흰 숨숨집 (33.8)
    box(g, 0.856, 1.232, 1.068, 1.406, D - 0.02, wh, 'arch', { aw: 0.17, ah: 0.24, ax: 0.03, paw: [-0.13, -0.08], back: false });
    pad(g, cols[1], 1.068, 0.3, 0.38);
    // 지그재그 계단 (오른쪽 아래 → 1열 선반)
    zigzag(g, [[1.14, 0.18], [0.95, 0.36], [0.76, 0.54], [0.57, 0.72], [0.38, 0.90]], D, 0.19, wd);
    pad(g, cols[0], 0.018, 0.3, 0.38, '#e5d9c6');
  }
  return g;
}
const CUSTOMB_NAV = {
  path: [
    [1.14, 0, 0.7],
    [1.14, 0.2, 0.05],
    [0.95, 0.38, 0.0],
    [0.76, 0.56, 0.0],
    [0.57, 0.74, 0.0],
    [0.38, 0.92, 0.0],
    [0.2, 0.97, 0.0],
    [-0.15, 1.23, 0.0],
    [-0.6, 1.23, 0.0],
    [-0.65, 1.53, 0.0],
    [-1.05, 1.29, 0.0],
  ],
  boxes: [
    { floor: [-0.2, 0, 0.7], inside: [-0.25, 0.05, -0.05] },
  ],
  hides: [[-0.3, 0.33, -0.05], [-0.6, 0.62, -0.05], [-0.52, 0.92, -0.05], [1.044, 1.08, -0.05]],
  bounds: [-1.26, 1.26, -0.24, 0.24],
};

// ---------- 월스텝 선반 (벽에 붙는 계단 선반 + 꼭대기 전망 선반) ----------
// 로컬 좌표: x = 벽을 따라, +z = 앞(벽에서 떨어지는 쪽), 뒤판이 벽
export function buildCatwalkModel() {
  const g = new THREE.Group();
  const wood = M.wood(), dark = M.woodMid();
  const steps = [[-0.75, 0.35], [-0.3, 0.7], [0.15, 1.05], [0.6, 1.4]];
  for (const [x, y] of steps) {
    plank(g, 0.42, T, 0.3, x, y, 0.15, wood, 0.01);
    for (const sx of [-0.16, 0.16]) {
      const br = mesh(rbox(0.03, 0.12, 0.2, 0.006), dark, x + sx, y - 0.075, 0.1);
      g.add(br);
    }
    felt(g, x, y, '#d9d2c6');
  }
  // 꼭대기 전망 선반 (넓게) + 낮은 난간
  plank(g, 0.9, T, 0.4, 0.4, 1.8, 0.2, wood, 0.012);
  plank(g, 0.9, 0.05, 0.03, 0.4, 1.84, 0.385, M.woodLight(), 0.01);
  for (const sx of [0.0, 0.8]) g.add(mesh(rbox(0.03, 0.14, 0.3, 0.006), dark, sx, 1.71, 0.15));
  felt(g, 0.4, 1.8, '#c9b8a3');
  // 스크래쳐 기둥 (바닥에서 첫 계단까지)
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.33, 16), sisal(), -0.75, 0.165, 0.15));
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.03, 20), dark, -0.75, 0.015, 0.15));
  return g;
}
const CATWALK_NAV = {
  path: [
    [-0.75, 0, 0.62],
    [-0.75, 0.37, 0.15],
    [-0.3, 0.72, 0.15],
    [0.15, 1.07, 0.15],
    [0.6, 1.42, 0.15],
    [0.45, 1.82, 0.2],
  ],
  boxes: [],
  bounds: [-1.0, 0.9, -0.02, 0.42],
};

// ---------- 계단형 숨숨집 (상자 넷을 계단처럼: 82 · 62 · 42 · 24 cm, 폭 40, 깊이 40) ----------
export function buildCathouseModel() {
  const g = new THREE.Group();
  const D = 0.4, wd = pine();
  // 높은 상자: 아래 열린 칸 + 위 아치 숨숨집
  box(g, -0.8, -0.4, 0.0, 0.41, D, wd, 'open');
  box(g, -0.8, -0.4, 0.41, 0.82, D, wd, 'arch', { aw: 0.2, ah: 0.28 });
  box(g, -0.4, 0.0, 0.0, 0.62, D, wd, 'solid');
  box(g, 0.0, 0.4, 0.0, 0.42, D, wd, 'open');
  box(g, 0.4, 0.8, 0.0, 0.24, D, wd, 'open');
  pad(g, -0.2, 0.62, 0.34, 0.34, '#d9d2c6');
  pad(g, 0.2, 0.42, 0.34, 0.34, '#d9d2c6');
  pad(g, 0.6, 0.24, 0.34, 0.34, '#d9d2c6');
  pad(g, -0.6, 0.018, 0.3, 0.3, '#efe4d2');
  return g;
}
const CATHOUSE_NAV = {
  path: [
    [0.6, 0, 0.62],
    [0.6, 0.26, 0.0],
    [0.2, 0.44, 0.0],
    [-0.2, 0.64, 0.0],
    [-0.6, 0.84, 0.0],
  ],
  boxes: [{ floor: [-0.6, 0, 0.62], inside: [-0.6, 0.05, -0.03] }],
  hides: [[-0.6, 0.43, -0.03]],
  bounds: [-0.82, 0.82, -0.22, 0.22],
};

// ---------- 집사4호 원목 캣타워 (책장 + 고양이 계단: 200.6 × 40 × 179.8 cm) ----------
// 왼쪽 80.6: 37.6 칸 두 줄, 맨 아래는 여닫이 수납장(77 × 69.4), 왼쪽 위 칸은 고양이 얼굴 구멍
// 오른쪽 120: 37.6 칸 세 줄, 오른쪽 아래에서 왼쪽 가운데 선반까지 지그재그 계단, 아래 칸엔 방석
// 책은 열린 칸에 꽂힙니다 (bookSlots)
export function buildJipsa4Model() {
  const g = new THREE.Group();
  const D = 0.4, H = 1.798, wd = pine();
  const cA = -0.797, cB = -0.403, c1 = 0.009, c2 = 0.403, c3 = 0.797;
  // 세로판
  for (const x of [-0.994, -0.6, -0.206, 0.206, 0.6, 0.994]) plank(g, T, H, D, x, H / 2, 0, wd, 0.004);
  // 바닥 · 상판
  plank(g, 2.006, T, D, 0, 0.009, 0, wd, 0.004);
  plank(g, 2.006, T, D, 0, 1.789, 0, wd, 0.004);
  // 왼쪽 선반
  for (const y of [0.703, 1.059, 1.415]) plank(g, 0.806, T, D, -0.6, y, 0, wd, 0.004);
  // 수납장 문 둘 + 손잡이
  for (const s of [-1, 1]) {
    plank(g, 0.383, 0.676, T, -0.6 + s * 0.1965, 0.018 + 0.338, D / 2 - T / 2, wd, 0.004);
    plank(g, 0.014, 0.08, 0.012, -0.6 + s * 0.03, 0.4, D / 2 + 0.004, M.woodMid(), 0.004);
  }
  // 왼쪽 위 칸: 고양이 얼굴 구멍판 (둥근 구멍 + 귀)
  const face = holePanel(0.376, 0.338, 0.1, -0.01, wd);
  face.position.set(cA, 1.602, D / 2 - T / 2); g.add(face);
  for (const s of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.035, 0.06, 3), wd, cA + s * 0.075, 1.602 + 0.11, D / 2 - T / 2); ear.rotation.y = Math.PI / 6; g.add(ear); }
  // 오른쪽 선반
  plank(g, 1.2, T, D, 0.6, 1.415, 0, wd, 0.004);
  plank(g, 0.376, T, D, c1, 1.059, 0, wd, 0.004);
  plank(g, 0.376, T, D, c1, 0.365, 0, wd, 0.004);
  plank(g, 0.376, T, D, c2, 1.059, 0, wd, 0.004);
  plank(g, 0.376, T, D, c3, 1.059, 0, wd, 0.004);
  plank(g, 0.376, T, D, c3, 0.703, 0, wd, 0.004);
  // 지그재그 계단 (오른쪽 아래 → 1열 선반 1.068)
  zigzag(g, [[0.89, 0.196], [0.70, 0.374], [0.51, 0.552], [0.32, 0.73], [0.13, 0.908]], D, 0.19, wd);
  plank(g, T, 0.16, D - 0.01, 0.035, 0.99, 0, wd, 0.004);
  // 아래 칸 방석 셋
  for (const [cx, col] of [[c1, '#e8d2cf'], [c2, '#efe3d2'], [c3, '#e4d9c8']]) g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 20), M.fabric(col), cx, 0.033, 0.02));
  // 책 꽂을 칸 (앞면 +z): x, y0(칸 바닥), w, h, d, front
  const front = D / 2 - 0.015;
  const slot = (x, y0, h = 0.33) => ({ x, y0, w: 0.36, h, d: 0.24, front });
  g.userData.bookSlots = [
    slot(cA, 0.715), slot(cB, 0.715), slot(cA, 1.07), slot(cB, 1.07), slot(cB, 1.427),
    slot(c1, 1.427), slot(c2, 1.427), slot(c3, 1.427), slot(c2, 1.07), slot(c3, 1.07), slot(c3, 0.715),
  ];
  return g;
}
const JIPSA4_NAV = {
  path: [
    [0.89, 0, 0.62],
    [0.89, 0.21, 0.02],
    [0.70, 0.39, 0.0],
    [0.51, 0.57, 0.0],
    [0.32, 0.75, 0.0],
    [0.13, 0.93, 0.0],
    [-0.05, 1.09, 0.0],
  ],
  boxes: [
    { floor: [0.403, 0, 0.62], inside: [0.403, 0.05, -0.03] },
    { floor: [0.009, 0, 0.62], inside: [0.009, 0.05, -0.03] },
  ],
  hides: [[-0.797, 1.44, -0.03], [-0.403, 1.44, -0.03]],
  bounds: [-1.013, 1.013, -0.21, 0.21],
};

// ---------- 벨라4호 원목 캣타워 (120 × 45.4 × 165 cm, 선반 40 × 40, 투명 해먹 30 cm, 옆 계단 상자 37 × 30 × 30) ----------
export function buildBella4Model() {
  const g = new THREE.Group();
  const D = 0.454, wd = pine(), mid = M.woodMid();
  // 받침
  plank(g, 1.2, 0.12, D, 0, 0.06, 0, wd, 0.006);
  // 기둥 (왼쪽 · 가운데 · 오른쪽, 앞뒤)
  for (const x of [-0.575, 0.0, 0.575]) for (const z of [-0.2, 0.2]) plank(g, 0.045, 1.53, 0.045, x, 0.12 + 0.765, z, wd, 0.006);
  // 상단 틀
  plank(g, 1.2, 0.1, D, 0, 1.6, 0, wd, 0.006);
  // 넓은 선반 (112.8) · 작은 선반 둘 (40×40)
  plank(g, 1.128, T, 0.4, 0.0, 0.854, 0, wd, 0.004);
  plank(g, 0.4, T, 0.4, -0.33, 0.454, 0, wd, 0.004);
  plank(g, 0.4, T, 0.4, -0.33, 1.222, 0, wd, 0.004);
  // 숨숨집 (41.8 폭, 둥근 구멍) — 오른쪽 위
  box(g, 0.14, 0.558, 0.854, 1.222, D - 0.03, wd, 'open');
  const hp = holePanel(0.418 - T * 2, 0.368 - T * 2, 0.085, 0.0, wd);
  hp.position.set(0.349, 1.038, D / 2 - 0.015 - T / 2); g.add(hp);
  // 아래 아치 숨숨집 — 오른쪽 아래
  box(g, 0.14, 0.558, 0.12, 0.52, D - 0.03, wd, 'arch', { aw: 0.2, ah: 0.26 });
  // 스크래쳐 기둥 (넓은 선반 아래)
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 16), sisal(), 0.0, 0.12 + 0.36, 0.0));
  // 투명 해먹 (왼쪽 위) + 매단 장난감
  const bowl = mesh(new THREE.SphereGeometry(0.15, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.color('#dfeef2', 0.1, { transparent: true, opacity: 0.35, side: THREE.DoubleSide }), -0.33, 1.52, 0, { cast: false });
  g.add(bowl);
  g.add(mesh(new THREE.TorusGeometry(0.15, 0.008, 8, 28).rotateX(Math.PI / 2), mid, -0.33, 1.52, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.5, 4), M.color('#d9c8a8', 1), 0.06, 1.3, 0.08, { cast: false }));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10), mid, 0.06, 1.05, 0.08));
  // 펠트
  pad(g, -0.33, 0.454, 0.34, 0.34);
  pad(g, -0.33, 1.222, 0.34, 0.34);
  pad(g, 0.349, 1.222, 0.36, 0.36, '#cfc6b8');
  pad(g, 0.349, 0.52, 0.36, 0.36);
  // 옆 계단 상자 (37 × 30 × 30, 아치)
  box(g, 0.615, 0.985, 0.0, 0.30, 0.37, wd, 'arch', { aw: 0.16, ah: 0.2 });
  pad(g, 0.8, 0.30, 0.3, 0.3);
  return g;
}
const BELLA4_NAV = {
  path: [
    [0.8, 0, 0.6],
    [0.8, 0.32, 0.0],
    [0.35, 0.54, 0.0],
    [-0.33, 0.47, 0.0],
    [0.0, 0.87, 0.0],
    [0.35, 1.24, 0.0],
    [-0.33, 1.45, 0.0],
  ],
  boxes: [{ floor: [0.35, 0, 0.6], inside: [0.35, 0.14, -0.02] }],
  hides: [[0.349, 0.87, -0.03]],
  bounds: [-0.62, 1.0, -0.24, 0.24],
};

// ---------- 배치 + GLB 교체 ----------
const BUILDERS = { ormi: [buildOrmiModel, ORMI_NAV], customB: [buildCustomBModel, CUSTOMB_NAV], catwalk: [buildCatwalkModel, CATWALK_NAV], cathouse: [buildCathouseModel, CATHOUSE_NAV], jipsa4: [buildJipsa4Model, JIPSA4_NAV], bella4: [buildBella4Model, BELLA4_NAV] };
const loader = new GLTFLoader();

export function createProduct(key, { x, z, rotY }) {
  const cfg = CONFIG.products[key];
  const [build, nav] = BUILDERS[key] || BUILDERS.ormi;

  const root = new THREE.Group();
  root.name = key;
  root.position.set(x, 0, z);
  root.rotation.y = rotY;
  root.userData.product = key;

  const visual = build();
  root.add(visual);

  // 누르기 쉬운 투명 판정 상자
  const [x0, x1, z0, z1] = nav.bounds;
  const topY = Math.max(...nav.path.map((p) => p[1])) + 0.1;
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(x1 - x0, topY, z1 - z0 + 0.1),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.set((x0 + x1) / 2, topY / 2, (z0 + z1) / 2);
  hit.userData.product = key;
  root.add(hit);

  root.updateMatrixWorld(true);
  const toWorld = (p) => root.localToWorld(new THREE.Vector3(p[0], p[1], p[2]));
  const product = {
    key, root, hit, bookSlots: visual.userData.bookSlots || null, navBounds: nav.bounds,
    path: nav.path.map(toWorld),
    boxes: nav.boxes.map((b) => ({ floor: toWorld(b.floor), inside: toWorld(b.inside), rotY })),
    rotY,
    obstacle: worldBounds(root, nav.bounds),
    // 숨은 고양이 찾기: 숨는 칸(안쪽 자리)과 입구(힌트로 눈이 반짝이는 자리)
    hides: [...nav.boxes.map((b) => b.inside), ...(nav.hides || [])].map((h) => ({ inside: toWorld([h[0], Math.max(0.06, h[1]), h[2]]), eyes: toWorld([h[0], Math.max(0.06, h[1]) + 0.1, nav.bounds[3] + 0.015]), key })),
  };

  // GLB가 지정되어 있으면 불러와서 교체
  if (cfg.glb) {
    loader.load(cfg.glb, (gltf) => {
      const model = gltf.scene;
      model.scale.setScalar(cfg.scale || 1);
      model.rotation.y = THREE.MathUtils.degToRad(cfg.rotationY || 0);
      model.position.fromArray(cfg.offset || [0, 0, 0]);
      model.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
      root.remove(visual);
      root.add(model);
      console.info(`[서점] ${cfg.name} GLB 로드 완료:`, cfg.glb);
    }, undefined, (err) => {
      console.warn(`[서점] ${cfg.glb} 를 불러오지 못해 기본 모델을 씁니다.`, err);
    });
  }
  return product;
}

function worldBounds(root, [x0, x1, z0, z1]) {
  const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([a, b]) => root.localToWorld(new THREE.Vector3(a, 0, b)));
  return {
    minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)),
    minZ: Math.min(...pts.map((p) => p.z)), maxZ: Math.max(...pts.map((p) => p.z)),
  };
}


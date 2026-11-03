// 고양이서가 제품 가구: 오르미캣타워, 커스텀B 월캣타워, 월스텝 선반, 계단형 숨숨집, 집사4호(책장 캣타워), 벨라4호
// 오르미 · 커스텀B · 계단형 숨숨집 · 집사4호 · 벨라4호는 스마트스토어 치수표 그대로(cm → m) 만들었습니다.
// - 처음엔 코드로 만든 모델을 쓰고, config.js 에 glb 경로를 넣으면 그 파일로 바뀝니다.
// - 고양이가 오르내리는 길(path)과 숨숨집(box) 자리는 모델과 따로 정의되어 있어
//   GLB로 바꿔도 고양이 동작은 그대로 유지됩니다.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { M, rbox, mesh, plank } from './kit.js';

const U = 0.45;   // 계단형 숨숨집 · 월스텝 한 칸 폭 (m)
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
const white = () => (white._m ||= new THREE.MeshStandardMaterial({ color: '#faf8f4', roughness: 0.55 }));
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

function felt(g, x, y, color = '#d9d2c6') {
  const m = mesh(rbox(U - 0.06, 0.018, U - 0.06, 0.008), M.fabric(color), x, y + 0.009, 0);
  g.add(m);
}


// ---------- 구멍 뚫린 판 (공통) ----------
// cuts: [{ t: 'arch'|'circle'|'square'|'paw'|'cat'|'slot'|'notch', x, y, w, h, r }] — 판 가운데 기준 좌표(m). 아치 · 네모는 y 가 아래 끝
function cutPanel(w, h, mat, cuts = [], thick = T, bevel = 0.003) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
  for (const c of cuts) {
    const hl = new THREE.Path();
    if (c.t === 'arch') { const r = c.w / 2; hl.moveTo(c.x - r, c.y); hl.lineTo(c.x - r, c.y + c.h - r); hl.absarc(c.x, c.y + c.h - r, r, Math.PI, 0, true); hl.lineTo(c.x + r, c.y); hl.lineTo(c.x - r, c.y); }
    else if (c.t === 'circle') hl.absarc(c.x, c.y, c.r, 0, Math.PI * 2, true);
    else if (c.t === 'square') { const rr = 0.012; hl.moveTo(c.x - c.w / 2 + rr, c.y); hl.lineTo(c.x + c.w / 2 - rr, c.y); hl.quadraticCurveTo(c.x + c.w / 2, c.y, c.x + c.w / 2, c.y + rr); hl.lineTo(c.x + c.w / 2, c.y + c.h - rr); hl.quadraticCurveTo(c.x + c.w / 2, c.y + c.h, c.x + c.w / 2 - rr, c.y + c.h); hl.lineTo(c.x - c.w / 2 + rr, c.y + c.h); hl.quadraticCurveTo(c.x - c.w / 2, c.y + c.h, c.x - c.w / 2, c.y + c.h - rr); hl.lineTo(c.x - c.w / 2, c.y + rr); hl.quadraticCurveTo(c.x - c.w / 2, c.y, c.x - c.w / 2 + rr, c.y); }
    else if (c.t === 'slot') { const r = c.w / 2; hl.moveTo(c.x - r, c.y + r); hl.lineTo(c.x - r, c.y + c.h - r); hl.absarc(c.x, c.y + c.h - r, r, Math.PI, 0, true); hl.lineTo(c.x + r, c.y + r); hl.absarc(c.x, c.y + r, r, 0, Math.PI, true); }
    else if (c.t === 'paw') {
      // 발자국: 큰 타원 하나 + 발가락 넷 (구멍 다섯)
      const r = c.r || 0.02;
      const pad = new THREE.Path(); pad.absellipse(c.x, c.y, r * 1.1, r * 0.95, 0, Math.PI * 2, true); s.holes.push(pad);
      for (const [dx, dy, k] of [[-1.55, 1.05, 0.46], [-0.55, 1.65, 0.5], [0.55, 1.65, 0.5], [1.55, 1.05, 0.46]]) { const t = new THREE.Path(); t.absarc(c.x + dx * r, c.y + dy * r, r * k, 0, Math.PI * 2, true); s.holes.push(t); }
      continue;
    } else if (c.t === 'cat') {
      // 고양이 얼굴: 둥근 머리 + 귀 둘
      const r = c.r || 0.085, cy = c.y, cx = c.x;
      hl.moveTo(cx - r * 0.92, cy + r * 0.38); hl.lineTo(cx - r * 0.98, cy + r * 1.28); hl.lineTo(cx - r * 0.42, cy + r * 0.9); hl.lineTo(cx + r * 0.42, cy + r * 0.9); hl.lineTo(cx + r * 0.98, cy + r * 1.28); hl.lineTo(cx + r * 0.92, cy + r * 0.38);
      hl.absarc(cx, cy, r, Math.asin(0.38), Math.PI - Math.asin(0.38), true);
    } else if (c.t === 'notch') { hl.absarc(c.x, c.y, c.r, 0, Math.PI * 2, true); }
    s.holes.push(hl);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 22 });
  geo.translate(0, 0, -thick / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.6, uv.getY(i) * 1.6);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
// 흰 상자 (앞판에 구멍 목록). x0~x1, y0~y1, 깊이 D(앞이 +z). 뒤판은 o.back !== false 일 때
function whiteBox(g, x0, x1, y0, y1, D, cuts = [], o = {}) {
  const wh = white(), w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  plank(g, w, T, D, cx, y0 + T / 2, 0, o.floorMat || pine(), 0.003);
  plank(g, w, T, D, cx, y1 - T / 2, 0, o.topMat || pine(), 0.003);
  plank(g, T, h - T * 2, D, x0 + T / 2, cy, 0, wh, 0.003);
  plank(g, T, h - T * 2, D, x1 - T / 2, cy, 0, wh, 0.003);
  if (o.back !== false) plank(g, w - T * 2, h - T * 2, T, cx, cy, -D / 2 + T / 2, wh, 0.003);
  if (o.front !== false) { const f = cutPanel(w - T * 2 + 0.002, h - T * 2 + 0.002, wh, cuts); f.position.set(cx, cy, D / 2 - T / 2); g.add(f); }
  return { cx, cy, w, h };
}
// 투명 해먹 (지름 30 cm 반구 그릇, 위판에 끈 셋으로 매달림)
function hammock(g, x, yTop, z = 0, r = 0.15) {
  const mat = new THREE.MeshPhysicalMaterial({ color: '#e8f3f7', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat);
  bowl.position.set(x, yTop - 0.05, z); g.add(bowl);
  g.add(mesh(new THREE.TorusGeometry(r, 0.006, 8, 32).rotateX(Math.PI / 2), M.color('#d9d2c6', 0.8), x, yTop - 0.05, z));
  for (const a of [0.3, 2.4, 4.4]) g.add(mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.05, 4), M.color('#c9bfae', 1), x + Math.cos(a) * r, yTop - 0.025, z + Math.sin(a) * r));
  return bowl;
}
// 매달린 장난감 (끈 + 나무 원반)
function hangToy(g, x, yTop, len, z = 0) {
  g.add(mesh(new THREE.CylinderGeometry(0.0025, 0.0025, len, 4), M.color('#d8cdb8', 1), x, yTop - len / 2, z));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16), M.woodMid(), x, yTop - len, z));
}

// ---------- 오르미캣타워 (실제 치수: 가로 120 × 폭 40 × 높이 144.2 cm) ----------
// 칸 셋(안폭 37.6, 판재 1.8): 왼쪽 칸은 아래 수납 서랍(세로 손잡이 홈 둘) · 고양이 얼굴 문 숨숨집 · 위에 Z자 선반(18.8 둘),
// 가운데 · 오른쪽 칸은 지그재그 계단(디딤판 18.8 · 맨 아래 19.6, 단 높이 17.8)이 오른쪽 아래에서 왼쪽 위로,
// 오른쪽 위에 가드 7cm 달린 52cm 선반, 꼭대기는 가드 달린 넓은 전망대. 오른쪽 옆판 아래에 아치 문.
// 로컬 좌표: x = 길이 방향(-0.6~0.6), +z = 앞, 원점 = 바닥 중심
const OT = 0.018;      // 판재 두께
const OD = 0.40;       // 깊이
const OH = 1.442;      // 높이
// 세로 손잡이 홈 둘 뚫린 판 (서랍 앞판)
function slotPanel(w, h, mat) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
  for (const sx of [-0.08, 0.08]) {
    const hole = new THREE.Path();
    const r = 0.013, y0 = -h / 2 + 0.07, y1 = h / 2 - 0.05;
    hole.moveTo(sx - r, y0 + r); hole.lineTo(sx - r, y1 - r); hole.absarc(sx, y1 - r, r, Math.PI, 0, true); hole.lineTo(sx + r, y0 + r); hole.absarc(sx, y0 + r, r, 0, Math.PI, true);
    s.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: OT, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 12 });
  geo.translate(0, 0, -OT / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.6, uv.getY(i) * 1.6);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
// 고양이 얼굴(둥근 구멍 + 귀 둘) 뚫린 판 (숨숨집 앞판)
function catFacePanel(w, h, mat) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
  const hole = new THREE.Path();
  const r = 0.085, cy = -0.005;
  // 왼귀 → 머리 둘레(시계 방향) → 오른귀
  hole.moveTo(-r * 0.92, cy + r * 0.38);
  hole.lineTo(-r * 0.98, cy + r * 1.28);
  hole.lineTo(-r * 0.42, cy + r * 0.9);
  hole.lineTo(r * 0.42, cy + r * 0.9);
  hole.lineTo(r * 0.98, cy + r * 1.28);
  hole.lineTo(r * 0.92, cy + r * 0.38);
  hole.absarc(0, cy, r, Math.asin(0.38), Math.PI - Math.asin(0.38), true);   // 아래쪽 둥근 턱선 (귀 사이를 뺀 큰 호)
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: OT, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 28 });
  geo.translate(0, 0, -OT / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.6, uv.getY(i) * 1.6);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
export function buildOrmiModel() {
  const g = new THREE.Group();
  const wd = pine(), T = OT, D = OD;
  const Z = (y) => y;   // 읽기 쉽게
  const cA = -0.394, cB = 0, cC = 0.394;               // 칸 가운데
  const xA0 = -0.582, xA1 = -0.206, xB0 = -0.188, xB1 = 0.188, xC0 = 0.206, xC1 = 0.582;   // 칸 안쪽 가장자리
  const hs = (x0, x1, yTop, d = D, z = 0) => plank(g, x1 - x0, T, d, (x0 + x1) / 2, yTop - T / 2, z, wd, 0.003);   // 가로판 (윗면 높이로)
  const vs = (x, y0, y1, d = D, z = 0) => plank(g, T, y1 - y0, d, x, (y0 + y1) / 2, z, wd, 0.003);                 // 세로판
  const back = (x0, x1, y0, y1) => plank(g, x1 - x0, y1 - y0, T, (x0 + x1) / 2, (y0 + y1) / 2, -D / 2 + T / 2, wd, 0.003);
  // 바닥 · 받침(살짝 들어간 굽)
  hs(-0.6, 0.6, T);
  plank(g, 1.14, 0.025, D - 0.06, 0, -0.012 + 0.0125, 0, M.woodMid(), 0.003);
  // 바깥 세로판 둘 + 왼쪽 칸 오른쪽 세로판 (바닥에서 꼭대기까지)
  vs(-0.591, T, OH - T);
  vs(-0.197, T, OH - T);
  // 오른쪽 바깥판: 아래에 아치 문 (옆에서 드나드는 입구)
  {
    const y0 = T, y1 = OH - T, h = y1 - y0;
    const side = archPanel(D, h, 0.2, 0.3, wd, 0.02, T);   // 판의 가로 = 깊이 방향
    side.rotation.y = Math.PI / 2;
    side.position.set(0.591, (y0 + y1) / 2, 0);
    // archPanel 은 구멍이 판 아래쪽에 붙어 있음 → 디딤판 1 높이로 올리려고 판을 둘로: 아래 막힌 띠 + 아치 판
    side.position.y = 0.204 + (y1 - 0.204) / 2;
    side.scale.y = (y1 - 0.204) / h;
    g.add(side);
    vs(0.591, T, 0.204);
  }
  // 가운데 · 오른쪽 칸 사이 세로판: 바닥 → 가운데 칸 선반(0.738), 그 위 → 52 선반 밑
  vs(0.197, T, 0.738 - T);
  vs(0.197, 0.738, 1.075 - T);
  // ---- 왼쪽 칸: 수납 서랍(안높이 ~34) · 숨숨집(안높이 ~34) · Z자 선반 ----
  const yDrawTop = 0.36, yHideTop = 0.738;
  back(xA0, xA1, T, yHideTop - T);
  hs(xA0, xA1, yDrawTop);                              // 서랍 위 = 숨숨집 바닥
  hs(xA0, xA1, yHideTop);                              // 숨숨집 윗판 = 첫 발판
  { const f = slotPanel(xA1 - xA0 + 0.002, yDrawTop - T * 2 + 0.002, wd); f.position.set(cA, (T + yDrawTop - T) / 2, D / 2 - T / 2); g.add(f); }
  { const f = catFacePanel(xA1 - xA0 + 0.002, yHideTop - T - yDrawTop + 0.002, wd); f.position.set(cA, (yDrawTop + yHideTop - T) / 2, D / 2 - T / 2); g.add(f); }
  g.add(mesh(rbox(xA1 - xA0 - 0.06, 0.035, D - 0.08, 0.015), M.fabric('#efe4d2'), cA, yDrawTop + 0.02, 0));   // 숨숨집 안 방석
  // Z자 선반: 오른쪽 아래 발판(0.916, 18.8) ← 세로판 ← 왼쪽 위 선반(1.094, 18.8)
  hs(cA, xA1, 0.916); pad(g, (cA + xA1) / 2, 0.916, xA1 - cA - 0.03, D - 0.1);
  vs(cA, 0.916, 1.094);
  hs(xA0, cA, 1.094); pad(g, (xA0 + cA) / 2, 1.094, cA - xA0 - 0.03, D - 0.1);
  // 왼쪽 칸 윗판 (꼭대기)
  hs(-0.6, -0.188, OH);
  // ---- 가운데 칸: 아래 선반(0.248) · 가운데 선반(0.738, 왼쪽 반에 방석) ----
  hs(xB0, xB1, 0.248);
  hs(xB0, xB1, 0.738); pad(g, (xB0 + 0) / 2, 0.738, 0.188 - 0.03, D - 0.1);
  back(xB0, xB1, T, 0.248 - T);
  // ---- 지그재그 계단 (오른쪽 아래 → 왼쪽 위, 단 높이 17.8, 세로판은 디딤판 왼쪽 끝) ----
  hs(0.386, xC1, 0.204); pad(g, (0.386 + xC1) / 2, 0.204, xC1 - 0.386 - 0.03, D - 0.1);   // 디딤판 1 (19.6)
  vs(0.386, T, 0.382);
  hs(0.206, 0.386, 0.382); pad(g, (0.206 + 0.386) / 2, 0.382, 0.18 - 0.03, D - 0.1);     // 디딤판 2 (칸 사이 세로판이 다음 단)
  hs(0.0, 0.188, 0.56); pad(g, 0.094, 0.56, 0.188 - 0.03, D - 0.1);                      // 디딤판 3
  vs(0.0, 0.56, 0.738 - T);
  // ---- 오른쪽 위: 가드 7cm 달린 52 선반 (왼쪽 끝 아래 세로판이 받침) ----
  hs(0.06, xC1, 1.075);
  plank(g, xC1 - 0.06, 0.07, T, (0.06 + xC1) / 2, 1.075 + 0.035, D / 2 - T / 2, wd, 0.003);     // 앞 가드
  plank(g, xC1 - 0.06, 0.07, T, (0.06 + xC1) / 2, 1.075 + 0.035, -D / 2 + T / 2, wd, 0.003);    // 뒤 가드
  vs(0.06, 1.075, 1.075 + 0.07, T, D / 2 - T / 2); vs(0.06, 1.075, 1.075 + 0.07, T, -D / 2 + T / 2);
  // ---- 꼭대기 전망대 (가운데 · 오른쪽 칸 위, 가드 9cm) ----
  const xT0 = -0.285;
  hs(xT0, 0.6, OH, D + 0.01);
  plank(g, 0.6 - xT0, 0.09, T, (xT0 + 0.6) / 2, OH - T - 0.045, D / 2 - T / 2 + 0.005, wd, 0.003);    // 앞 가드
  plank(g, 0.6 - xT0, 0.09, T, (xT0 + 0.6) / 2, OH - T - 0.045, -D / 2 + T / 2 - 0.005, wd, 0.003);   // 뒤 가드
  plank(g, T, 0.09, D + 0.01, xT0 + T / 2, OH - T - 0.045, 0, wd, 0.003);
  plank(g, T, 0.09, D + 0.01, 0.6 - T / 2, OH - T - 0.045, 0, wd, 0.003);
  // 뒤판 (가운데 칸 선반 위 · 오른쪽 칸은 없음 — 사진처럼 뒤가 트여 있음)
  // 작은 상표 (오른쪽 위 가드)
  g.add(mesh(rbox(0.05, 0.012, 0.002, 0.001), M.color('#8c7a66', 0.6), 0.52, OH - 0.03, D / 2 + 0.004));
  return g;
}
const ORMI_NAV = {
  // 고양이 길: 오른쪽 앞 바닥 → 계단 1 · 2 · 3 → 가운데 선반 → 왼쪽 칸 Z 선반 둘 → 꼭대기(왼쪽) → 꼭대기(오른쪽) → 52 선반
  path: [
    [0.48, 0, 0.6],
    [0.484, 0.204, 0.0],
    [0.296, 0.382, 0.0],
    [0.094, 0.56, 0.0],
    [-0.094, 0.738, 0.0],
    [-0.3, 0.916, 0.0],
    [-0.488, 1.094, 0.0],
    [-0.1, OH, 0.0],
    [0.35, OH, 0.0],
    [0.32, 1.075, 0.0],
  ],
  boxes: [{ floor: [-0.394, 0, 0.6], inside: [-0.394, 0.4, -0.02] }],
  hides: [[0.0, 0.03, -0.02]],   // 가운데 칸 맨 아래(앞이 트인 낮은 칸)
  bounds: [-0.6, 0.6, -OD / 2, OD / 2],
};

// ---------- 커스텀B 월캣타워 (실제 치수: 폭 40 + 90 + 120 = 250, 깊이 46, 높이 179.8 cm) ----------
// 왼쪽 40: 칸 다섯(23.8 · 26 · 29.2 · 29.2 · 60.4) — 아래 둘은 흰 문 · 서랍, 위는 열린 칸에 펠트
// 가운데 90: 흰 숨숨집 상자를 계단처럼 쌓음(아치 문 · 발판 30×20)
// 오른쪽 120: 37.6 칸 세 줄 — 맨 윗칸 뒤판에 둥근 구멍, 오른쪽 위 흰 숨숨집, 지그재그 계단
export function buildCustomBModel() {
  const g = new THREE.Group();
  const D = 0.46, H = 1.798, wd = pine(), wh = white();
  const hs = (x0, x1, yTop, d = D, z = 0) => plank(g, x1 - x0, T, d, (x0 + x1) / 2, yTop - T / 2, z, wd, 0.003);
  const vs = (x, y0, y1, d = D, z = 0) => plank(g, T, y1 - y0, d, x, (y0 + y1) / 2, z, wd, 0.003);
  // ===== 왼쪽 기둥 40 (x -1.25 ~ -0.85): 위부터 해먹 칸 23.8 · 서랍 26 · 서랍 29.2 · 열린 칸 29.2 · 문 60.4 =====
  {
    const x0 = -1.25, x1 = -0.85, xi0 = x0 + T, xi1 = x1 - T, cx = (x0 + x1) / 2;
    vs(x0 + T / 2, 0, H); vs(x1 - T / 2, 0, H);
    plank(g, x1 - x0 - T * 2, H - T * 2, T, cx, H / 2, -D / 2 + T / 2, wd, 0.003);
    for (const y of [T, 0.64, 0.95, 1.26, 1.538, H]) hs(x0, x1, y);
    const fw = xi1 - xi0 - 0.004, fz = D / 2 - T / 2;
    // 문 (60.4) — 아래 가운데 발자국
    { const f = cutPanel(fw, 0.622 - T - 0.004, wh, [{ t: 'paw', x: 0, y: -0.2, r: 0.02 }]); f.position.set(cx, (T + 0.622) / 2, fz); g.add(f); }
    plank(g, 0.012, 0.09, 0.012, cx + 0.14, 0.38, D / 2 + 0.004, M.woodMid(), 0.003);   // 문 손잡이
    // 열린 칸 (29.2) 펠트
    pad(g, cx, 0.64, fw - 0.03, D - 0.1);
    // 서랍 둘 — 위 가운데 손가락 구멍
    for (const [y0, y1] of [[0.95, 1.242], [1.26, 1.52]]) { const f = cutPanel(fw, y1 - y0 - 0.006, wh, [{ t: 'notch', x: 0, y: (y1 - y0) / 2 - 0.035, r: 0.016 }]); f.position.set(cx, (y0 + y1) / 2, fz); g.add(f); }
    // 해먹 칸 (23.8): 투명 해먹
    hammock(g, cx, H - T, 0.02, 0.15);
  }
  // ===== 가운데 90 (x -0.85 ~ 0.05): 흰 상자를 계단처럼 =====
  {
    const x0 = -0.85, x1 = 0.05;
    vs(x1 - T / 2, 0, H);                                                                         // 가운데 · 오른쪽 사이 기둥
    hs(x0, x1, T); hs(x0, x1, H);
    whiteBox(g, x0, x1, T, 0.31, D, [{ t: 'square', x: -0.3, y: -0.12, w: 0.18, h: 0.17 }, { t: 'arch', x: 0.25, y: -0.135, w: 0.19, h: 0.24 }]);     // 1층: 네모 입구 · 아치
    whiteBox(g, x0, x1, 0.31, 0.60, D, [{ t: 'arch', x: 0.1, y: -0.13, w: 0.19, h: 0.24 }]);                                                      // 2층
    hs(x0 + 0.1, x0 + 0.4, 0.60, 0.2, D / 2 + 0.08); pad(g, x0 + 0.25, 0.60, 0.27, 0.17, '#d9d2c6', D / 2 + 0.08);                              // 튀어나온 발판 30 × 20
    whiteBox(g, x0, x1 - 0.2, 0.60, 0.90, D, [{ t: 'arch', x: -0.15, y: -0.13, w: 0.19, h: 0.24 }]);                                              // 3층 (70)
    hs(x1 - 0.35, x1 - 0.05, 0.90, 0.2, D / 2 + 0.08); pad(g, x1 - 0.2, 0.90, 0.27, 0.17, '#d9d2c6', D / 2 + 0.08);
    whiteBox(g, x0, x0 + 0.55, 0.90, 1.20, D, [{ t: 'arch', x: 0.12, y: -0.13, w: 0.18, h: 0.23 }, { t: 'paw', x: -0.17, y: -0.06, r: 0.016 }]);   // 4층 (55)
    hs(x0 + 0.55, x1, 1.20);                                                                      // 나무 선반 46 (계단 도착)
    pad(g, x0 + 0.55 + 0.17, 1.20, 0.3, D - 0.12);
    whiteBox(g, x0, x0 + 0.40, 1.20, 1.50, D, [{ t: 'paw', x: -0.1, y: -0.07, r: 0.018 }]);                                                       // 5층 (40) 막힌 앞판
    pad(g, x0 + 0.2, 1.50, 0.34, D - 0.1, '#cfc6b8');
    vs(x0 + 0.55, 1.20, 1.46, D - 0.02); hs(x0 + 0.55, x0 + 0.8, 1.46, D - 0.02);                // 26 단 (선반 위 작은 디딤)
    pad(g, x0 + 0.675, 1.46, 0.2, D - 0.14);
    hangToy(g, x0 + 0.68, H - T, 0.62);                                                           // 매달린 장난감
  }
  // ===== 오른쪽 120 (x 0.05 ~ 1.25): 37.6 칸 세 줄 =====
  {
    const x0 = 0.05, x1 = 1.25;
    const div = [0.059, 0.453, 0.847, 1.241];
    const cols = [0.256, 0.65, 1.044];
    for (const x of div) vs(x, 0, H);
    hs(x0, x1, T); hs(x0, x1, H);
    // 맨 윗칸 (33.8 · 45 · 33.8) 뒤판 둥근 구멍
    for (const [cx, y0] of [[cols[0], 1.442], [cols[1], 1.33], [cols[2], 1.442]]) {
      hs(cx - 0.188, cx + 0.188, y0);
      const bp = cutPanel(0.376, H - T - y0 - 0.002, wd, [{ t: 'circle', x: 0, y: 0.0, r: 0.1 }], T, 0);
      bp.position.set(cx, (y0 + H - T) / 2, -D / 2 + T / 2); g.add(bp);
    }
    // 1열: 아래 칸 29.2 · 흰 상자 29.4 (0.5~0.794, 아치 · 발자국) · 위는 트임
    hs(cols[0] - 0.188, cols[0] + 0.188, 0.31);
    whiteBox(g, 0.068, 0.444, 0.5, 0.794, D - 0.02, [{ t: 'arch', x: 0.09, y: -0.13, w: 0.17, h: 0.23 }, { t: 'paw', x: -0.11, y: -0.07, r: 0.015 }], { back: false });
    pad(g, cols[0], 0.794, 0.3, D - 0.12);
    pad(g, cols[0], T, 0.3, D - 0.1, '#e5d9c6');
    // 2열: 낮은 선반 16
    hs(cols[1] - 0.188, cols[1] + 0.188, 0.178);
    // 3열: 흰 숨숨집 33.8 (1.086~1.424, 아치 · 발자국) · 아래 열린 칸 펠트
    whiteBox(g, 0.856, 1.232, 1.086, 1.424, D - 0.02, [{ t: 'arch', x: 0.05, y: -0.135, w: 0.17, h: 0.24 }, { t: 'paw', x: -0.12, y: -0.08, r: 0.015 }], { back: false });
    hs(cols[2] - 0.188, cols[2] + 0.188, 0.73); pad(g, cols[2], 0.73, 0.3, D - 0.12);
    // 지그재그 계단: 3열 오른쪽 반(0.2) → 3열 왼쪽 반(0.38) → 2열 오른쪽(0.56) → 2열 왼쪽(0.74) → 1열 흰 상자 위(0.794)
    hs(1.044, 1.232, 0.2); pad(g, 1.138, 0.2, 0.16, D - 0.12); vs(1.044, 0.2, 0.38, D - 0.01);
    hs(0.856, 1.044, 0.38); pad(g, 0.95, 0.38, 0.16, D - 0.12);
    hs(0.65, 0.838, 0.56); pad(g, 0.744, 0.56, 0.16, D - 0.12); vs(0.65, 0.56, 0.74, D - 0.01);
    hs(0.462, 0.65, 0.74); pad(g, 0.556, 0.74, 0.16, D - 0.12);
  }
  return g;
}
const CUSTOMB_NAV = {
  path: [
    [1.14, 0, 0.7],
    [1.138, 0.2, 0.0],
    [0.95, 0.38, 0.0],
    [0.744, 0.56, 0.0],
    [0.556, 0.74, 0.0],
    [0.256, 0.794, 0.0],
    [-0.13, 1.20, 0.0],
    [-0.175, 1.46, 0.0],
    [-0.65, 1.50, 0.0],
    [-1.05, 1.26, 0.0],
  ],
  boxes: [
    { floor: [-0.2, 0, 0.7], inside: [-0.25, 0.05, -0.05] },
  ],
  hides: [[-0.3, 0.33, -0.05], [-0.6, 0.62, -0.05], [-0.52, 0.92, -0.05], [0.256, 0.52, -0.05], [1.044, 1.1, -0.05]],
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
  const hs = (x0, x1, yTop, d = D, z = 0) => plank(g, x1 - x0, T, d, (x0 + x1) / 2, yTop - T / 2, z, wd, 0.003);
  const vs = (x, y0, y1, d = D, z = 0) => plank(g, T, y1 - y0, d, x, (y0 + y1) / 2, z, wd, 0.003);
  // 왼쪽 몸체 80.6 (x -1.003 ~ -0.197) · 오른쪽 몸체 120 (x -0.197 ~ 1.003) — 둘이 나란히 붙어 세로판이 겹침
  const cA = -0.797, cB = -0.403, c1 = 0.009, c2 = 0.403, c3 = 0.797;
  for (const x of [-0.994, -0.6, -0.206, -0.188, 0.206, 0.6, 0.994]) vs(x, 0, H);
  hs(-1.003, -0.197, T); hs(-1.003, -0.197, H);
  hs(-0.197, 1.003, T); hs(-0.197, 1.003, H);
  // ---- 왼쪽: 수납장 69.4 · 33.8 칸 셋 ----
  for (const y of [0.73, 1.086, 1.442]) hs(-0.994, -0.206, y);
  // 수납장 문 둘 (77) + 세로 손잡이
  for (const s of [-1, 1]) {
    plank(g, 0.383, 0.694 - 0.006, T, -0.6 + s * 0.1965, T + 0.347, D / 2 - T / 2, wd, 0.003);
    plank(g, 0.016, 0.1, 0.014, -0.6 + s * 0.035, 0.42, D / 2 + 0.006, M.woodMid(), 0.004);
  }
  // 왼쪽 위 칸 뒤판: 고양이 얼굴 · 발자국 구멍
  { const bp = cutPanel(0.376, 0.338, wd, [{ t: 'cat', x: -0.07, y: 0.0, r: 0.07 }, { t: 'paw', x: 0.1, y: -0.07, r: 0.018 }], T, 0); bp.position.set(cA, 1.442 + 0.169, -D / 2 + T / 2); g.add(bp); }
  // 둘째 줄 둘째 칸: ㄱ자 단 (위 선반 가운데서 내려와 오른쪽 반 선반)
  vs(cB, 1.26, 1.442, D - 0.01); hs(cB, -0.206, 1.26, D - 0.01); pad(g, (cB - 0.206) / 2, 1.26, 0.16, D - 0.12);
  // ---- 오른쪽: 맨 윗줄 33.8 · 1열 1.07 선반 + ㄱ자 단 · 2열 1.07 · 3열 1.07 · 0.73 ----
  hs(-0.188, 0.994, 1.442);
  for (const cx of [c1, c2, c3]) hs(cx - 0.188, cx + 0.188, 1.07);
  hs(c1 - 0.188, c1 + 0.188, 0.54);
  hs(c3 - 0.188, c3 + 0.188, 0.73);
  // 지그재그 계단 (단 17.8 · 디딤판 18.8, 맨 아래 40 · 19.6): 3열 오른쪽 아래 → 1열 ㄱ자 단 → 1.07 선반
  hs(0.609, 0.985, 0.196); pad(g, 0.797, 0.196, 0.34, D - 0.12); vs(0.797, 0.196, 0.374, D - 0.01);
  hs(0.609, 0.797, 0.374); pad(g, 0.703, 0.374, 0.16, D - 0.12);
  hs(0.403, 0.591, 0.552); pad(g, 0.497, 0.552, 0.16, D - 0.12); vs(0.403, 0.552, 0.73, D - 0.01);
  hs(0.215, 0.403, 0.73); pad(g, 0.309, 0.73, 0.16, D - 0.12);
  hs(0.009, 0.197, 0.908); pad(g, 0.103, 0.908, 0.16, D - 0.12); vs(0.009, 0.908, 1.07, D - 0.01);
  // 아래 칸 둥근 방석 셋
  for (const [cx, col] of [[c1, '#e8d2cf'], [c2, '#efe3d2'], [c3, '#e4d9c8']]) g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 20), M.fabric(col), cx, T + 0.015, 0.02));
  // 책 꽂을 칸 (앞면 +z): x, y0(칸 바닥), w, h, d, front
  const front = D / 2 - 0.015;
  const slot = (x, y0, h = 0.33, w = 0.36) => ({ x, y0, w, h, d: 0.24, front });
  g.userData.bookSlots = [
    slot(cA, 0.73), slot(cB, 0.73), slot(cA, 1.086), slot(cB - 0.1, 1.086, 0.17, 0.17), slot(cB, 1.442),
    slot(c1, 1.442), slot(c2, 1.442), slot(c3, 1.442), slot(c2, 1.07), slot(c3, 1.07), slot(c3, 0.73), slot(c1, 0.54, 0.3),
  ];
  return g;
}
const JIPSA4_NAV = {
  path: [
    [0.8, 0, 0.62],
    [0.797, 0.196, 0.02],
    [0.703, 0.374, 0.0],
    [0.497, 0.552, 0.0],
    [0.309, 0.73, 0.0],
    [0.103, 0.908, 0.0],
    [0.009, 1.07, 0.0],
    [-0.3, 1.26, 0.0],
    [-0.5, 1.442, 0.0],
  ],
  boxes: [
    { floor: [0.403, 0, 0.62], inside: [0.403, 0.05, -0.03] },
    { floor: [0.009, 0, 0.62], inside: [0.009, 0.05, -0.03] },
  ],
  hides: [[-0.797, 1.46, -0.03], [-0.403, 1.46, -0.03]],
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


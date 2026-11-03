// 바닥 이동 도우미
// - 판 전체 크기 · 오두막 · 문 · 2층(다락, 나무 위 오두막, 루프탑) 위치
// - 장애물(상자 영역) 밖으로 밀어내기, 계단 · 사다리 오르내리기
// - 숲이 넓고 막힌 곳이 많아서 격자 길찾기(A*)로 길을 만든다
import * as THREE from 'three';

// 오두막 실내 (m)
export const CABIN = { minX: -16, maxX: 8, minZ: -10, maxZ: 10, H: 5.6 };
// 실내 + 숲 정원 + 바닷가 전체
export const WORLD = { minX: -31, maxX: 63, minZ: -33, maxZ: 36 };   // 둘레길을 내며 사방으로 넓힘 (땅은 forest.js G0)
// 정원으로 나가는 문 (동쪽 벽 x = 8)
export const DOOR = { x: 8, z0: -0.9, z1: 0.9, h: 2.4 };
// 현관 (남쪽 벽) — 손님이 처음 서는 자리. 밖으로 나가 집 둘레를 돌 수 있다
export const FRONT = { x0: -2.4, x1: -1.1, h: 2.3 };
// 바다: 이 z 보다 남쪽은 물
export const SEA_Z = 30.5;

// 2층: 다락(1), 나무 위 오두막(2), 루프탑(3). ramp = 계단 (axis 방향으로 bottom 쪽이 바닥, top 쪽이 2층)
export const PLATFORMS = [
  {
    id: 1, name: '다락', y: 2.7,
    rect: { minX: -15.9, maxX: -1.0, minZ: -9.9, maxZ: -5.3 },
    ramp: { minX: -15.9, maxX: -14.9, minZ: -5.3, maxZ: 1.0, axis: 'z', bottom: 1.0, top: -5.3 },
    bottomPt: new THREE.Vector3(-15.4, 0, 1.5), topPt: new THREE.Vector3(-15.4, 2.7, -5.8),
  },
  {
    id: 2, name: '나무 위 오두막', y: 2.4,
    rect: { minX: 42.4, maxX: 45.6, minZ: -17.6, maxZ: -14.4 },
    ramp: { minX: 43.55, maxX: 44.45, minZ: -14.4, maxZ: -11.6, axis: 'z', bottom: -11.6, top: -14.4 },
    bottomPt: new THREE.Vector3(44, 0, -11.05), topPt: new THREE.Vector3(44, 2.4, -14.9),
  },
  {
    id: 3, name: '루프탑', y: 5.75,
    // 남쪽으로 1.3m 튀어나온 테라스까지 (현관 위 처마)
    rect: { minX: -16, maxX: 8, minZ: -10, maxZ: 11.3 },
    ramp: { minX: -15.6, maxX: -7.6, minZ: 10.35, maxZ: 11.25, axis: 'x', bottom: -15.6, top: -7.6 },
    bottomPt: new THREE.Vector3(-15.85, 0, 10.8), topPt: new THREE.Vector3(-7.1, 5.75, 10.8),
  },
];
export const platformById = (id) => PLATFORMS.find((p) => p.id === id) || null;

const inRect = (r, x, z, m = 0) => x > r.minX - m && x < r.maxX + m && z > r.minZ - m && z < r.maxZ + m;
export const inCabin = (p, m = 0.1) => p.x > CABIN.minX - m && p.x < CABIN.maxX + m && p.z > CABIN.minZ - m && p.z < CABIN.maxZ + m;
export const isOutdoor = (p) => !inCabin(p) || p.y > 5;
export const isIndoor = (p) => !isOutdoor(p);

function rampT(pl, p) {
  const R = pl.ramp;
  const v = R.axis === 'x' ? p.x : p.z;
  return THREE.MathUtils.clamp((R.bottom - v) / (R.bottom - R.top), 0, 1);
}
export function rampY(pl, p) { return pl.y * rampT(pl, p); }

// 계단 위에 있는가 (계단 아래를 지나가거나 계단 위 다른 층에 있는 경우는 아님)
export function rampAt(p) {
  for (const pl of PLATFORMS) {
    if (!inRect(pl.ramp, p.x, p.z)) continue;
    const y = rampY(pl, p);
    if (p.y > y - 0.6 && p.y < y + 0.6) return pl;
  }
  return null;
}

// 0 = 바닥, 1 = 다락, 2 = 나무 위 오두막, 3 = 루프탑
export function levelOf(p) {
  const r = rampAt(p);
  if (r && p.y > 0.05) return p.y > r.y / 2 ? r.id : 0;
  let best = 0, by = -1;
  for (const pl of PLATFORMS) {
    if (inRect(pl.rect, p.x, p.z, 0.3) && p.y > pl.y - 0.6 && pl.y > by) { best = pl.id; by = pl.y; }
  }
  return best;
}
export const levelY = (lv) => (lv ? platformById(lv).y : 0);

// 장애물 밖으로 밀어내고, 서 있는 바닥 높이(y)를 맞춤
// flat: 고양이처럼 높이를 따로 다루는 것 (바닥 장애물만 봄)
export function pushOut(room, p, r, flat = false) {
  if (!flat) {
    const pl = rampAt(p);
    if (pl) {
      const R = pl.ramp;
      if (R.axis === 'x') p.z = THREE.MathUtils.clamp(p.z, R.minZ + 0.18, R.maxZ - 0.18);
      else p.x = THREE.MathUtils.clamp(p.x, R.minX + 0.18, R.maxX - 0.18);
      p.y = rampY(pl, p);
      return p;
    }
  }
  const lv = flat ? 0 : levelOf(p);
  if (lv) {
    const pl = platformById(lv);
    const R = pl.rect, M = pl.ramp;
    // 계단 쪽 가장자리는 계단으로 이어지도록 열어 둠
    if (M.axis === 'z') {
      const nearRamp = p.x > M.minX + 0.1 && p.x < M.maxX - 0.1;
      p.x = THREE.MathUtils.clamp(p.x, R.minX + r, R.maxX - r);
      const lo = nearRamp && M.top <= R.minZ + 0.01 ? -Infinity : R.minZ + r;
      const hi = nearRamp && M.top >= R.maxZ - 0.01 ? Infinity : R.maxZ - r;
      p.z = THREE.MathUtils.clamp(p.z, lo, hi);
    } else {
      const nearRamp = p.z > M.minZ + 0.1 && p.z < M.maxZ - 0.1;
      p.z = THREE.MathUtils.clamp(p.z, R.minZ + r, R.maxZ - r);
      const lo = nearRamp && M.top <= R.minX + 0.01 ? -Infinity : R.minX + r;
      const hi = nearRamp && M.top >= R.maxX - 0.01 ? Infinity : R.maxX - r;
      p.x = THREE.MathUtils.clamp(p.x, lo, hi);
    }
    p.y = pl.y;
  } else {
    p.x = THREE.MathUtils.clamp(p.x, WORLD.minX + r, WORLD.maxX - r);
    p.z = THREE.MathUtils.clamp(p.z, WORLD.minZ + r, WORLD.maxZ - r);
    if (!flat) p.y = 0;
  }
  const list = room.obBuckets ? (room.obBuckets.get(bucketKey(p.x, p.z)) || []) : room.obstacles;
  for (const o of list) {
    if ((o.lv || 0) !== lv) continue;
    const x0 = o.minX - r, x1 = o.maxX + r, z0 = o.minZ - r, z1 = o.maxZ + r;
    if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) {
      const dl = p.x - x0, dr = x1 - p.x, dt = p.z - z0, db = z1 - p.z;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) p.x = x0; else if (m === dr) p.x = x1; else if (m === dt) p.z = z0; else p.z = z1;
    }
  }
  return p;
}

export function insideObstacle(room, p, r = 0, lv = 0) {
  const list = room.obBuckets ? (room.obBuckets.get(bucketKey(p.x, p.z)) || []) : room.obstacles;
  return list.some((o) => (o.lv || 0) === lv && p.x > o.minX - r && p.x < o.maxX + r && p.z > o.minZ - r && p.z < o.maxZ + r);
}

// 장애물을 2m 칸에 나눠 담아 두면 밀어내기 검사가 가벼워짐
const BK = 2;
const bucketKey = (x, z) => Math.floor(x / BK) * 10000 + Math.floor(z / BK);
function buildBuckets(room) {
  const m = new Map();
  for (const o of room.obstacles) {
    const pad = 0.4;
    const i0 = Math.floor((Math.max(o.minX, WORLD.minX - 2) - pad) / BK), i1 = Math.floor((Math.min(o.maxX, WORLD.maxX + 2) + pad) / BK);
    const j0 = Math.floor((Math.max(o.minZ, WORLD.minZ - 2) - pad) / BK), j1 = Math.floor((Math.min(o.maxZ, WORLD.maxZ + 2) + pad) / BK);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = i * 10000 + j;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(o);
    }
  }
  room.obBuckets = m;
}

// ---------------- 격자 길찾기 ----------------
const CELL = 0.25;
const CLEAR = 0.24; // 몸 반지름

class Grid {
  constructor(bounds, lv) {
    this.lv = lv;
    this.x0 = bounds.minX; this.z0 = bounds.minZ;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / CELL);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / CELL);
    this.block = new Uint8Array(this.w * this.h);
    this.y = levelY(lv);
  }
  cx(x) { return Math.floor((x - this.x0) / CELL); }
  cz(z) { return Math.floor((z - this.z0) / CELL); }
  wx(i) { return this.x0 + (i + 0.5) * CELL; }
  wz(j) { return this.z0 + (j + 0.5) * CELL; }
  ok(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && !this.block[j * this.w + i]; }
  fillRect(minX, maxX, minZ, maxZ) {
    const i0 = Math.max(0, this.cx(minX)), i1 = Math.min(this.w - 1, this.cx(maxX));
    const j0 = Math.max(0, this.cz(minZ)), j1 = Math.min(this.h - 1, this.cz(maxZ));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = this.wx(i), z = this.wz(j);
      if (x > minX && x < maxX && z > minZ && z < maxZ) this.block[j * this.w + i] = 1;
    }
  }
  nearestFree(i, j) {
    if (this.ok(i, j)) return [i, j];
    for (let r = 1; r < 40; r++) {
      let best = null, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (this.ok(i + di, j + dj)) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = [i + di, j + dj]; } }
      }
      if (best) return best;
    }
    return null;
  }
  clear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / (CELL * 0.5)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (!this.ok(this.cx(ax + (bx - ax) * t), this.cz(az + (bz - az) * t))) return false;
    }
    return true;
  }
  path(a, b) {
    const s = this.nearestFree(this.cx(a.x), this.cz(a.z));
    const g = this.nearestFree(this.cx(b.x), this.cz(b.z));
    if (!s || !g) return [new THREE.Vector3(b.x, this.y, b.z)];
    const W = this.w, N = W * this.h;
    const si = s[1] * W + s[0], gi = g[1] * W + g[0];
    const gs = this.gs || (this.gs = new Float32Array(N));
    const from = this.from || (this.from = new Int32Array(N));
    const stamp = this.stamp || (this.stamp = new Uint32Array(N));
    const closed = this.closed || (this.closed = new Uint32Array(N));
    this.run = (this.run || 0) + 1;
    const run = this.run;
    const heap = [];
    const hf = (i) => { const x = i % W, z = (i / W) | 0; const dx = Math.abs(x - g[0]), dz = Math.abs(z - g[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const push = (f, i) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = k * 2 + 1, r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
        }
      }
      return top;
    };
    stamp[si] = run; gs[si] = 0; from[si] = -1;
    push(hf(si), si);
    let found = false, iter = 0;
    while (heap.length && iter++ < 120000) {
      const [, cur] = pop();
      if (closed[cur] === run) continue;
      closed[cur] = run;
      if (cur === gi) { found = true; break; }
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!this.ok(nx, nz)) continue;
        if (dx && dz && (!this.ok(cx + dx, cz) || !this.ok(cx, cz + dz))) continue;
        const ni = nz * W + nx;
        if (closed[ni] === run) continue;
        const ng = gs[cur] + (dx && dz ? 1.414 : 1);
        if (stamp[ni] !== run || ng < gs[ni]) {
          stamp[ni] = run; gs[ni] = ng; from[ni] = cur;
          push(ng + hf(ni), ni);
        }
      }
    }
    if (!found) return [new THREE.Vector3(b.x, this.y, b.z)];
    const cells = [];
    for (let c = gi; c !== -1; c = from[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => [this.wx(c % W), this.wz((c / W) | 0)]);
    const goalFree = this.ok(this.cx(b.x), this.cz(b.z));
    pts[pts.length - 1] = goalFree ? [b.x, b.z] : pts[pts.length - 1];
    const out = [];
    let ax = a.x, az = a.z, k = 0;
    while (k < pts.length - 1) {
      let far = k + 1;
      for (let m = pts.length - 1; m > k + 1; m--) { if (this.clear(ax, az, pts[m][0], pts[m][1])) { far = m; break; } }
      out.push(new THREE.Vector3(pts[far][0], this.y, pts[far][1]));
      ax = pts[far][0]; az = pts[far][1];
      k = far;
    }
    if (!out.length) out.push(new THREE.Vector3(pts[0][0], this.y, pts[0][1]));
    return out;
  }
}

export function buildNav(room) {
  buildBuckets(room);
  const grids = new Map();
  const g0 = new Grid(WORLD, 0);
  for (const o of room.obstacles) if (!(o.lv || 0)) g0.fillRect(o.minX - CLEAR, o.maxX + CLEAR, o.minZ - CLEAR, o.maxZ + CLEAR);
  for (const pl of PLATFORMS) {
    const R = pl.ramp;
    // 계단은 바닥 길에서 막힘 (바닥 쪽 끝만 열어 둠)
    if (R.axis === 'z') g0.fillRect(R.minX - CLEAR, R.maxX + CLEAR, Math.min(R.top, R.bottom) - (R.top < R.bottom ? CLEAR : -0.05), Math.max(R.top, R.bottom) + (R.top < R.bottom ? -0.05 : CLEAR));
    else g0.fillRect(Math.min(R.top, R.bottom) - (R.top < R.bottom ? CLEAR : -0.05), Math.max(R.top, R.bottom) + (R.top < R.bottom ? -0.05 : CLEAR), R.minZ - CLEAR, R.maxZ + CLEAR);
  }
  g0.fillRect(-1e3, WORLD.minX + CLEAR, -1e3, 1e3); g0.fillRect(WORLD.maxX - CLEAR, 1e3, -1e3, 1e3);
  g0.fillRect(-1e3, 1e3, -1e3, WORLD.minZ + CLEAR); g0.fillRect(-1e3, 1e3, WORLD.maxZ - CLEAR, 1e3);
  grids.set(0, g0);
  for (const pl of PLATFORMS) {
    const R = pl.rect;
    const g = new Grid({ minX: R.minX - 0.5, maxX: R.maxX + 0.5, minZ: R.minZ - 0.5, maxZ: R.maxZ + 0.5 }, pl.id);
    g.fillRect(-1e3, R.minX + CLEAR, -1e3, 1e3); g.fillRect(R.maxX - CLEAR, 1e3, -1e3, 1e3);
    g.fillRect(-1e3, 1e3, -1e3, R.minZ + CLEAR); g.fillRect(-1e3, 1e3, R.maxZ - CLEAR, 1e3);
    for (const o of room.obstacles) if (o.lv === pl.id) g.fillRect(o.minX - CLEAR, o.maxX + CLEAR, o.minZ - CLEAR, o.maxZ + CLEAR);
    grids.set(pl.id, g);
  }
  room.grids = grids;
  return grids;
}

function bottomOut(pl) {
  const R = pl.ramp, b = pl.bottomPt;
  const d = Math.sign(R.bottom - R.top) * 0.6;
  return R.axis === 'x' ? new THREE.Vector3(b.x + d, 0, b.z) : new THREE.Vector3(b.x, 0, b.z + d);
}

// from → to 길 (지나갈 점 목록, 마지막이 도착점). 층이 다르면 계단을 거쳐 감
export function findPath(room, from, to) {
  const grids = room.grids;
  if (!grids) return [to.clone()];
  const out = [];
  let cur = from.clone();
  let lvA = levelOf(from);
  const lvB = levelOf(to);
  const onRamp = rampAt(from);
  if (onRamp && from.y > 0.05 && from.y < onRamp.y - 0.05) {
    const up = lvB === onRamp.id;
    const end = up ? onRamp.topPt : onRamp.bottomPt;
    out.push(end.clone());
    cur = end.clone();
    lvA = up ? onRamp.id : 0;
  }
  if (lvA !== lvB) {
    if (lvA) {
      const pl = platformById(lvA);
      // 계단을 다 내려오면 계단 방향으로 한 걸음 더 나간 뒤 길을 찾음 (계단 모서리를 비스듬히 가로지르지 않게)
      const out1 = bottomOut(pl);
      out.push(...grids.get(lvA).path(cur, pl.topPt), pl.bottomPt.clone(), out1);
      cur = out1.clone();
    }
    if (lvB) {
      const pl = platformById(lvB);
      out.push(...grids.get(0).path(cur, pl.bottomPt), pl.topPt.clone());
      cur = pl.topPt.clone();
    }
  }
  out.push(...grids.get(lvB).path(cur, to));
  return out;
}

// 고양이용: 바닥에서 빈 곳 아무 데나
// where: 'in' | 'out' | undefined(아무 곳)
export function randomFloorPoint(room, r = 0.2, where) {
  const out = where === 'out' || (!where && Math.random() < 0.45);
  const g = room.grids?.get(0);
  for (let i = 0; i < 80; i++) {
    let p;
    if (out) {
      p = new THREE.Vector3(THREE.MathUtils.lerp(CABIN.maxX + 1, 40, Math.random()), 0, THREE.MathUtils.lerp(-20, 24, Math.random()));
    } else {
      p = new THREE.Vector3(THREE.MathUtils.lerp(CABIN.minX + 0.6, CABIN.maxX - 0.6, Math.random()), 0, THREE.MathUtils.lerp(CABIN.minZ + 0.6, CABIN.maxZ - 0.6, Math.random()));
    }
    if (g ? g.ok(g.cx(p.x), g.cz(p.z)) && !insideObstacle(room, p, r + 0.1) : !insideObstacle(room, p, r + 0.1)) return p;
  }
  return out ? new THREE.Vector3(CABIN.maxX + 1.5, 0, 0) : new THREE.Vector3(CABIN.maxX - 1.5, 0, 0);
}

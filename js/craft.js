// 목공방 「나무 다듬기」 — 작업 테이블 자리에 앉아 내가 직접 톱질 · 대패질 · 끌질 · 못질
// - 누를 때마다 한 번 (박자 막대가 초록 칸에 있을 때 누르면 「좋아요!」 두 칸)
// - 테이블 위 나무가 조금씩 바뀌고, 다 하면 작품 하나 완성 → 이 브라우저의 「내 목공 작품」에만 남음
// - 다른 손님에게는 도구를 고를 때 · 내려놓을 때만 'em' 한 건 (그 손님 화면에선 내 팔이 스스로 되풀이). 한 번 한 번은 보내지 않음
import * as THREE from 'three';
import { M, mesh, rbox } from './kit.js';

export const CRAFTS = [
  { id: 'saw', ico: '🪚', name: '톱질', job: '판자 자르기', done: '판자 한 장', goal: 24, verb: '쓱싹' },
  { id: 'plane', ico: '🪵', name: '대패질', job: '각목 매끈하게', done: '매끈한 각목', goal: 20, verb: '스윽' },
  { id: 'chisel', ico: '🔨', name: '끌질', job: '장부 구멍 파기', done: '장부 구멍', goal: 18, verb: '똑딱' },
  { id: 'nail', ico: '📌', name: '못질', job: '못 다섯 개 박기', done: '작은 나무 상자', goal: 15, verb: '탕탕' },
];
const KEY = 'mkhzbook.crafts';

export class Craft {
  constructor(scene, sound) {
    this.scene = scene; this.sound = sound;
    this.on = false; this.kind = null; this.seat = null;
    this.points = 0; this.combo = 0; this.best = 0; this.t = 0; this.last = 0;
    this.piece = null;
    try { this.made = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { this.made = {}; }
  }
  get def() { return CRAFTS.find((c) => c.id === this.kind) || CRAFTS[0]; }
  // 박자 막대 (0~1 을 오가는 바늘, 가운데 초록 칸이 좋은 때)
  needle() { const u = (this.t * 0.9) % 2; return u < 1 ? u : 2 - u; }
  inZone() { return Math.abs(this.needle() - 0.5) < 0.13; }

  start(seat, kind) {
    this.seat = seat;
    this.on = true;
    this.setKind(kind || this.kind || 'saw');
  }
  setKind(kind) {
    this.kind = kind;
    this.cooling = false;
    this.points = 0; this.combo = 0;
    this.buildPiece();
  }
  stop() {
    this.on = false;
    this.clearPiece();
    this.seat = null;
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.made)); } catch { /* 무시 */ } }
  madeLine() {
    const parts = CRAFTS.filter((c) => this.made[c.id]).map((c) => `${c.done} ${this.made[c.id]}`);
    return parts.length ? `내 목공 작품: ${parts.join(' · ')}` : '아직 완성한 작품이 없어요. 다 하면 여기에 쌓여요';
  }

  // 한 번 하기 → { good, done }
  hit() {
    if (!this.on || this.cooling) return null;   // 완성 뒤 새 나무가 올라올 때까지는 쉼
    const now = performance.now();
    if (now - this.last < 260) return null;   // 너무 빨리 연달아 누르면 한 번으로
    this.last = now;
    const good = this.inZone();
    this.combo = good ? this.combo + 1 : 0;
    this.best = Math.max(this.best, this.combo);
    this.points = Math.min(this.def.goal, this.points + (good ? 2 : 1));
    this.sound?.wood(this.kind, good ? 1.1 : 0.85);
    this.updatePiece(true);
    this.piece?.g.traverse((o) => { o.userData.noHit = true; });
    if (this.points >= this.def.goal) {
      this.made[this.kind] = (this.made[this.kind] || 0) + 1;
      this.save();
      const def = this.def;
      this.cooling = true;
      setTimeout(() => { this.cooling = false; if (this.on && this.kind === def.id) { this.points = 0; this.buildPiece(); } }, 1600);
      return { good, done: def };
    }
    return { good, done: null };
  }

  // ---------- 테이블 위 나무 ----------
  clearPiece() {
    if (!this.piece) return;
    this.scene.remove(this.piece.g);
    this.piece.g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    this.piece = null;
  }
  buildPiece() {
    this.clearPiece();
    if (!this.seat) return;
    const s = this.seat, fwd = new THREE.Vector3(Math.sin(s.rotY), 0, Math.cos(s.rotY));
    const g = new THREE.Group();
    g.position.copy(s.pos).setY(0.9).addScaledVector(fwd, 0.46);
    g.rotation.y = s.rotY;
    g.scale.setScalar(1.25);
    const P = { g, k: this.kind, bits: [] };
    const rough = M.color('#b48c5e', 0.9), light = M.color('#e7c99a', 0.8), dark = M.color('#5b4330', 0.9);
    if (this.kind === 'saw') {
      // 가로로 놓인 판자, 오른쪽 끝을 잘라 냄. 톱 자국이 앞에서 뒤로 깊어짐
      P.board = mesh(rbox(0.5, 0.03, 0.16, 0.004), light, 0, 0.015, 0); g.add(P.board);
      P.line = mesh(new THREE.BoxGeometry(0.002, 0.001, 0.16), M.color('#3a2c22', 1), 0.12, 0.031, 0, { cast: false }); g.add(P.line);
      P.cut = mesh(new THREE.BoxGeometry(0.006, 0.032, 1), dark, 0.12, 0.016, 0.08, { cast: false }); P.cut.scale.z = 0.001; g.add(P.cut);
      P.dust = mesh(new THREE.ConeGeometry(0.03, 0.012, 10), M.color('#e9d3ad', 1), 0.12, 0.006, 0.13, { cast: false }); P.dust.scale.setScalar(0.01); g.add(P.dust);
    } else if (this.kind === 'plane') {
      P.mat = rough.clone();
      P.block = mesh(rbox(0.44, 0.06, 0.08, 0.004), P.mat, 0, 0.03, 0); g.add(P.block);
    } else if (this.kind === 'chisel') {
      P.block = mesh(rbox(0.3, 0.07, 0.12, 0.004), light, 0, 0.035, 0); g.add(P.block);
      P.outline = mesh(new THREE.BoxGeometry(0.1, 0.001, 0.05), M.color('#3a2c22', 1), 0, 0.0705, 0, { cast: false }); g.add(P.outline);
      P.hole = mesh(new THREE.BoxGeometry(0.1, 1, 0.05), dark, 0, 0.07, 0, { cast: false }); P.hole.scale.y = 0.001; g.add(P.hole);
    } else {
      // 판자 두 장을 ㄱ자로 맞대고 못 다섯 개
      g.add(mesh(rbox(0.4, 0.025, 0.14, 0.003), light, 0, 0.0125, 0));
      g.add(mesh(rbox(0.4, 0.1, 0.025, 0.003), M.color('#dcb886', 0.85), 0, 0.075, -0.055));
      P.nails = [];
      for (let i = 0; i < 5; i++) {
        const n = new THREE.Group();
        n.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6), M.color('#9aa0a6', 0.3, { metalness: 0.8 }), 0, 0.025, 0, { cast: false }));
        n.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.003, 10), M.color('#8a9096', 0.3, { metalness: 0.8 }), 0, 0.05, 0, { cast: false }));
        n.position.set(-0.16 + i * 0.08, 0.126, -0.055);
        g.add(n); P.nails.push(n);
      }
    }
    this.scene.add(g);
    this.piece = P;
    this.updatePiece(false);
    g.traverse((o) => { o.userData.noHit = true; });
  }
  updatePiece(hitNow) {
    const P = this.piece;
    if (!P) return;
    const u = this.points / this.def.goal;
    if (P.k === 'saw') {
      P.cut.scale.z = Math.max(0.001, 0.16 * u);
      P.cut.position.z = 0.08 - 0.08 * u;
      P.dust.scale.setScalar(Math.max(0.01, u));
      if (u >= 1) { P.off = mesh(rbox(0.13, 0.03, 0.16, 0.004), M.color('#e7c99a', 0.8), 0.19, 0.015, 0); P.g.add(P.off); P.board.scale.x = 0.75; P.board.position.x = -0.06; P.offT = 0; }
    } else if (P.k === 'plane') {
      P.mat.color.lerpColors(new THREE.Color('#b48c5e'), new THREE.Color('#f0d8ac'), u);
      P.block.scale.y = 1 - u * 0.15; P.block.position.y = 0.03 * P.block.scale.y;
      if (hitNow && P.bits.length < 16) {
        const c = mesh(new THREE.TorusGeometry(0.018 + Math.random() * 0.012, 0.004, 4, 10, Math.PI * 1.6), M.color('#f2dcb2', 0.9), (Math.random() - 0.5) * 0.5, 0.005, 0.09 + Math.random() * 0.08, { cast: false });
        c.rotation.set(Math.random() * 3, Math.random() * 3, 0); P.g.add(c); P.bits.push(c);
      }
    } else if (P.k === 'chisel') {
      P.hole.scale.y = Math.max(0.001, 0.045 * u);
      P.hole.position.y = 0.0705 - P.hole.scale.y / 2;
      if (hitNow && P.bits.length < 12) {
        const c = mesh(new THREE.BoxGeometry(0.012, 0.004, 0.008), M.color('#e9cf9f', 0.9), (Math.random() - 0.5) * 0.24, 0.074, (Math.random() - 0.5) * 0.1, { cast: false });
        c.rotation.y = Math.random() * 3; P.g.add(c); P.bits.push(c);
      }
    } else {
      const per = this.def.goal / 5;
      P.nails.forEach((n, i) => {
        const k = Math.max(0, Math.min(1, (this.points - i * per) / per));
        n.position.y = 0.126 - k * 0.048;
        n.visible = this.points >= i * per - 0.01 || i === 0;
      });
    }
  }
  update(dt) {
    this.t += dt;
    const P = this.piece;
    if (P && P.off) { P.offT += dt; P.off.position.x = 0.19 + P.offT * 0.15; P.off.position.y = Math.max(-0.05, 0.015 - P.offT * P.offT * 2); P.off.rotation.z = -P.offT * 1.5; }
  }
  // 카메라가 볼 곳 (작업물)
  focus() { return this.piece ? this.piece.g.getWorldPosition(new THREE.Vector3()) : null; }
}

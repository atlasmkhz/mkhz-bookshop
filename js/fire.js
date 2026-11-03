// 불멍 · 장작 넣기 (캠핑장 모닥불 · 루프탑 화로 · 바닷가 모닥불)
// - 장작더미나 불을 누르면 장작 하나가 포물선을 그리며 불에 들어가고 불길이 확 일어납니다.
// - 장작 하나는 2분 30초쯤 타고, 여러 개 넣으면 더 크게 오래 탑니다. 밤엔 장작이 없어도 은은하게 탑니다.
// - 다른 손님에게는 'log' 메시지 하나만 갑니다(누를 때만, 2.5초에 한 번까지, 불 가까이 손님이 있을 때만).
//   불 세기를 계속 맞추는 메시지는 없습니다.
import * as THREE from 'three';
import { LOG_FUEL, FUEL_MAX } from './cabin.js';

const RESTOCK = 40;   // 장작더미가 한 개씩 다시 채워지는 시간(초) — 내 화면에서만

export class Fires {
  constructor(scene, room, fx, sound) {
    this.scene = scene; this.room = room; this.fx = fx; this.sound = sound;
    this.list = room.fires || [];
    this.flying = [];
    this.gaze = null;          // 불멍 중인 불
    this.gazeT = 0;
  }
  find(id) { return this.list.find((f) => f.id === id) || null; }

  // 가장 가까운 불 (같은 층, r 안)
  nearest(pos, r = 3.2) {
    let best = null, bd = r;
    for (const f of this.list) {
      const w = f.world();
      if (Math.abs(w.y - pos.y) > 1.2) continue;
      const d = Math.hypot(w.x - pos.x, w.z - pos.z);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  // 장작 하나 넣기. from: 던지는 사람 위치(없으면 더미에서)
  toss(id, local = true) {
    const f = this.find(id);
    if (!f) return false;
    const pile = f.pile;
    const start = pile ? pile.top() : f.world().add(new THREE.Vector3(0.8, 0.4, 0));
    if (pile) {
      const vis = pile.logs.filter((l) => l.visible);
      if (vis.length > 3) vis[vis.length - 1].visible = false;
      pile.restock = RESTOCK;
    }
    const end = f.world().add(new THREE.Vector3(0, 0.45, 0));
    const geo = new THREE.CylinderGeometry(0.07, 0.075, 0.48, 9).rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ color: '#6e4e36', roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: '#d9b98c' }), new THREE.MeshStandardMaterial({ color: '#d9b98c' })]);
    m.castShadow = true;
    m.userData.noHit = true;
    m.position.copy(start);
    this.scene.add(m);
    this.flying.push({ m, f, start, end, t: 0, dur: 0.75, spin: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3), local });
    this.sound.whoosh?.();
    return true;
  }

  land(fl) {
    const f = fl.f;
    f.fuel = Math.min(FUEL_MAX, f.fuel + LOG_FUEL);
    f.flare = 1;
    this.scene.remove(fl.m);
    fl.m.geometry.dispose();
    this.sound.logIn?.(fl.local ? 1 : 0.6);
  }

  update(dt) {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const fl = this.flying[i];
      fl.t += dt / fl.dur;
      const t = Math.min(1, fl.t);
      fl.m.position.lerpVectors(fl.start, fl.end, t);
      fl.m.position.y += Math.sin(t * Math.PI) * 0.85;
      fl.m.rotation.x += fl.spin * dt;
      fl.m.rotation.y += fl.spin * 0.4 * dt;
      if (fl.t >= 1) { this.land(fl); this.flying.splice(i, 1); }
    }
    // 장작더미 다시 채우기
    for (const f of this.list) {
      const p = f.pile;
      if (!p || p.restock <= 0) continue;
      p.restock -= dt;
      if (p.restock <= 0) { const hid = p.logs.find((l) => !l.visible); if (hid) { hid.visible = true; p.restock = RESTOCK; } }
    }
    if (this.gaze) this.gazeT += dt;
  }

  // 가까운 불이 얼마나 크게 들리는지 (0~1)
  loudness(pos) {
    let v = 0;
    for (const f of this.list) {
      const w = f.world();
      const d = Math.hypot(w.x - pos.x, w.z - pos.z) + Math.abs(w.y - pos.y) * 2;
      const lv = f.id === 'hearth' ? Math.min(1, f.fuel + f.flare) : Math.min(1, f.level);
      v = Math.max(v, Math.max(0, 1 - d / 9) * lv);
    }
    return v;
  }
}

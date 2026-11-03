// 떠오르는 하트 · zzz · 글자 효과
import * as THREE from 'three';
import { textSprite } from './kit.js';

function heartTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ff7b8a';
  g.beginPath();
  g.moveTo(32, 54);
  g.bezierCurveTo(4, 36, 6, 10, 22, 10);
  g.bezierCurveTo(28, 10, 32, 15, 32, 20);
  g.bezierCurveTo(32, 15, 36, 10, 42, 10);
  g.bezierCurveTo(58, 10, 60, 36, 32, 54);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath(); g.ellipse(22, 22, 5, 3.5, -0.6, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.heartMat = new THREE.SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false });
  }
  hearts(pos, n = 3) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.heartMat.clone());
      const sz = 0.12 + Math.random() * 0.06;
      s.scale.set(sz, sz, 1);
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.1, (Math.random() - 0.5) * 0.25));
      s.renderOrder = 20;
      this.scene.add(s);
      this.items.push({ o: s, life: 1.6 + Math.random() * 0.5, age: -i * 0.18, vy: 0.45 + Math.random() * 0.2, wob: Math.random() * 6, base: sz });
    }
  }
  zzz(pos) {
    const s = textSprite('z', { height: 0.13, bg: 'rgba(0,0,0,0)', color: '#8aa0c8', font: '700 52px "Jua", sans-serif' });
    s.position.copy(pos).add(new THREE.Vector3(0.08, 0.12, 0));
    this.scene.add(s);
    this.items.push({ o: s, life: 2.2, age: 0, vy: 0.18, wob: Math.random() * 6, base: 0.13, drift: 0.08, dispose: true });
  }
  text(pos, str, color = '#c66b3d') {
    const s = textSprite(str, { height: 0.16, color, border: 'rgba(198,107,61,0.25)' });
    s.position.copy(pos).add(new THREE.Vector3(0, 0.25, 0));
    this.scene.add(s);
    this.items.push({ o: s, life: 1.6, age: 0, vy: 0.2, wob: 0, base: 0.16, dispose: true });
  }
  // 책이 떨어짐 (고양이 돌발행동)
  drop(pos) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.25), new THREE.MeshStandardMaterial({ color: ['#7a3b2a', '#1f2c4d', '#1f6f6b', '#5f6b2e'][Math.floor(Math.random() * 4)], roughness: 0.8 }));
    m.position.copy(pos).add(new THREE.Vector3(0, 0.8, 0));
    m.castShadow = true;
    m.userData.noHit = true;
    this.scene.add(m);
    this.items.push({ o: m, life: 7, age: 0, vy: -0.1, wob: 0, base: 1, fall: true, floorY: pos.y + 0.02, spin: Math.random() * 6 });
  }
  // 먼지 뭉게 (우다다 · 덮치기)
  puff(pos) {
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#d9cfc0', transparent: true, opacity: 0.5, depthWrite: false }));
      const sz = 0.12 + Math.random() * 0.1;
      s.scale.set(sz, sz, 1);
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.05, (Math.random() - 0.5) * 0.4));
      s.userData.noHit = true;
      this.scene.add(s);
      this.items.push({ o: s, life: 0.7, age: -i * 0.04, vy: 0.3, wob: Math.random() * 6, base: sz, grow: 2.2 });
    }
  }
  // 물 튀김
  splash(pos) {
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#dff2fb', transparent: true, opacity: 0.9, depthWrite: false }));
      const sz = 0.05 + Math.random() * 0.05;
      s.scale.set(sz, sz, 1);
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.05, (Math.random() - 0.5) * 0.5));
      s.userData.noHit = true;
      this.scene.add(s);
      this.items.push({ o: s, life: 0.6, age: -i * 0.03, vy: 1.2 + Math.random(), wob: 0, base: sz, gravity: true });
    }
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (it.age < 0) { it.o.visible = false; continue; }
      it.o.visible = true;
      if (it.fall) {
        it.vy -= 9.8 * dt;
        it.o.position.y += it.vy * dt;
        if (it.o.position.y <= it.floorY) { it.o.position.y = it.floorY; it.vy = 0; it.o.rotation.set(0, it.spin, 0); } else { it.o.rotation.x += dt * 6; it.o.rotation.y += dt * 3; }
        if (it.age >= it.life - 0.5) it.o.material.opacity = Math.max(0, (it.life - it.age) / 0.5), it.o.material.transparent = true;
        if (it.age >= it.life) { this.scene.remove(it.o); it.o.geometry.dispose(); it.o.material.dispose(); this.items.splice(i, 1); }
        continue;
      }
      if (it.gravity) it.vy -= 6 * dt;
      it.o.position.y += it.vy * dt;
      it.o.position.x += Math.sin(it.age * 4 + it.wob) * 0.002 + (it.drift || 0) * dt;
      const k = it.age / it.life;
      it.o.material.opacity = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      const pop = (k < 0.15 ? 0.6 + k / 0.15 * 0.4 : 1) * (it.grow ? 1 + k * it.grow : 1);
      const ratio = it.o.scale.x / it.o.scale.y;
      it.o.scale.set(it.base * pop * ratio, it.base * pop, 1);
      if (k >= 1) {
        this.scene.remove(it.o);
        if (it.dispose) it.o.material.map.dispose();
        it.o.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}

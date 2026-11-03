// 캣타워 놀이터: 숨은 아깽이 찾기 (내 화면에서만 — 메시지 0건)
// 아기 고양이 「꼭꼭이」가 캣타워 숨숨집 · 숨는 칸 가운데 하나에 숨음. 입구마다 발자국 표시가 뜨고,
// 눌러서 찾으면 튀어나와 야옹. 10초가 지나면 숨은 곳에서 눈이 반짝이는 힌트. 찾으면 다른 곳에 또 숨음
import * as THREE from 'three';
import { CatModel, PALETTES } from './catModel.js';
import { textSprite } from './kit.js';
import { pushOut } from './nav.js';

const HINT = 10;

export class HideSeek {
  constructor(scene, room, fx, sound) {
    this.scene = scene; this.room = room; this.fx = fx; this.sound = sound;
    this.on = false;
    this.onChange = null;
    const pats = Object.keys(PALETTES);
    this.kitten = new CatModel(pats[Math.floor(Math.random() * pats.length)], null, 7, 0.78);
    this.kitten.root.visible = false;
    scene.add(this.kitten.root);
    // 힌트: 어둠 속 반짝이는 두 눈
    this.eyes = new THREE.Group();
    const em = new THREE.MeshBasicMaterial({ color: '#d8f06a' });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), em); e.position.x = s * 0.035; e.scale.y = 1.4; this.eyes.add(e); }
    this.eyes.visible = false;
    this.eyes.userData.noHit = true;
    scene.add(this.eyes);
    this.marks = [];
  }

  // 그 캣타워 둘레(7 m)의 숨을 곳. 너무 적으면 서점 전체 캣타워에서
  spotsNear(key) {
    const P = this.room.products;
    const me = P.find((p) => p.key === key) || P[0];
    const c = (p) => new THREE.Vector3((p.obstacle.minX + p.obstacle.maxX) / 2, 0, (p.obstacle.minZ + p.obstacle.maxZ) / 2);
    const mc = c(me);
    let list = P.filter((p) => c(p).distanceTo(mc) < 7).flatMap((p) => p.hides);
    if (list.length < 4) list = P.flatMap((p) => p.hides);
    return list;
  }

  start(key) {
    this.stop(true);
    this.spots = this.spotsNear(key);
    if (!this.spots.length) return false;
    this.on = true;
    this.found = 0; this.taps = 0; this.round = 0;
    for (const s of this.spots) {
      const m = textSprite('🐾', { height: 0.16, bg: 'rgba(255,250,242,0.55)' });
      m.position.copy(s.eyes).add(new THREE.Vector3(0, 0.16, 0));
      m.userData.noHit = true;
      m.renderOrder = 12;
      this.scene.add(m);
      this.marks.push(m);
    }
    this.hide();
    return true;
  }

  stop(quiet = false) {
    this.on = false;
    for (const m of this.marks) { this.scene.remove(m); m.material.map.dispose(); }
    this.marks = [];
    this.kitten.root.visible = false;
    this.eyes.visible = false;
    if (!quiet) this.onChange?.();
  }

  hide() {
    let i;
    do { i = Math.floor(Math.random() * this.spots.length); } while (this.spots.length > 1 && i === this.at);
    this.at = i;
    this.t = 0; this.taps = 0; this.state = 'hidden';
    this.round++;
    this.kitten.root.visible = false;
    this.eyes.visible = false;
    this.onChange?.();
  }

  // 화면을 눌렀을 때: 숨을 곳 근처면 true (다른 누르기 처리를 막음)
  tap(x, y, camera) {
    if (!this.on || this.state !== 'hidden') return false;
    let best = -1, bd = 46;
    const v = new THREE.Vector3();
    this.spots.forEach((s, i) => {
      v.copy(s.eyes).project(camera);
      if (v.z > 1) return;
      const d = Math.hypot((v.x + 1) / 2 * innerWidth - x, (1 - v.y) / 2 * innerHeight - y);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0) return false;
    this.taps++;
    const s = this.spots[best];
    if (best === this.at) {
      this.found++;
      this.state = 'found';
      this.t = 0;
      const k = this.kitten;
      k.root.visible = true;
      k.root.position.copy(s.inside);
      const out = s.eyes.clone().sub(s.inside).setY(0).normalize();
      this.jump = { from: s.inside.clone(), to: s.eyes.clone().addScaledVector(out, 0.45).setY(0), t: 0 };
      pushOut(this.room, this.jump.to, 0.12, true);
      k.root.rotation.y = Math.atan2(out.x, out.z);
      k.setAnim('jump');
      this.eyes.visible = false;
      this.fx.hearts(s.eyes, 5);
      this.sound.meow?.();
    } else {
      this.fx.text(s.eyes.clone().add(new THREE.Vector3(0, 0.25, 0)), '여긴 없어요', '#8a7a6a');
      this.fx.puff?.(s.eyes.clone());
    }
    this.onChange?.();
    return true;
  }

  update(dt) {
    if (!this.on) return;
    this.t += dt;
    const s = this.spots[this.at];
    for (const m of this.marks) m.material.opacity = this.state === 'hidden' ? 0.75 + Math.sin(this.t * 3) * 0.2 : 0.3;
    if (this.state === 'hidden') {
      if (this.t > HINT) {
        // 힌트: 눈 깜빡 + 가끔 작은 야옹
        this.eyes.visible = Math.sin(this.t * 2.2) > -0.6;
        this.eyes.position.copy(s.eyes);
        const out = s.eyes.clone().sub(s.inside).setY(0);
        this.eyes.rotation.y = Math.atan2(out.x, out.z);
        if (Math.floor(this.t / 6) !== Math.floor((this.t - dt) / 6)) this.sound.mew?.();
      }
    } else if (this.state === 'found') {
      const k = this.kitten;
      if (this.jump.t < 1) {
        this.jump.t = Math.min(1, this.jump.t + dt * 1.8);
        k.root.position.lerpVectors(this.jump.from, this.jump.to, this.jump.t);
        k.root.position.y += Math.sin(this.jump.t * Math.PI) * 0.35;
      } else k.setAnim(this.t < 2.4 ? 'sit' : 'walk');
      if (this.t > 2.4) { const f = new THREE.Vector3(Math.sin(k.root.rotation.y), 0, Math.cos(k.root.rotation.y)); k.root.position.addScaledVector(f, dt * 1.6); }
      if (this.t > 3.6) this.hide();
      k.update(dt, this.t > 2.4 ? 1.4 : 0);
    }
  }

  status() {
    if (!this.on) return null;
    if (this.state === 'found') return `🎉 찾았다! ${this.taps}번 만에 · 지금까지 ${this.found}번 찾았어요`;
    const left = Math.max(0, Math.ceil(HINT - this.t));
    return `🔍 꼭꼭이는 어디에? 🐾 표시를 눌러 보세요 · ${this.taps ? this.taps + '번 눌렀어요 · ' : ''}${left ? '힌트까지 ' + left + '초' : '반짝이는 눈을 찾아요'}`;
  }
}

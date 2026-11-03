// 손님 캐릭터 (작고 동글동글한 사람) + 손에 든 음료 · 말풍선
import * as THREE from 'three';
import { textSprite } from './kit.js';

export const LOOKS = {
  tops: ['#e8a87c', '#9fb7a0', '#c9b6e4', '#f2d16b', '#8fb2d6', '#e58f8f', '#f4efe6'],
  hairs: ['#3b2a22', '#6b4630', '#a8784f', '#2b2b30', '#d9b98a'],
  skins: ['#f7dcc5', '#efc9a8', '#d9a982', '#b98563'],
};

const std = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const lerp = THREE.MathUtils.lerp;

export class Avatar {
  constructor(name, look) {
    this.look = { top: LOOKS.tops[0], hair: LOOKS.hairs[0], skin: LOOKS.skins[0], ...look };
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const skin = std(this.look.skin, 0.7);
    const top = std(this.look.top, 0.95);
    const pants = std('#6d5a4c', 0.9);
    const hair = std(this.look.hair, 0.75);
    const S = (o) => { o.castShadow = true; o.receiveShadow = true; return o; };

    // 다리
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.075, 0.38, 0);
      const leg = S(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 10), pants));
      leg.position.y = -0.17;
      hip.add(leg);
      const shoe = S(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), std('#4d3a30', 0.6)));
      shoe.scale.set(1, 0.6, 1.4);
      shoe.position.set(0, -0.34, 0.03);
      hip.add(shoe);
      this.body.add(hip);
      this.legs.push(hip);
    }
    // 몸통 (스웨터)
    const torso = S(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.18, 6, 16), top));
    torso.position.y = 0.55;
    torso.scale.set(1, 1, 0.82);
    this.body.add(torso);
    // 목도리 느낌의 칼라
    const collar = S(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 20), std(new THREE.Color(this.look.top).offsetHSL(0, 0, -0.12), 0.95)));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.73;
    this.body.add(collar);
    // 팔
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.17, 0.68, 0);
      const arm = S(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 10), top));
      arm.position.y = -0.13;
      sh.add(arm);
      const hand = S(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin));
      hand.position.y = -0.27;
      sh.add(hand);
      sh.rotation.z = s * 0.12;
      this.body.add(sh);
      this.arms.push(sh);
    }
    // 머리
    this.head = new THREE.Group();
    this.head.position.y = 0.97;
    this.body.add(this.head);
    const headM = S(new THREE.Mesh(new THREE.SphereGeometry(0.22, 28, 20), skin));
    headM.scale.set(1, 0.95, 0.95);
    this.head.add(headM);
    // 머리카락
    const hairM = S(new THREE.Mesh(new THREE.SphereGeometry(0.235, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), hair));
    hairM.rotation.x = -0.35;
    hairM.position.set(0, 0.015, -0.015);
    this.head.add(hairM);
    const bangs = S(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), hair));
    bangs.scale.set(1.6, 0.55, 0.8);
    bangs.position.set(0.03, 0.13, 0.15);
    bangs.rotation.z = -0.2;
    this.head.add(bangs);
    // 눈 · 볼
    const eyeM = std('#2b211d', 0.3);
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), eyeM);
      e.scale.set(1, 1.25, 0.6);
      e.position.set(s * 0.075, 0.0, 0.2);
      this.head.add(e);
      this.eyes.push(e);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.03, 14), new THREE.MeshBasicMaterial({ color: '#f2a19a', transparent: true, opacity: 0.55 }));
      blush.position.set(s * 0.12, -0.055, 0.185);
      blush.rotation.y = s * 0.55;
      this.head.add(blush);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 10, Math.PI), eyeM);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.06, 0.205);
    this.head.add(mouth);

    // 손에 든 컵 (음료를 고르면 보임)
    this.cup = new THREE.Group();
    const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.09, 12), std('#f6efe4', 0.35));
    cupBody.castShadow = true;
    this.cupFill = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.008, 12), std('#c99a6b', 0.3));
    this.cupFill.position.y = 0.04;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 6, 10), std('#f6efe4', 0.35));
    handle.position.set(0.045, 0, 0);
    this.cup.add(cupBody, this.cupFill, handle);
    this.cup.position.set(0, -0.3, 0.05);
    this.cup.visible = false;
    this.arms[0].add(this.cup);
    // 오른손: 빌린 고양이 장난감 · 불꽃막대
    this.toyHold = new THREE.Group();
    this.toyHold.position.set(0, -0.3, 0.03);
    this.arms[1].add(this.toyHold);
    this.toy = null;
    this.playT = 0;
    this.laserDot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.9 }));
    this.laserDot.visible = false;
    this.laserDot.userData.noHit = true;
    this.root.add(this.laserDot);
    this.sparkT = 0;
    // 누를 수 있는 자리 (다른 손님 카드)
    this.hit = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.7, 4, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = 0.7;
    this.root.add(this.hit);

    this.setName(name);
    this.t = Math.random() * 5;
    this.phase = 0;
    this.sitting = 0;
    this.seatFloor = false;
    this.waveT = 0;
    this.blinkT = 2;
  }

  setName(name) {
    if (this.label) { this.root.remove(this.label); this.label.material.map.dispose(); }
    this.label = textSprite(name, { height: 0.026, screen: true });
    this.label.position.y = 1.42;
    this.label.userData.noHit = true;
    this.root.add(this.label);
  }

  wave() { this.waveT = 2.2; }

  // 장난감 들기 (null 이면 내려놓기)
  setToy(id) {
    if (this.toy === id) return;
    this.toy = id || null;
    this.toyHold.clear();
    const add = (geo, color, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, std(color, 0.7)); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; this.toyHold.add(m); return m; };
    this.feather = null;
    if (id === 'wand') {
      add(new THREE.CylinderGeometry(0.007, 0.009, 0.55, 6), '#c4935f', 0, -0.02, 0.2, Math.PI / 2 - 0.5);
      const f = new THREE.Group();
      f.position.set(0, 0.2, 0.46);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.3, 4), std('#e8e2d6')); str.position.y = -0.15; f.add(str);
      const fe = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 6), std('#e86f8a', 0.9)); fe.position.y = -0.32; fe.rotation.x = Math.PI; f.add(fe);
      const fe2 = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.09, 6), std('#6fb7e8', 0.9)); fe2.position.set(0.02, -0.3, 0); fe2.rotation.set(Math.PI, 0, 0.4); f.add(fe2);
      this.toyHold.add(f);
      this.feather = f;
    } else if (id === 'laser') add(new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8), '#3b3f46', 0, 0, 0.04, Math.PI / 2);
    else if (id === 'ball') add(new THREE.SphereGeometry(0.045, 12, 10), '#f1c45b', 0, -0.02, 0.04);
    else if (id === 'mouse') { add(new THREE.SphereGeometry(0.045, 10, 8).scale(1, 0.8, 1.6), '#9a9a96', 0, -0.02, 0.05); add(new THREE.SphereGeometry(0.015, 6, 6), '#f2a5a0', 0, 0.0, 0.12); }
    else if (id === 'catnip') add(new THREE.BoxGeometry(0.12, 0.05, 0.09), '#9cc58a', 0, -0.02, 0.04);
    else if (id === 'sparkler') {
      add(new THREE.CylinderGeometry(0.004, 0.004, 0.4, 4), '#7a7a7a', 0, 0.08, 0.12, 0.6);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff1b0' }));
      glow.position.set(0, 0.24, 0.24); this.toyHold.add(glow); this.sparkTip = glow;
    }
    this.laserDot.visible = false;
  }
  // 장난감을 흔드는 몸짓 (몇 초)
  playToy(sec = 3) { this.playT = sec; }
  sparkler(sec = 40) { this.sparkT = sec; this.setToy('sparkler'); }

  setDrink(d) {
    this.drink = d || null;
    this.cup.visible = !!d;
    if (d) this.cupFill.material.color.set(d.color || '#c99a6b');
  }

  // 말풍선 (몇 초 뒤 사라짐)
  say(text) {
    this.clearBubble();
    const lines = wrap(text, 15).slice(0, 3);
    const font = '500 34px "Gowun Dodum", sans-serif';
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = font;
    const tw = Math.max(...lines.map((l) => g.measureText(l).width));
    const lh = 44, pad = 22;
    c.width = Math.ceil(tw + pad * 2); c.height = lines.length * lh + pad * 2 + 14;
    g.font = font;
    g.fillStyle = 'rgba(255,251,244,0.96)';
    g.strokeStyle = 'rgba(141,90,53,0.35)'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(2, 2, c.width - 4, c.height - 18, 22); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(c.width / 2 - 12, c.height - 17); g.lineTo(c.width / 2, c.height - 2); g.lineTo(c.width / 2 + 12, c.height - 17); g.fill();
    g.fillStyle = '#4a3426'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, pad, pad + lh * i + lh / 2));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, transparent: true, sizeAttenuation: false }));
    const h = 0.022 * (c.height / 76);
    s.scale.set(h * c.width / c.height, h, 1);
    s.center.set(0.5, 0);
    s.position.y = 1.55;
    s.renderOrder = 30;
    s.userData.noHit = true;
    this.root.add(s);
    this.bubble = s;
    this.bubbleT = 5 + Math.min(4, text.length * 0.08);
  }
  clearBubble() {
    if (!this.bubble) return;
    this.root.remove(this.bubble);
    this.bubble.material.map.dispose();
    this.bubble.material.dispose();
    this.bubble = null;
  }
  setLabelVisible(v) { if (this.label) this.label.visible = v; }

  update(dt, speed, sitTarget) {
    this.t += dt;
    if (this.bubble) {
      this.bubbleT -= dt;
      this.bubble.material.opacity = Math.min(1, this.bubbleT / 0.6);
      if (this.bubbleT <= 0) this.clearBubble();
    }
    const walking = speed > 0.05;
    this.phase += dt * speed * 7.5;
    const sw = walking ? Math.sin(this.phase) : 0;
    this.sitting = lerp(this.sitting, sitTarget ? 1 : 0, 1 - Math.exp(-8 * dt));
    const s = this.sitting;

    this.legs.forEach((l, i) => {
      l.rotation.x = (i ? -sw : sw) * 0.6 * (1 - s) - s * 1.45;
    });
    this.arms.forEach((a, i) => {
      a.rotation.x = (i ? sw : -sw) * 0.5 * (1 - s) - s * 0.4;
    });
    if (this.sparkT > 0) {
      this.sparkT -= dt;
      if (this.sparkTip) this.sparkTip.scale.setScalar(0.8 + Math.random() * 0.8);
      if (this.sparkT <= 0) this.setToy(this.restoreToy || null);
    }
    if (this.playT > 0 && this.toy && this.toy !== 'sparkler') {
      this.playT -= dt;
      const a = this.arms[1];
      a.rotation.x = -0.9 + Math.sin(this.t * (this.toy === 'wand' ? 9 : 5)) * 0.45;
      a.rotation.z = 0.25 + Math.sin(this.t * 3.3) * 0.3;
      if (this.feather) this.feather.rotation.set(Math.sin(this.t * 11) * 0.6, 0, Math.cos(this.t * 8) * 0.6);
      if (this.toy === 'laser') {
        this.laserDot.visible = true;
        this.laserDot.position.set(Math.sin(this.t * 2.3) * 0.9 + Math.sin(this.t * 5.1) * 0.3, 0.015, 1.2 + Math.cos(this.t * 1.7) * 0.6);
      }
      if (this.playT <= 0) this.laserDot.visible = false;
    } else if (this.waveT > 0) {
      this.waveT -= dt;
      const a = this.arms[1];
      a.rotation.x = -0.2;
      a.rotation.z = 2.6 + Math.sin(this.t * 12) * 0.35;
    } else {
      this.arms[1].rotation.z = lerp(this.arms[1].rotation.z, 0.12, 1 - Math.exp(-10 * dt));
    }
    // 앉으면 엉덩이 높이(0.38)를 자리 높이에 맞춤 → 바깥에서 root.y 조절
    this.body.position.y = Math.abs(sw) * 0.03 + Math.sin(this.t * 2) * 0.004 * (1 - (walking ? 1 : 0));
    this.body.rotation.z = sw * 0.04;
    this.head.rotation.y = Math.sin(this.t * 0.5) * 0.12 * (walking ? 0 : 1);
    // 깜빡
    this.blinkT -= dt;
    if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 3;
    const closed = this.blinkT < 0.12;
    this.eyes.forEach((e) => (e.scale.y = closed ? 0.15 : 1.25));
  }
}

function wrap(text, n) {
  const out = [];
  let cur = '';
  for (const w of String(text).split(/(\s+)/)) {
    if ((cur + w).length > n && cur.trim()) { out.push(cur.trim()); cur = w.trimStart(); } else cur += w;
    while (cur.length > n) { out.push(cur.slice(0, n)); cur = cur.slice(n); }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

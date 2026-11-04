// 손님 캐릭터 (작고 동글동글한 사람) + 손에 든 음료 · 말풍선
import * as THREE from 'three';

export const LOOKS = {
  tops: ['#e8a87c', '#9fb7a0', '#c9b6e4', '#f2d16b', '#8fb2d6', '#e58f8f', '#f4efe6', '#3f5a73', '#6b4a3a', '#2f3b33', '#f2b8c6', '#7fbfb4'],
  hairs: ['#3b2a22', '#6b4630', '#a8784f', '#2b2b30', '#d9b98a', '#8a3b3b', '#cfc8bd', '#e3a1b4'],
  skins: ['#f7dcc5', '#efc9a8', '#d9a982', '#b98563'],
  bottoms: ['#6d5a4c', '#3b4a63', '#8c8578', '#2f2f33', '#b48a5e', '#7a4b5a', '#e9e2d6', '#5f6b4e'],
  // 고르기 (누구나 무엇이든): 머리 모양 · 아래옷 · 소품
  hairStyles: [['short', '짧은 머리'], ['bob', '단발'], ['long', '긴 머리'], ['bun', '올림 머리'], ['twin', '양갈래'], ['curly', '곱슬']],
  bottomStyles: [['pants', '긴 바지'], ['shorts', '반바지'], ['skirt', '치마'], ['dress', '원피스']],
  accs: [['none', '없음'], ['glasses', '안경'], ['beanie', '털모자'], ['beret', '베레모'], ['cap', '야구모자'], ['ribbon', '리본']],
};
const pick = (list, v) => (list.some(([k]) => k === v) ? v : list[0][0]);
// 처음 온 손님의 모습: 목록 안에서 칸마다 따로 고르게 섞음 (성별을 가정하지 않음)
export function randomLook() {
  const any = (l) => l[Math.floor(Math.random() * l.length)];
  return { top: any(LOOKS.tops), hair: any(LOOKS.hairs), skin: any(LOOKS.skins), bc: any(LOOKS.bottoms), hs: any(LOOKS.hairStyles)[0], bt: any(LOOKS.bottomStyles)[0], ac: any(LOOKS.accs)[0] };
}

const std = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const lerp = THREE.MathUtils.lerp;

// ---------- 이름표 · 말풍선: 3D 그림 대신 화면 위 글자(HTML)로 — 휴대폰 해상도 그대로 또렷하고 크게 ----------
const TAGS = new Set();
let tagLayer = null;
const layer = () => {
  if (!tagLayer) { tagLayer = document.createElement('div'); tagLayer.id = 'tagLayer'; tagLayer.className = 'tag-layer'; (document.getElementById('hud') || document.body).prepend(tagLayer); }
  return tagLayer;
};
const _tp = new THREE.Vector3();
// 매 프레임 그린 뒤 한 번: 모든 이름표를 머리 위 화면 자리로
// center = 내 자리. 이름표는 16 m, 말풍선은 22 m 안에서만 (벽 너머 먼 이름표가 화면에 떠 보이지 않게)
const _c = new THREE.Vector3();
export function placeTags(camera, W, H, center) { for (const a of TAGS) a.placeTag(camera, W, H, center); }

export class Avatar {
  constructor(name, look) {
    this.look = { top: LOOKS.tops[0], hair: LOOKS.hairs[0], skin: LOOKS.skins[0], bc: LOOKS.bottoms[0], ...look };
    const hs = pick(LOOKS.hairStyles, this.look.hs), bt = pick(LOOKS.bottomStyles, this.look.bt), ac = pick(LOOKS.accs, this.look.ac);
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const skin = std(this.look.skin, 0.86);   // 무광 점토 느낌 (디오라마)
    const top = std(this.look.top, 0.95);
    const pants = std(this.look.bc || '#6d5a4c', 0.9);
    const bare = bt === 'skirt' || bt === 'dress' || bt === 'shorts';   // 다리를 피부로 (짧은 아래옷)
    const hair = std(this.look.hair, 0.92);
    const S = (o) => { o.castShadow = true; o.receiveShadow = true; return o; };

    // 다리
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.075, 0.38, 0);
      const leg = S(new THREE.Mesh(new THREE.CapsuleGeometry(bare ? 0.05 : 0.06, 0.22, 4, 10), bare ? skin : pants));
      leg.position.y = -0.17;
      hip.add(leg);
      if (bt === 'shorts') { const sh = S(new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.06, 4, 10), pants)); sh.position.y = -0.05; hip.add(sh); }
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
    // 치마 · 원피스 (몸통 아래 퍼지는 통)
    if (bt === 'skirt' || bt === 'dress') {
      const len = bt === 'dress' ? 0.3 : 0.2;
      const sk = S(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.235, len, 20, 1, true), bt === 'dress' ? top : pants));
      sk.material.side = THREE.DoubleSide;
      sk.position.y = 0.44 - len / 2 + 0.05;
      sk.scale.z = 0.86;
      this.body.add(sk);
    }
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
    // 머리카락 (모양 여섯 가지)
    const H = (geo, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => { const m = S(new THREE.Mesh(geo, hair)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, 0, rz); this.head.add(m); return m; };
    if (hs === 'curly') {
      // 곱슬: 작은 구슬을 동그랗게 얹음
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 * 2.618, t = Math.acos(1 - (i + 0.5) / 22 * 1.15);
        H(new THREE.SphereGeometry(0.075, 10, 8), Math.sin(t) * Math.cos(a) * 0.2, Math.cos(t) * 0.2 + 0.02, Math.sin(t) * Math.sin(a) * 0.2 - 0.02);
      }
    } else {
      const cap = H(new THREE.SphereGeometry(0.235, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 0.015, -0.015);
      cap.rotation.x = -0.35;
      H(new THREE.SphereGeometry(0.1, 14, 10), 0.03, 0.13, 0.15, 1.6, 0.55, 0.8, 0, -0.2);   // 앞머리
    }
    // 옆 · 뒤로 내려오는 머리 (얼굴 앞은 비움)
    const sideHair = (lo) => H(new THREE.SphereGeometry(0.245, 26, 18, Math.PI * 0.78, Math.PI * 1.44, Math.PI * 0.22, Math.PI * lo), 0, 0.0, -0.005);
    if (hs === 'bob' || hs === 'long' || hs === 'twin') sideHair(hs === 'twin' ? 0.38 : 0.5);
    if (hs === 'long') { const back = H(new THREE.CapsuleGeometry(0.15, 0.2, 6, 14), 0, -0.24, -0.11, 1.05, 1, 0.5); back.rotation.x = 0.12; }
    if (hs === 'bun') { H(new THREE.SphereGeometry(0.095, 16, 12), 0, 0.23, -0.1); H(new THREE.TorusGeometry(0.06, 0.018, 8, 16), 0, 0.19, -0.08, 1, 1, 1, Math.PI / 2.4); }
    if (hs === 'twin') for (const sx of [-1, 1]) { H(new THREE.SphereGeometry(0.05, 10, 8), sx * 0.21, 0.02, -0.06); const tail = H(new THREE.CapsuleGeometry(0.045, 0.14, 4, 10), sx * 0.25, -0.1, -0.06); tail.rotation.z = sx * 0.25; }
    // 소품
    const accM = std(new THREE.Color(this.look.top).offsetHSL(0, -0.05, -0.18), 0.85);
    const A = (geo, mat, x, y, z) => { const m = S(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); this.head.add(m); return m; };
    if (ac === 'glasses') {
      const gm = std('#3a2c24', 0.4);
      for (const sx of [-1, 1]) A(new THREE.TorusGeometry(0.043, 0.008, 8, 20), gm, sx * 0.075, 0.0, 0.212);
      A(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6).rotateZ(Math.PI / 2), gm, 0, 0.005, 0.215);
    } else if (ac === 'beanie') {
      const b = A(new THREE.SphereGeometry(0.25, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), accM, 0, 0.04, -0.01); b.scale.y = 0.95;
      A(new THREE.TorusGeometry(0.235, 0.035, 8, 28).rotateX(Math.PI / 2), accM, 0, 0.05, -0.01);
      A(new THREE.SphereGeometry(0.05, 10, 8), accM, 0, 0.3, -0.01);
    } else if (ac === 'beret') {
      const b = A(new THREE.SphereGeometry(0.23, 22, 12), accM, 0.04, 0.17, -0.02); b.scale.set(1.05, 0.32, 1.05); b.rotation.z = -0.25;
      A(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6), accM, 0.07, 0.25, -0.02);
    } else if (ac === 'cap') {
      A(new THREE.SphereGeometry(0.24, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), accM, 0, 0.05, -0.01);
      const brim = A(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20, 1, false, -Math.PI / 2, Math.PI), accM, 0, 0.07, 0.12); brim.scale.z = 1.1;
    } else if (ac === 'ribbon') {
      const rm = std('#d9566e', 0.6);
      for (const sx of [-1, 1]) { const w = A(new THREE.ConeGeometry(0.05, 0.09, 10), rm, 0.14 + sx * 0.05, 0.2, 0.02); w.rotation.z = sx * Math.PI / 2; }
      A(new THREE.SphereGeometry(0.022, 8, 6), rm, 0.14, 0.2, 0.02);
    }
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
    // 목공 도구 (오른손 · 왼손)
    this.toolR = new THREE.Group(); this.toolR.position.set(0, -0.3, 0.03); this.arms[1].add(this.toolR);
    this.toolL = new THREE.Group(); this.toolL.position.set(0, -0.3, 0.03); this.arms[0].add(this.toolL);
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
    if (!this.tag) {
      const el = document.createElement('div');
      el.className = 'av-tag';
      el.innerHTML = '<div class="av-bubble"></div><div class="av-name"></div>';
      el.style.display = 'none';
      layer().appendChild(el);
      this.tag = el; this.tagBubble = el.firstChild; this.tagName = el.lastChild;
      this.labelOn = true; this.tagShown = false;
      TAGS.add(this);
    }
    this.tagName.textContent = name;
  }
  dispose() { this.tag?.remove(); TAGS.delete(this); this.tag = null; }
  placeTag(camera, W, H, center) {
    const el = this.tag;
    if (!el) return;
    let vis = !!this.root.parent;
    for (let o = this.root; o && vis; o = o.parent) if (!o.visible) vis = false;
    if (vis) {
      this.head.getWorldPosition(_tp);
      _tp.y += 0.3;
      this.tagDist = camera.position.distanceTo(_tp);
      _tp.project(camera);
      if (_tp.z > 1 || Math.abs(_tp.x) > 1.2 || Math.abs(_tp.y) > 1.2) vis = false;
    }
    const far = center ? this.root.getWorldPosition(_c).distanceTo(center) : 0;
    const showName = this.labelOn !== false && far < 16, showBubble = !!this.bubble && far < 22;
    if (!vis || (!showName && !showBubble)) { if (this.tagShown) { el.style.display = 'none'; this.tagShown = false; } return; }
    if (!this.tagShown) { el.style.display = ''; this.tagShown = true; }
    const x = (_tp.x * 0.5 + 0.5) * W, y = (-_tp.y * 0.5 + 0.5) * H;
    const sc = Math.max(0.72, Math.min(1.08, 1.22 - this.tagDist / 30));
    el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%) scale(${sc.toFixed(3)})`;
    el.style.zIndex = String(Math.max(1, 2000 - Math.round(this.tagDist * 20)));
    this.tagName.style.display = showName ? '' : 'none';
  }

  wave() { this.waveT = 2.2; }

  // 목공방 앞치마 (null 이면 벗기)
  setApron(on) {
    if (!!on === !!this.apron) return;
    if (this.apron) { this.body.remove(this.apron); this.apron = null; }
    if (!on) return;
    const g = new THREE.Group();
    const cloth = std('#6b5844', 0.95), strap = std('#4a3c30', 0.9);
    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, 0.02), cloth); bib.position.set(0, 0.64, 0.135); g.add(bib);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.26, 0.02), cloth); skirt.position.set(0, 0.44, 0.15); skirt.rotation.x = 0.08; g.add(skirt);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.01), strap); pocket.position.set(0, 0.45, 0.165); g.add(pocket);
    for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.12, 0.012), strap); st.position.set(sx * 0.07, 0.76, 0.1); st.rotation.x = -0.5; g.add(st); }
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.008, 4, 20), strap); belt.rotation.x = Math.PI / 2; belt.position.y = 0.55; belt.scale.set(1, 0.82, 1); g.add(belt);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.body.add(g);
    this.apron = g;
  }

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
  // 춤추기 (style 0 흔들흔들 · 1 만세 · 2 빙글빙글 · 3 로봇)
  dance(style = 0, sec = 6) { this.danceT = sec; this.danceS = style % 4; this.danceT0 = this.t; }
  stopDance() { this.danceT = 0; }
  // 목공: kind = 'saw' 톱 · 'plane' 대패 · 'chisel' 끌과 나무망치 · 'nail' 망치 (null 이면 내려놓기). auto 면 스스로 계속 (다른 손님 화면)
  craft(kind, auto = false) {
    this.craftAuto = auto;
    if (this.craftKind === (kind || null)) return;
    this.craftKind = kind || null;
    this.toolR.clear(); this.toolL.clear();
    const add = (grp, geo, color, x, y, z, rx = 0, ry = 0, rz = 0, metal = 0) => { const m = new THREE.Mesh(geo, metal ? new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: Math.min(0.35, metal) }) : std(color, 0.7)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; grp.add(m); return m; };
    const R = this.toolR, L = this.toolL;
    if (kind === 'saw') {
      add(R, new THREE.BoxGeometry(0.035, 0.08, 0.05), '#8a5a3a', 0, 0, 0.03);
      add(R, new THREE.BoxGeometry(0.004, 0.07, 0.34), '#c9ced3', 0, -0.01, 0.22, 0, 0, 0, 0.8);
    } else if (kind === 'plane') {
      add(R, new THREE.BoxGeometry(0.06, 0.055, 0.2), '#b9875a', 0, -0.03, 0.07);
      add(R, new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8), '#6b4a30', 0, 0.01, 0.02, Math.PI / 2);
      add(R, new THREE.BoxGeometry(0.04, 0.012, 0.03), '#c9ced3', 0, 0.0, 0.1, 0.5, 0, 0, 0.8);
    } else if (kind === 'chisel') {
      add(R, new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6), '#8a5a3a', 0, 0.0, 0.08, Math.PI / 2);
      add(R, new THREE.BoxGeometry(0.07, 0.05, 0.05), '#d9b07c', 0, 0.0, 0.18);
      add(L, new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), '#8a5a3a', 0, 0.0, 0.0);
      add(L, new THREE.BoxGeometry(0.018, 0.08, 0.006), '#c9ced3', 0, -0.08, 0, 0, 0, 0, 0.8);
    } else if (kind === 'nail') {
      add(R, new THREE.CylinderGeometry(0.009, 0.009, 0.22, 6), '#8a5a3a', 0, 0.0, 0.09, Math.PI / 2);
      add(R, new THREE.BoxGeometry(0.09, 0.03, 0.03), '#6f757b', 0, 0.0, 0.2, 0, 0, 0, 0.7);
    }
    this.toyHold.visible = !this.craftKind;
    this.strokeT = 0;
  }
  stroke() { this.strokeT = 1; }
  writing(sec = 0.5) { this.writeT = Math.max(this.writeT || 0, sec); }
  sparkler(sec = 40) { this.sparkT = sec; this.setToy('sparkler'); }

  setDrink(d) {
    this.drink = d || null;
    this.cup.visible = !!d;
    if (d) this.cupFill.material.color.set(d.color || '#c99a6b');
  }

  // 말풍선 (몇 초 뒤 사라짐)
  say(text) {
    if (!this.tag) this.setName('');
    this.tagBubble.textContent = String(text).slice(0, 120);
    this.tagBubble.style.opacity = '1';
    this.tagBubble.classList.add('show');
    this.bubble = true;
    this.bubbleT = 6 + Math.min(6, text.length * 0.12);
  }
  clearBubble() {
    if (!this.bubble) return;
    this.tagBubble.classList.remove('show');
    this.bubble = null;
  }
  setLabelVisible(v) { this.labelOn = v; }

  update(dt, speed, sitTarget) {
    this.t += dt;
    if (this.bubble) {
      this.bubbleT -= dt;
      if (this.bubbleT < 0.6) this.tagBubble.style.opacity = String(Math.max(0, this.bubbleT / 0.6));
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
    if (this.writeT > 0) {
      // 필사: 오른손을 책상 위로 뻗고 고개를 숙여 사각사각
      this.writeT -= dt;
      const a = this.arms[1];
      a.rotation.x = -1.05 + Math.sin(this.t * 22) * 0.05;
      a.rotation.z = 0.32 + Math.cos(this.t * 17) * 0.05;
      this.head.rotation.x = 0.28;
    }
    if (this.writeT > 0) { /* 위에서 처리 */ } else if (this.playT > 0 && this.toy && this.toy !== 'sparkler') {
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
    this.arms[0].rotation.z = lerp(this.arms[0].rotation.z, -0.12, 1 - Math.exp(-10 * dt));
    // 앉으면 엉덩이 높이(0.38)를 자리 높이에 맞춤 → 바깥에서 root.y 조절
    this.body.position.y = Math.abs(sw) * 0.03 + Math.sin(this.t * 2) * 0.004 * (1 - (walking ? 1 : 0));
    this.body.rotation.z = sw * 0.04;
    this.body.rotation.x = 0;
    this.body.rotation.y = 0;
    this.head.rotation.y = Math.sin(this.t * 0.5) * 0.12 * (walking ? 0 : 1);
    // 목공: 앉아 있을 때만. 한 번 누를 때마다 한 동작(stroke), 다른 손님 화면에선 스스로 되풀이
    if (this.craftKind && s > 0.5) {
      if (this.craftAuto) { this.autoT = (this.autoT || 0) + dt; if (this.autoT > 0.8) { this.autoT = 0; this.strokeT = 1; } }
      const k = this.craftKind, R = this.arms[1], L = this.arms[0];
      const dur = k === 'plane' ? 0.6 : k === 'saw' ? 0.42 : 0.32;
      const u = this.strokeT > 0 ? 1 - this.strokeT : 0;          // 0 → 1 동작 진행
      if (this.strokeT > 0) this.strokeT = Math.max(0, this.strokeT - dt / dur);
      const wave = Math.sin(u * Math.PI);                          // 0 → 1 → 0
      this.head.rotation.x = 0.32;
      if (k === 'saw') { R.rotation.x = -1.05 - wave * 0.3; R.rotation.z = 0.2; L.rotation.x = -0.9; L.rotation.z = -0.35; this.body.rotation.x = wave * 0.08; }
      else if (k === 'plane') { R.rotation.x = -1.0 - wave * 0.45; R.rotation.z = 0.12; L.rotation.x = -1.0 - wave * 0.45; L.rotation.z = -0.12; this.body.rotation.x = wave * 0.16; }
      else if (k === 'chisel') { L.rotation.x = -1.15; L.rotation.z = -0.15; const up = u < 0.55 ? u / 0.55 : 1 - (u - 0.55) / 0.45; R.rotation.x = -1.2 - up * 0.9; R.rotation.z = 0.3; }
      else if (k === 'nail') { L.rotation.x = -1.05; L.rotation.z = -0.3; const up = u < 0.6 ? u / 0.6 : 1 - (u - 0.6) / 0.4; R.rotation.x = -1.05 - up * 1.15; R.rotation.z = 0.25; }
    } else if (this.writeT <= 0 && this.head.rotation.x > 0.001) this.head.rotation.x *= 0.9;
    // 춤추기
    if (this.danceT > 0) {
      this.danceT -= dt;
      const tt = this.t - (this.danceT0 || 0), b = Math.sin(tt * 7), up = Math.abs(Math.sin(tt * 3.5));
      const L = this.arms[0], R = this.arms[1], fade = Math.min(1, this.danceT / 0.4, tt / 0.3);
      const standing = 1 - s;
      if (this.danceS === 0) {         // 흔들흔들: 몸을 좌우로, 팔은 머리 위에서 흔듦
        this.body.rotation.z = b * 0.2 * fade;
        this.body.position.y += up * 0.05 * fade * standing;
        L.rotation.z = -(2.3 + b * 0.35) * fade; R.rotation.z = (2.3 - b * 0.35) * fade; L.rotation.x = R.rotation.x = 0;
        this.legs.forEach((l, i) => { l.rotation.x += (i ? b : -b) * 0.25 * standing * fade; });
      } else if (this.danceS === 1) {  // 만세 점프
        const j = Math.max(0, Math.sin(tt * 8));
        this.body.position.y += j * 0.12 * fade * standing;
        L.rotation.z = -(0.4 + j * 2.4) * fade; R.rotation.z = (0.4 + j * 2.4) * fade; L.rotation.x = R.rotation.x = 0;
        this.legs.forEach((l) => { l.rotation.x -= j * 0.35 * standing * fade; });
      } else if (this.danceS === 2) {  // 빙글빙글
        this.body.rotation.y = tt * 6.5 * fade;
        L.rotation.z = -1.5 * fade; R.rotation.z = 1.5 * fade; L.rotation.x = R.rotation.x = 0;
        this.body.position.y += up * 0.03 * standing;
      } else {                         // 로봇 춤: 딱딱 끊어지는 팔
        const step = Math.floor(tt * 3) % 4;
        const poses = [[-1.57, 0, 0, -1.57], [0, -1.57, -1.57, 0], [-1.57, -1.57, 0, 0], [0, 0, -1.57, -1.57]][step];
        L.rotation.x = poses[0] * fade; R.rotation.x = poses[1] * fade; L.rotation.z = -0.1; R.rotation.z = 0.1;
        this.head.rotation.y = (step % 2 ? 0.35 : -0.35) * fade;
        this.body.position.y += (step % 2 ? 0.02 : 0) * standing;
      }
    }
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

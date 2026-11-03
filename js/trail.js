// 숲 둘레길: 맵 가장자리를 한 바퀴 도는 산책로와 길가 볼거리
// 바닷가 → 등대(남서) → 대나무 숲길(서) → 자작나무 길(북) → 연못(북동) → 억새 언덕(동) → 바닷가
// 길 모양(RING)은 forest.js 의 PATHS 에 들어가 흙길 · 등불 · 나무 피하기를 함께 씁니다.
import * as THREE from 'three';
import { M, rbox, mesh, glowSprite, textSprite } from './kit.js';
import { bench, addSeat } from './furniture.js';

// 둘레길 (닫힌 고리). 가운데 바닷가 구간(2 → 46)은 forest.js 의 바닷길이 이어 줌
export const RING = [
  [46, 26.2], [50, 26.4], [55.5, 25.8], [59.4, 22], [60.1, 15], [59.5, 7], [60.3, -1], [59.4, -9], [60.2, -17], [59.6, -25],
  [55, -29.2], [48, -30], [40, -29.5], [32, -30.2], [24, -29.6], [16, -30], [8, -29.4], [0, -30.1], [-8, -29.3], [-16, -30], [-24, -29.4],
  [-27.4, -24], [-28.3, -16], [-27.8, -8], [-28.4, 0], [-27.6, 8], [-28.2, 16], [-27.5, 22.5], [-24.5, 26.2], [-18, 26.4], [-10, 26.0], [-3, 25.8], [2, 25.5],
];
// 둘레길과 안쪽 길을 잇는 샛길
export const SPURS = [
  [[-19.5, 0], [-24, 0.5], [-28.4, 0]],                       // 집 둘레 → 서쪽 대나무 숲
  [[-9, -13.5], [-8.5, -21], [-8, -29.3]],                    // 집 뒤 → 북쪽 자작나무 길
  [[15, -20], [14.5, -25], [16, -30]],                        // 숲 안쪽 숨은 자리 → 북쪽
  [[43.5, -10.8], [47.3, -16], [48.3, -21.5], [49.6, -27.6], [55, -29.2]], // 나무 위 오두막 → 연못 → 둘레길
  [[40.5, 7], [45, 8.5], [51, 7.8], [59.5, 7]],               // 들꽃 언덕 → 억새 언덕
];
// 「가볼 곳」 · 지나갈 때 알려 주는 자리
export const TRAIL_SPOTS = [
  { ico: '🗼', name: '바닷가 등대', note: '둘레길 남서쪽 끝, 밤엔 빛이 돎', to: [-25.8, 0, 25.6] },
  { ico: '🎋', name: '대나무 숲길', note: '둘레길 서쪽, 바람에 사각사각', to: [-28.0, 0, -9.0] },
  { ico: '🌳', name: '자작나무 길', note: '둘레길 북쪽, 하얀 나무 사이', to: [6.0, 0, -29.4] },
  { ico: '🪷', name: '연못', note: '둘레길 북동쪽, 연잎 · 연꽃', to: [49.4, 0, -25.0] },
  { ico: '🌾', name: '억새 언덕', note: '둘레길 동쪽, 은빛 억새밭', to: [59.6, 0, 3.0] },
];

// 바람에 흔들리는 풀 · 대나무 (인스턴스 메시 = 같은 모양을 한 번에 여러 개 그리는 방법)
function windMat(color, amp, room) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const u = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = u;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
      #else
        float ph = 0.0;
      #endif
      float h = max(0.0, position.y);
      transformed.x += sin(uWind * 1.3 + ph) * h * ${amp.toFixed(3)};
      transformed.z += cos(uWind * 1.1 + ph * 1.3) * h * ${(amp * 0.6).toFixed(3)};`);
  };
  room.nightParts.push((dt, t) => { u.value = t; });
  return m;
}

export function buildTrail(scene, room, { obst, excl, trees, r, signpost, rockMat }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  room.ring = RING.map(([x, z]) => V(x, 0, z));

  // ---------- 쉼터 벤치 ----------
  for (const [x, z, rot] of [[-26.0, 18.5, -Math.PI / 2], [-26.2, -20, -Math.PI / 2], [-12, -27.9, Math.PI], [20, -28.1, Math.PI], [36, -28.0, Math.PI], [57.9, -12, Math.PI / 2], [57.8, 19, Math.PI / 2], [-14, 24.6, 0]]) {
    bench(scene, room, x, z, rot, 1.5, 2, { name: '둘레길 쉼터 벤치' });
    excl.push([x, z, 1.8]);
  }

  // ---------- 남서: 바닷가 등대 ----------
  {
    const lx = -28.6, lz = 27.9;
    const g = new THREE.Group();
    const white = M.color('#f4f0e8', 0.7), red = M.color('#c9483b', 0.7);
    g.add(mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.6, 16), rockMat, 0, 0.3, 0));
    for (let i = 0; i < 5; i++) g.add(mesh(new THREE.CylinderGeometry(0.95 - i * 0.08, 1.03 - i * 0.08, 1.1, 16), i % 2 ? red : white, 0, 0.6 + 0.55 + i * 1.1, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 16), M.color('#3e3a36', 0.5), 0, 6.15, 0));
    const glass = new THREE.MeshStandardMaterial({ color: '#fff4cf', emissive: '#ffd46a', emissiveIntensity: 0.1, transparent: true, opacity: 0.85 });
    g.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.8, 12), glass, 0, 6.6, 0, { cast: false }));
    g.add(mesh(new THREE.ConeGeometry(0.75, 0.6, 12), red, 0, 7.3, 0));
    g.add(mesh(new THREE.TorusGeometry(0.85, 0.03, 6, 20).rotateX(Math.PI / 2), M.color('#3e3a36', 0.5), 0, 6.5, 0));
    // 문
    g.add(mesh(rbox(0.5, 1.0, 0.1, 0.03), M.woodDark(), 0, 1.1, 1.0));
    // 도는 빛줄기 (밤)
    const beamMat = new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const beam = new THREE.Group();
    for (const s of [1, -1]) { const c = mesh(new THREE.ConeGeometry(1.6, 22, 16, 1, true).rotateZ(s * Math.PI / 2).translate(s * 11, 0, 0), beamMat, 0, 0, 0, { cast: false }); c.userData.noHit = true; beam.add(c); }
    beam.position.y = 6.6;
    g.add(beam);
    const gl = glowSprite('#ffe3a0', 3.2); gl.position.y = 6.6; g.add(gl);
    const light = new THREE.PointLight('#ffe0a0', 0, 18, 1.5); light.position.y = 6.6; g.add(light);
    g.position.set(lx, 0, lz);
    scene.add(g);
    obst(lx - 1.45, lx + 1.45, lz - 1.45, lz + 1.45);
    excl.push([lx, lz, 3.5]);
    room.nightParts.push((dt, t, n) => {
      beam.rotation.y = t * 0.6;
      beamMat.opacity = n * 0.12;
      beam.visible = n > 0.05;
      glass.emissiveIntensity = 0.1 + n * 2.2;
      gl.material.opacity = n * 0.8;
      light.intensity = n * 4;
    });
    bench(scene, room, -25.0, 28.6, face(-25.0, 28.6, -25.0, 40), 1.5, 2, { name: '등대 앞 벤치' });
  }

  // ---------- 서쪽: 대나무 숲길 ----------
  {
    const N = 340;
    const stalk = new THREE.CylinderGeometry(0.06, 0.075, 1, 7); stalk.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(stalk, windMat('#7fa65a', 0.035, room), N);
    const leaf = new THREE.ConeGeometry(0.5, 1.1, 5); leaf.translate(0, 0.55, 0);
    const lm = new THREE.InstancedMesh(leaf, windMat('#8fbf62', 0.05, room), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < 3000 && n < N; i++) {
      const z = -21 + r() * 26;
      const side = r() < 0.5 ? -1 : 1;
      const x = -28.0 + side * (1.35 + r() * 2.6);
      if (x < -31 + 0.2) continue;
      if (side > 0 && z > -1.6 && z < 2.0) continue;   // 서점 쪽 샛길 자리는 비워 둠
      // 바깥(서쪽)은 키 크게, 안쪽(카메라가 넘겨다보는 쪽)은 낮고 성기게
      if (side > 0 && r() < 0.45) continue;
      const h = side < 0 ? 4.8 + r() * 2.8 : 3.4 + r() * 1.6;
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.08, r() * 3, (r() - 0.5) * 0.08));
      const sp = V(x, 0, z), ss = V(1, h, 1), lp = V(x, h - 0.5, z), ls = V(0.7 + r() * 0.4, 1.2 + r() * 0.8, 0.7 + r() * 0.4);
      im.setMatrixAt(n, m4.compose(sp, q, ss));
      im.setColorAt(n, col.set(r() < 0.3 ? '#9cbd66' : '#6f9a4e').offsetHSL(0, 0, (r() - 0.5) * 0.08));
      lm.setMatrixAt(n, m4.compose(lp, q, ls));
      // 카메라와 나 사이에 들면 나무 잎처럼 낮게 접힘 (forest.js updateCanopies)
      (room.canopies ||= []).push({ x, z, k: 1, parts: [{ mesh: im, i: n, p: sp, q: q.clone(), s: ss }, { mesh: lm, i: n, p: lp, q: q.clone(), s: ls, drop: true }] });
      n++;
    }
    im.count = lm.count = n;
    im.castShadow = lm.castShadow = true;
    im.userData.noHit = lm.userData.noHit = true;
    scene.add(im, lm);
    // 대나무 사이로는 못 지나감 (길 양옆 벽)
    obst(-31.2, -29.3, -21.2, 5.2);
    obst(-26.7, -24.6, -21.2, -1.4);
    obst(-26.7, -24.6, 1.8, 5.2);
    excl.push([-28, -8, 14]);
    signpost(-26.4, 6.5, [['대나무 숲길', -Math.PI / 2 - 0.1], ['등대 · 바닷가', Math.PI / 2 + 0.1], ['서점으로', 0]]);
  }

  // ---------- 북쪽: 자작나무 길 ----------
  for (let i = 0; i < 64; i++) {
    const x = -6 + r() * 28;
    const side = r() < 0.5 ? -1 : 1;
    const z = -29.7 + side * (2.0 + r() * 2.8);
    if (z < -32.6 || trees.some((t) => Math.hypot(x - t[0], z - t[1]) < 1.6)) continue;
    trees.push([x, z, 'birch', 0.9 + r() * 0.45]);
  }
  excl.push([8, -29.7, 14]);
  signpost(-6.6, -27.6, [['자작나무 길', 0], ['대나무 숲길', Math.PI], ['서점 뒤로', -Math.PI / 2]]);

  // ---------- 북동: 연못 ----------
  {
    const px = 52.6, pz = -24.2, ra = 3.4, rb = 2.6;
    const water = mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5f9aa8', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 }), px, 0.025, pz, { cast: false });
    water.scale.set(ra, 1, rb);
    scene.add(water);
    const rim = mesh(new THREE.RingGeometry(0.97, 1.12, 40).rotateX(-Math.PI / 2), M.color('#7d6b52', 1), px, 0.02, pz, { cast: false });
    rim.scale.set(ra, 1, rb); scene.add(rim);
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + r() * 0.1; const st = mesh(new THREE.DodecahedronGeometry(0.22 + r() * 0.2, 0), rockMat, px + Math.cos(a) * ra * 1.12, 0.08, pz + Math.sin(a) * rb * 1.12); st.scale.y = 0.5; st.rotation.y = r() * 3; scene.add(st); }
    // 연잎 · 연꽃
    const padM = M.color('#5f8f4a', 0.8), lotus = M.color('#f3a9c0', 0.7), lotusC = M.color('#ffe08a', 0.6);
    const lilies = [];
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.8;
      const lx = px + Math.cos(a) * ra * d, lz = pz + Math.sin(a) * rb * d;
      const pad = mesh(new THREE.CircleGeometry(0.22 + r() * 0.12, 14, 0.3, Math.PI * 2 - 0.3).rotateX(-Math.PI / 2), padM, lx, 0.035, lz, { cast: false });
      pad.rotation.y = r() * 6; scene.add(pad); lilies.push(pad);
      if (i % 3 === 0) { const f = new THREE.Group(); for (let k = 0; k < 6; k++) { const p = mesh(new THREE.SphereGeometry(0.06, 8, 6).scale(0.6, 1.4, 0.6), lotus, Math.cos(k) * 0.05, 0.1, Math.sin(k) * 0.05); p.rotation.set(Math.sin(k) * 0.5, 0, Math.cos(k) * 0.5); f.add(p); } f.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), lotusC, 0, 0.12, 0)); f.position.set(lx, 0.03, lz); scene.add(f); }
    }
    room.nightParts.push((dt, t) => lilies.forEach((p, i) => { p.position.y = 0.035 + Math.sin(t * 1.2 + i) * 0.006; }));
    obst(px - ra, px + ra, pz - rb, pz + rb).water = true;
    excl.push([px, pz, 5.5]);
    // 연못가 나무 데크 + 벤치
    const deck = new THREE.Group();
    for (let i = 0; i < 7; i++) deck.add(mesh(rbox(0.26, 0.06, 1.6, 0.01), M.woodMid(), -0.8 + i * 0.27, 0.09, 0));
    deck.position.set(px - 1.2, 0, pz + rb + 1.1); scene.add(deck);
    bench(scene, room, px - 1.2, pz + rb + 1.5, Math.PI, 1.5, 2, { name: '연못가 벤치' });
    addSeat(room, px + 1.9, 0.12, pz + rb + 0.9, Math.PI, { name: '연못가 바위', kind: 'floor', appr: 0.5 });
    room.pond = V(px, 0, pz);
  }

  // ---------- 동쪽: 억새 언덕 ----------
  {
    const N = 1500;
    const blade = new THREE.ConeGeometry(0.025, 1, 3); blade.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(blade, windMat('#a7a27a', 0.12, room), N);
    const plume = new THREE.SphereGeometry(0.07, 6, 4); plume.scale(1, 3.2, 1); plume.translate(0, 0.2, 0);
    const pm = new THREE.InstancedMesh(plume, windMat('#efe6d0', 0.14, room), Math.floor(N / 3));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    let n = 0, k = 0;
    for (let i = 0; i < 6000 && n < N; i++) {
      const x = 52.5 + r() * 10, z = -5 + r() * 22;
      if (Math.abs(x - 59.9) < 0.9) continue;      // 길은 비워 둠
      if (Math.abs(z - 7.4) < 0.8 && x < 59) continue;
      const h = 0.9 + r() * 0.8;
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5));
      im.setMatrixAt(n, m4.compose(V(x, 0, z), q, V(1, h, 1)));
      im.setColorAt(n, col.set(r() < 0.5 ? '#a9a47c' : '#8e9a66').offsetHSL(0, 0, (r() - 0.5) * 0.08));
      if (n % 3 === 0 && k < pm.count) { pm.setMatrixAt(k, m4.compose(V(x, h - 0.05, z), q, V(1, 1, 1))); pm.setColorAt(k, col.set('#f3ead6').offsetHSL(0, 0, (r() - 0.5) * 0.05)); k++; }
      n++;
    }
    im.count = n; pm.count = k;
    im.userData.noHit = pm.userData.noHit = true;
    scene.add(im, pm);
    excl.push([57.5, 6, 11]);
    signpost(58.3, 8.6, [['억새 언덕', -Math.PI / 2], ['들꽃 언덕', Math.PI], ['연못', Math.PI / 2 - 0.1]]);
  }

  // ---------- 둘레길 들머리 안내판 ----------
  {
    const board = (x, z, rot) => {
      const g = new THREE.Group();
      for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 8), M.woodDark(), s * 0.55, 0.8, 0));
      const c = document.createElement('canvas'); c.width = 512; c.height = 288;
      const draw = () => {
        const p = c.getContext('2d');
        p.fillStyle = '#e9d6ad'; p.fillRect(0, 0, 512, 288);
        p.strokeStyle = '#7a5434'; p.lineWidth = 8; p.strokeRect(4, 4, 504, 280);
        p.fillStyle = '#4a3426'; p.textAlign = 'center';
        p.font = '700 48px "Gowun Batang", serif'; p.fillText('숲 둘레길', 256, 70);
        p.font = '28px "Gowun Dodum", sans-serif';
        ['한 바퀴 약 280 m · 천천히 3분', '등대 · 대나무 숲 · 자작나무 길', '연못 · 억새 언덕 · 바닷가', '🧭 가볼 곳 → 둘레길 한 바퀴'].forEach((t, i) => p.fillText(t, 256, 128 + i * 40));
      };
      draw();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.73), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide }));
      m.position.set(0, 1.25, 0.02); m.userData.noHit = true; g.add(m);
      g.position.set(x, 0, z); g.rotation.y = rot;
      scene.add(g);
      const sw = Math.abs(Math.sin(rot)) > 0.5;
      obst(x - (sw ? 0.12 : 0.7), x + (sw ? 0.12 : 0.7), z - (sw ? 0.7 : 0.12), z + (sw ? 0.7 : 0.12));
    };
    board(1.2, 24.0, 0);
    board(-22.8, 1.6, Math.PI / 2);
  }
}

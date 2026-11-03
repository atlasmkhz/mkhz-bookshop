// 야외 영화관: 숲 빈터의 천 스크린 + 통나무 · 빈백 · 캠핑 의자 자리 + 영사기 오두막 + 매표소(상영표)
// - 상영 목록은 data/program.json. 모든 손님이 같은 장면을 보도록 "지금 시각"으로 몇 번째 영상의 몇 분 지점인지 각자 계산 (서버 안 씀)
// - 3D 스크린에는 예고 영상(video/screen-loop.mp4, 있을 때)이나 글자 포스터가 보이고, 자리에 앉으면 유튜브 플레이어가 열림
import * as THREE from 'three';
import { M, rbox, mesh, plank, footprint, glowSprite } from './kit.js';
import { addSeat, cushion, beanbag } from './furniture.js';
import { campChair } from './cabin.js';
import { CONFIG } from './config.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

// ---------- 상영 시간표 ----------
export class Program {
  constructor() { this.data = { title: '엠케이아틀라스 채널 상영 중', items: [], playlist: '', channelUrl: '' }; this.ready = this.load(); }
  async load() {
    try { this.data = { ...this.data, ...(await fetch(CONFIG.cinema.program, { cache: 'no-cache' }).then((r) => r.json())) }; } catch { /* 기본값 */ }
    this.data.items = (this.data.items || []).filter((it) => it && it.id).map((it) => ({ id: String(it.id), title: String(it.title || ''), min: Math.max(0.5, +it.min || 5) }));
    return this.data;
  }
  // 지금 상영 중인 것: { kind: 'item' | 'playlist', id, title, offsetSec, index, next }
  now() {
    const d = this.data;
    const mins = Date.now() / 60000;
    if (d.items.length) {
      const total = d.items.reduce((s, it) => s + it.min, 0);
      let t = mins % total;
      for (let i = 0; i < d.items.length; i++) {
        const it = d.items[i];
        if (t < it.min) return { kind: 'item', id: it.id, title: it.title || `${i + 1}번째 영상`, offsetSec: Math.floor(t * 60), index: i, total: d.items.length, progress: t / it.min, next: d.items[(i + 1) % d.items.length] };
        t -= it.min;
      }
    }
    // 목록이 비어 있으면 채널 올린 영상을 15분마다 다음 것으로
    const slot = Math.floor(mins / 15);
    return { kind: 'playlist', id: d.playlist, title: d.title, offsetSec: 0, index: slot % 12, total: 12, progress: (mins % 15) / 15, next: null };
  }
  embedUrl() {
    const n = this.now();
    const base = 'https://www.youtube-nocookie.com/embed/';
    const common = 'autoplay=1&playsinline=1&rel=0&modestbranding=1&color=white';
    if (n.kind === 'item') return `${base}${encodeURIComponent(n.id)}?${common}&start=${n.offsetSec}`;
    if (!n.id) return '';
    return `${base}videoseries?list=${encodeURIComponent(n.id)}&index=${n.index}&${common}`;
  }
}

// ---------- 스크린 그림 ----------
function screenCanvas(program) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 576;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  let thumb = null, thumbId = null, lastKey = '';
  const draw = (night) => {
    const n = program.now();
    const key = n.kind + n.id + n.index + Math.floor(n.progress * 40) + (night > 0.5 ? 'n' : 'd') + (thumb ? 't' : '');
    if (key === lastKey) return;
    lastKey = key;
    g.fillStyle = night > 0.5 ? '#0d0b10' : '#efe7d8'; g.fillRect(0, 0, 1024, 576);
    if (thumb && thumbId === n.id) {
      try { g.globalAlpha = night > 0.5 ? 0.95 : 0.55; g.drawImage(thumb, 0, 0, 1024, 576); g.globalAlpha = 1; } catch { /* 무시 */ }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 430, 1024, 146);
    } else {
      // 글자 포스터: 필름 구멍 띠 + 제목
      g.fillStyle = night > 0.5 ? '#1c1822' : '#d9cdb5';
      g.fillRect(0, 0, 1024, 40); g.fillRect(0, 536, 1024, 40);
      g.fillStyle = night > 0.5 ? '#0d0b10' : '#efe7d8';
      for (let x = 20; x < 1024; x += 64) { g.fillRect(x, 10, 30, 20); g.fillRect(x, 546, 30, 20); }
      g.strokeStyle = night > 0.5 ? '#6b5a4a' : '#8a7a66'; g.lineWidth = 3;
      g.beginPath(); g.arc(512, 250, 110, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(470, 190); g.lineTo(470, 310); g.lineTo(580, 250); g.closePath(); g.fillStyle = night > 0.5 ? '#f3e6cf' : '#5a4636'; g.fill();
    }
    g.textAlign = 'center';
    g.fillStyle = night > 0.5 ? '#f7ecd8' : '#3f2c20';
    g.font = '700 46px "Gowun Batang", serif';
    const title = n.kind === 'item' ? n.title : (program.data.channelName || '엠케이아틀라스') + ' 채널';
    g.fillText(title.length > 26 ? title.slice(0, 25) + '…' : title, 512, 470);
    g.font = '28px "Gowun Dodum", sans-serif';
    g.fillStyle = night > 0.5 ? '#c9b89e' : '#7d6553';
    g.fillText(n.kind === 'item' ? `지금 상영 중 · ${n.index + 1} / ${n.total}` : '채널 영상 자동 상영 · 자리에 앉으면 재생돼요', 512, 515);
    // 진행 띠
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(112, 540, 800, 6);
    g.fillStyle = '#e0b35a'; g.fillRect(112, 540, 800 * n.progress, 6);
    tex.needsUpdate = true;
  };
  const loadThumb = () => {
    const n = program.now();
    if (n.kind !== 'item' || thumbId === n.id) return;
    thumbId = n.id; thumb = null;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { thumb = img; lastKey = ''; };
    img.onerror = () => { thumb = null; };
    img.src = `https://i.ytimg.com/vi/${encodeURIComponent(n.id)}/hqdefault.jpg`;
  };
  return { tex, draw, loadThumb };
}

export function buildCinema(scene, room, program, cx = 26, cz = 7.5) {
  const obst = (r) => room.obstacles.push(r);
  const g = new THREE.Group();
  // 스크린 기둥 · 천
  const postM = M.woodDark();
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.2, 10), postM, s * 3.4, 2.6, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 7.0, 6).rotateZ(Math.PI / 2), M.color('#d9c7a5'), 0, 4.9, 0));
  const sc = screenCanvas(program);
  const screenMat = new THREE.MeshStandardMaterial({ map: sc.tex, roughness: 0.85, emissive: '#ffffff', emissiveMap: sc.tex, emissiveIntensity: 0 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.49), screenMat);
  screen.position.set(0, 2.95, 0.03);
  screen.userData.cinema = true;
  g.add(screen);
  const back = mesh(new THREE.BoxGeometry(6.4, 3.7, 0.04), M.color('#f3ead8', 1), 0, 2.95, -0.01);
  back.userData.cinema = true;
  g.add(back);
  // 천 늘어진 느낌 (아래 주름)
  for (let i = 0; i < 6; i++) g.add(mesh(rbox(0.9, 0.18, 0.05, 0.03), M.color('#eadfca', 1), -2.6 + i * 1.04, 1.12, 0.02));
  const glow = glowSprite('#fff3d6', 9); glow.position.set(0, 3.0, 0.4); g.add(glow);
  const light = new THREE.PointLight('#fff1d6', 0, 14, 1.5);
  light.position.set(0, 3, 2.5);
  g.add(light);
  g.position.set(cx, 0, cz);
  scene.add(g);
  obst({ minX: cx - 3.6, maxX: cx + 3.6, minZ: cz - 0.3, maxZ: cz + 0.3 });
  room.screen = V(cx, 1.5, cz);

  // 예고 영상 자리 (있으면 스크린에 흐름)
  if (CONFIG.cinema.loop) {
    const vid = document.createElement('video');
    vid.muted = true; vid.loop = true; vid.playsInline = true; vid.preload = 'metadata'; vid.crossOrigin = 'anonymous';
    vid.src = CONFIG.cinema.loop;
    vid.addEventListener('canplay', () => {
      const vt = new THREE.VideoTexture(vid);
      vt.colorSpace = THREE.SRGBColorSpace;
      screenMat.map = vt; screenMat.emissiveMap = vt; screenMat.needsUpdate = true;
      sc.video = vid;
      vid.play().catch(() => { /* 사용자가 누른 뒤 재생 */ });
    }, { once: true });
    vid.addEventListener('error', () => { /* 파일이 없으면 글자 포스터 */ });
  }

  // 자리들 (스크린을 바라봄)
  const look = (x, z) => face(x, z, cx, cz);
  const seats = [];
  const tag = { cinema: true };
  // 1열 통나무
  for (const x of [cx - 2.4, cx, cx + 2.4]) {
    const lg = mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.6, 10).rotateZ(Math.PI / 2), M.color('#8b6a4a', 1), x, 0.22, cz + 2.4);
    scene.add(lg);
    obst(footprint(x, cz + 2.4, 1.6, 0.46));
    for (const s of [-0.4, 0.4]) seats.push(addSeat(room, x + s, 0.48, cz + 2.4, look(x + s, cz + 2.4), { name: '영화관 통나무', appr: -0.55, ...tag }));
  }
  // 2열 빈백
  for (let i = 0; i < 5; i++) { const x = cx - 3.0 + i * 1.5, z = cz + 4.0; seats.push(beanbag(scene, room, x, z, look(x, z), ['#d97c5c', '#e8c86a', '#7f97a8', '#a9bba0', '#c98f6b'][i], { name: '영화관 빈백', ...tag })); }
  // 3열 캠핑 의자
  for (let i = 0; i < 5; i++) { const x = cx - 3.2 + i * 1.6, z = cz + 5.6; seats.push(campChair(scene, room, x, z, look(x, z), ['#5f6b4e', '#d97c5c', '#7f97a8', '#e8c86a', '#a9bba0'][i], { name: '영화관 캠핑 의자', ...tag })); }
  // 4열 돗자리
  for (const x of [cx - 2.2, cx + 2.2]) {
    const b = mesh(rbox(1.8, 0.02, 1.3, 0.02), M.fabric(x < cx ? '#e8c86a' : '#7f97a8'), x, 0.085, cz + 7.2, { cast: false });
    scene.add(b);
    for (const s of [-0.45, 0.45]) seats.push(addSeat(room, x + s, 0.12, cz + 7.2, look(x + s, cz + 7.2), { name: '영화관 돗자리', kind: 'floor', appr: 0.5, ...tag }));
  }
  // 덤불 뒤 구석 (동쪽 끝)
  seats.push(cushion(scene, room, cx + 5.3, cz + 5.4, look(cx + 5.3, cz + 5.4), '#d9a07a', { name: '영화관 덤불 뒤 구석', nook: true, ...tag }));
  seats.push(cushion(scene, room, cx + 5.3, cz + 6.5, look(cx + 5.3, cz + 6.5), '#a9bba0', { name: '영화관 덤불 뒤 구석', nook: true, ...tag }));
  // 영사기 오두막 (뒤쪽) + 빛줄기
  {
    const h = new THREE.Group();
    plank(h, 1.6, 1.3, 1.2, 0, 0.65, 0, M.woodLight(), 0.03);
    const roof = mesh(new THREE.ConeGeometry(1.3, 0.6, 4), M.color('#8a4b36', 0.9), 0, 1.6, 0); roof.rotation.y = Math.PI / 4; h.add(roof);
    h.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 12).rotateX(Math.PI / 2), M.color('#4a4036', 0.4, { metalness: 0.5 }), 0, 1.0, -0.7));
    const lens = new THREE.MeshStandardMaterial({ color: '#fff6dd', emissive: '#fff1c8', emissiveIntensity: 0 });
    h.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12).rotateX(Math.PI / 2), lens, 0, 1.0, -0.86));
    const beamLen = 8.0;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.08, beamLen, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.rotation.x = Math.PI / 2 - 0.1;
    beam.position.set(0, 1.7, -0.9 - beamLen / 2);
    beam.userData.noHit = true;
    h.add(beam);
    h.position.set(cx, 0, cz + 9.3);
    scene.add(h);
    obst(footprint(cx, cz + 9.3, 1.7, 1.3));
    room.nightParts.push((dt, t, n) => { beam.material.opacity = n * 0.13 * (0.9 + Math.sin(t * 9) * 0.05); lens.emissiveIntensity = n * 2; });
  }
  // 매표소 · 상영표 (누르면 상영 목록)
  {
    const b = new THREE.Group();
    plank(b, 1.2, 1.0, 0.6, 0, 0.5, 0, M.woodMid(), 0.03);
    plank(b, 1.3, 0.05, 0.7, 0, 1.02, 0, M.wood(), 0.02);
    const c = document.createElement('canvas'); c.width = 320; c.height = 400;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const drawBoard = () => {
      const p = c.getContext('2d');
      p.fillStyle = '#3e3a36'; p.fillRect(0, 0, 320, 400);
      p.fillStyle = '#f2e7d3'; p.textAlign = 'center';
      p.font = '700 40px "Gowun Batang", serif'; p.fillText('숲속 영화관', 160, 62);
      p.font = '24px "Gowun Dodum", sans-serif';
      const n = program.now();
      const lines = ['상영 중', (n.kind === 'item' ? n.title : (program.data.channelName || '채널') + ' 영상').slice(0, 14), '', '입장 무료', '자리에 앉으면', '영상이 켜져요', '', '눌러서 상영표 보기'];
      lines.forEach((s, i) => p.fillText(s, 160, 120 + i * 34));
      tex.needsUpdate = true;
    };
    drawBoard();
    document.fonts?.ready.then(drawBoard);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshStandardMaterial({ map: tex }));
    board.position.set(0, 1.75, 0.0);
    b.add(board);
    b.add(mesh(rbox(0.06, 0.7, 0.06, 0.01), M.woodDark(), 0, 1.1, -0.1));
    b.traverse((o) => { o.userData.cinemaBoard = true; });
    b.position.set(cx - 5.2, 0, cz + 3.0);
    b.rotation.y = Math.PI / 2;
    scene.add(b);
    obst(footprint(cx - 5.2, cz + 3.0, 0.7, 1.3));
    room.cinemaBoard = V(cx - 4.3, 0, cz + 3.0);
    room.cinemaBoardRedraw = drawBoard;
  }
  // 입구 등불 줄
  const bulbs = [];
  for (const [x0, z0, x1, z1] of [[cx - 4.5, cz + 1.0, cx + 4.5, cz + 1.0], [cx - 4.5, cz + 8.5, cx + 4.5, cz + 8.5]]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(V(x0 + (x1 - x0) * t, 3.2 - Math.sin(t * Math.PI) * 0.35, z0 + (z1 - z0) * t));
      if (i > 0 && i < 14) { const m = new THREE.MeshStandardMaterial({ color: '#ffe3a0', emissive: '#ffcf7a', emissiveIntensity: 0.1 }); scene.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), m, pts[i].x, pts[i].y - 0.06, pts[i].z, { cast: false })); bulbs.push(m); }
    }
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.006, 4), M.color('#5a4636')));
    for (const [px, pz] of [[x0, z0], [x1, z1]]) { scene.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 8), M.woodDark(), px, 1.6, pz)); obst(footprint(px, pz, 0.14, 0.14)); }
  }
  let lastThumb = 0;
  room.nightParts.push((dt, t, n) => {
    screenMat.emissiveIntensity = 0.15 + n * 1.1;
    glow.material.opacity = n * 0.22;
    light.intensity = n * 4;
    bulbs.forEach((m, i) => { m.emissiveIntensity = 0.1 + n * (1.2 + Math.sin(t * 1.3 + i) * 0.3); });
    if (!sc.video) {
      if (t - lastThumb > 5) { lastThumb = t; sc.loadThumb(); }
      sc.draw(n);
    }
  });
  room.cinemaSeats = seats;
  return { seats, program };
}

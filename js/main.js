// 엠케이아틀라스 서점 — 시작 파일
// 고양이서가 카페 엔진(Three.js · 방 서버 · P2P 대체 · 낮밤 · 앉기 · 고양이 · 조작)을 가져와 서점으로 다시 지었습니다.
import * as THREE from 'three';
import { CONFIG, store } from './config.js';
import { IS_MOBILE } from './kit.js';
import { CABIN, WORLD, pushOut, findPath, buildNav, isOutdoor, levelOf, platformById } from './nav.js';
import { buildCabin } from './cabin.js';
import { buildForest, updateCanopies } from './forest.js';
import { setAtlases, finalizeBooks } from './shelves.js';
import { BookCats } from './cats.js';
import { Avatar, LOOKS } from './avatar.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';
import { Net } from './net.js';
import { NetServer, fetchRooms } from './netServer.js';
import { Controls } from './controls.js';
import { UI } from './ui.js';
import { cleanText, ChatLimiter, blocked } from './chat.js';

// ---------- 책 목록 ----------
let LIB = { atlases: [], shelves: [], books: [], count: 0 };
try { LIB = await fetch('data/books.json', { cache: 'no-cache' }).then((r) => r.json()); } catch (e) { console.warn('책 목록을 못 불러왔어요', e); }
LIB.books.forEach((b, i) => { b.no = LIB.books.slice(0, i).filter((x) => x.atlas === b.atlas).length + 1; });
setAtlases(LIB.atlases);
const bookById = new Map(LIB.books.map((b) => [b.id, b]));

// ---------- 렌더러 · 장면 ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE || window.devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const DAY_BG = new THREE.Color('#dfe3d2'), NIGHT_BG = new THREE.Color('#121829');
scene.background = DAY_BG.clone();
scene.fog = new THREE.Fog(DAY_BG.clone(), 26, 60);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 140);

const hemi = new THREE.HemisphereLight('#fff1dc', '#8a7a5a', 1.1);
scene.add(hemi);
const ambient = new THREE.AmbientLight('#ffe7cc', 0.22);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#ffe0b0', 2.5);
const SUN_OFFSET = new THREE.Vector3(-5, 12, -9);
sun.castShadow = true;
const SM = IS_MOBILE ? 1024 : 2048;
sun.shadow.mapSize.set(SM, SM);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 2, far: 45 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.025;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#fff4e4', 0.4);
fill.position.set(4, 8, 10);
scene.add(fill);

const room = buildCabin(scene, LIB.books);
buildForest(scene, room);
const shelfBooks = finalizeBooks(scene);
buildNav(room);
const fx = new FX(scene);
const sound = new Sound();
const cats = new BookCats(scene, room, fx, sound);
const ui = new UI();
ui.seatCount = room.seats.length;
room.seats.forEach((s, i) => { s.idx = i; });

// ---------- 나 ----------
const uid = store.get('uid', null) || Math.random().toString(36).slice(2, 10);
store.set('uid', uid);
const me = {
  name: store.get('name', ''),
  look: store.get('look', { top: LOOKS.tops[Math.floor(Math.random() * LOOKS.tops.length)], hair: LOOKS.hairs[0], skin: LOOKS.skins[0] }),
  drink: CONFIG.drinks.find((d) => d.id === store.get('drink', null)) || null,
  avatar: null, pos: room.spawn.clone(), yaw: Math.PI, route: [], target: null, seat: null, pending: null, speed: 0, hold: null, entered: false,
};
const remotes = new Map();

// ---------- 카메라 ----------
const cam = { yaw: 0.3, pitch: 0.8, dist: 15, target: new THREE.Vector3(-2, 1, 0) };
const fitDist = () => (camera.aspect < 1 ? 9.5 / Math.max(0.6, camera.aspect * 1.2) : 11);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 1 ? 46 : 36;
  camera.updateProjectionMatrix();
  cam.maxDist = fitDist() * 1.9;
  if (!cam.userZoomed) cam.dist = fitDist();
}
window.addEventListener('resize', resize);
resize();

function updateCamera(dt) {
  const want = me.entered ? me.pos.clone() : new THREE.Vector3(-2.5, 0, 0);
  want.x = THREE.MathUtils.clamp(want.x, WORLD.minX + 1, WORLD.maxX - 1);
  want.z = THREE.MathUtils.clamp(want.z, WORLD.minZ + 1, WORLD.maxZ - 1);
  want.y = (me.entered ? me.pos.y : 0) + 0.6;
  cam.target.lerp(want, 1 - Math.exp(-3 * dt));
  if (!me.entered) cam.yaw += dt * 0.05;
  const cp = Math.cos(cam.pitch);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * cp * cam.dist, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
  camera.lookAt(cam.target);
  room.viewCenter = cam.target;
}

// ---------- 잘라 보기: 카메라 쪽 벽 · 지붕 · 다락 ----------
function updateCutaway(dt) {
  const c = camera.position;
  const ref = me.entered ? me.pos : cam.target;
  const inside = !isOutdoor(ref) || !me.entered;
  for (const w of room.walls) {
    const sgn = w.normal.x + w.normal.z;
    const sc = ((Math.abs(w.normal.x) ? c.x : c.z) - w.at) * sgn;
    const sp = ((Math.abs(w.normal.x) ? ref.x : ref.z) - w.at) * sgn;
    const want = (sc > 0.3 && sp < 0.1) || (sc < -0.3 && sp > 0.1) ? 0 : 1;
    w.opacity += (want - w.opacity) * (1 - Math.exp(-8 * dt));
    if (Math.abs(w.opacity - want) < 0.01) w.opacity = want;
    const e = w.opacity * w.opacity * (3 - 2 * w.opacity);
    w.group.scale.y = Math.max(0.001, e);
    w.group.visible = w.opacity > 0.02;
  }
  room.roof.visible = me.entered && !inside;
  for (const b of room.beams) {
    const cc = b.axis === 'z' ? c.z : c.x, rr = b.axis === 'z' ? ref.z : ref.x;
    const lo = Math.min(cc, rr) - 0.6, hi = Math.max(cc, rr) + 0.6;
    b.m.visible = !(inside && b.at > lo && b.at < hi && Math.abs(b.at - rr) < 7);
  }
  const lv = me.entered ? levelOf(me.pos) : 0;
  for (const h of room.hideables) {
    const R = h.rect;
    const under = lv === 0 && ref.x > R.minX - 1 && ref.x < R.maxX + 1 && ref.z > R.minZ - 1 && ref.z < R.maxZ + 1.2;
    h.group.visible = !under;
    h.hidden = under;
  }
  if (room.gazebo) room.gazebo.roof.visible = Math.hypot(ref.x - room.gazebo.x, ref.z - room.gazebo.z) > room.gazebo.r + 0.4;
  if (room.treehouseRoof) room.treehouseRoof.visible = lv !== 2;
}

// ---------- 낮 · 밤 ----------
const hour = new Date().getHours();
const startNight = hour >= 19 || hour < 6 ? 1 : 0;
const dayNight = { night: startNight, target: startNight };
function updateDayNight(dt, t) {
  dayNight.night += (dayNight.target - dayNight.night) * (1 - Math.exp(-2 * dt));
  const n = dayNight.night;
  scene.background.copy(DAY_BG).lerp(NIGHT_BG, n);
  scene.fog.color.copy(scene.background);
  hemi.intensity = 1.1 - n * 0.82;
  hemi.color.set('#fff1dc').lerp(new THREE.Color('#7d88c0'), n);
  hemi.groundColor.set('#8a7a5a').lerp(new THREE.Color('#2b2626'), n);
  ambient.intensity = 0.22 - n * 0.1;
  sun.intensity = 2.5 - n * 2.2;
  sun.color.set('#ffe0b0').lerp(new THREE.Color('#9fb3ff'), n);
  fill.intensity = 0.4 - n * 0.28;
  cats.night = n;
  for (const fn of room.nightParts) fn(dt, t, n);
}

// ---------- 손님 목록 (고양이가 찾아갈 대상) ----------
cats.getGuests = () => {
  const list = [];
  if (me.entered) list.push({ id: uid, pos: me.pos });
  for (const [id, r] of remotes) list.push({ id, pos: r.pos });
  return list;
};

// ---------- 앉기 · 걷기 ----------
function standUp() {
  if (!me.seat) return;
  me.pos.copy(me.seat.appr);
  pushOut(room, me.pos, 0.22);
  me.seat.taken = null;
  me.seat = null;
}
function walkTo(p, pending = null) {
  standUp();
  const goal = p.clone();
  const wps = findPath(room, me.pos, goal);
  me.target = wps.shift();
  me.route = wps;
  me.pending = pending;
  const end = wps.length ? wps[wps.length - 1] : me.target;
  sendState(true, end || goal);
}
const seatTakenByOther = (seat) => { for (const r of remotes.values()) if (r.seat === seat.idx) return true; return false; };
const dampAngle = (a, b, k, dt) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * (1 - Math.exp(-k * dt)); };

function updateMe(dt) {
  if (!me.entered) return;
  const [ax, ay] = controls.axis();
  cam.yaw += controls.turn() * dt * 1.6;
  let moving = false;
  const SPEED = 2.0;
  if ((ax || ay) && !typing()) {
    standUp();
    me.target = null; me.pending = null; me.route = [];
    const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    const dir = fwd.multiplyScalar(ay).add(right.multiplyScalar(ax)).normalize();
    me.pos.addScaledVector(dir, SPEED * dt);
    me.yaw = dampAngle(me.yaw, Math.atan2(dir.x, dir.z), 12, dt);
    moving = true;
  } else if (me.hold) {
    const d = me.hold.clone().sub(me.pos).setY(0);
    if (d.length() > 0.15) {
      standUp();
      d.normalize();
      me.pos.addScaledVector(d, SPEED * dt);
      me.yaw = dampAngle(me.yaw, Math.atan2(d.x, d.z), 12, dt);
      moving = true;
    }
  } else if (me.target) {
    const d = me.target.clone().sub(me.pos).setY(0);
    const dist = d.length();
    if (dist < 0.07 || (me.route.length && dist < 0.3)) {
      me.target = me.route.shift() || null;
      if (!me.target) arrive();
    } else {
      d.normalize();
      const step = Math.min(dist, SPEED * dt);
      const before = me.pos.clone();
      me.pos.addScaledVector(d, step);
      me.yaw = dampAngle(me.yaw, Math.atan2(d.x, d.z), 12, dt);
      moving = true;
      pushOut(room, me.pos, 0.22);
      me.stuck = before.distanceTo(me.pos) < step * 0.2 ? (me.stuck || 0) + dt : 0;
      if (me.stuck > 0.5) { me.target = null; me.route = []; me.stuck = 0; arrive(); }
    }
  }
  if (!me.seat) pushOut(room, me.pos, 0.22);
  me.speed = moving ? SPEED : 0;
  // 키보드 · 꾹 누르기로 움직일 땐 1초에 3번까지만 위치를 보냄, 멈추면 한 번
  const manual = moving && !me.target;
  const nowMs = performance.now();
  if (manual && nowMs - (me.lastManualSend || 0) > 340) { me.lastManualSend = nowMs; sendState(); }
  if (!manual && me.wasManual) sendState(true);
  me.wasManual = manual;

  const a = me.avatar;
  if (me.seat) {
    me.pos.lerp(new THREE.Vector3(me.seat.pos.x, me.seat.fy, me.seat.pos.z), 1 - Math.exp(-12 * dt));
    me.yaw = dampAngle(me.yaw, me.seat.rotY, 10, dt);
  }
  a.root.position.copy(me.pos);
  if (me.seat) a.root.position.y = me.pos.y + (me.seat.pos.y - me.seat.fy - 0.38) * a.sitting;
  a.root.rotation.y = me.yaw;
  a.update(dt, me.speed, !!me.seat);
}

function arrive() {
  const p = me.pending;
  me.pending = null;
  if (!p) { sendState(true); return; }
  if (p.type === 'seat') {
    if (seatTakenByOther(p.seat)) { ui.toast('누군가 앉아 있어요'); sendState(true); return; }
    me.seat = p.seat;
    p.seat.taken = uid;
    if (p.seat.name) ui.toast(p.seat.nook ? `🤫 ${p.seat.name} — 잘 안 보이는 자리예요` : `${p.seat.name}에 앉았어요`);
    sendState(true);
  } else if (p.type === 'faceCat') {
    const c = cats.find(p.id);
    if (c) me.yaw = Math.atan2(c.pos.x - me.pos.x, c.pos.z - me.pos.z);
    sendState(true);
  } else if (p.type === 'counter') { sendState(true); openDrinks(); }
  else if (p.type === 'suggest') { sendState(true); ui.openSuggest(); }
  else sendState(true);
}

// ---------- 누르기 ----------
const raycaster = new THREE.Raycaster();
raycaster.camera = camera;
const ndc = new THREE.Vector2();
function usable(o) {
  if (o.isSprite || o.isPoints || o.isLine || o.isLineSegments || o.userData.noHit) return false;
  if (o.userData.catId) return false;
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  if (o.material && o.material.visible === false) return false;
  return true;
}
function pick(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  // 1) 고양이 (조금 빗나가도 잡아 줌)
  const catHits = raycaster.intersectObjects(cats.hitObjects(), false);
  if (catHits.length) return { kind: 'cat', id: catHits[0].object.userData.catId };
  const tol = IS_MOBILE ? 44 : 30;
  let best = null, bd = tol;
  for (const c of cats.cats) {
    const v = c.hit.getWorldPosition(new THREE.Vector3()).project(camera);
    if (v.z > 1) continue;
    const d = Math.hypot((v.x + 1) / 2 * window.innerWidth - x, (1 - v.y) / 2 * window.innerHeight - y);
    if (d < bd) { bd = d; best = c; }
  }
  if (best) return { kind: 'cat', id: best.def.id };
  // 2) 다른 손님
  const hits0 = [];
  for (const [id, r] of remotes) if (r.avatar.root.visible) { r.avatar.hit.userData.guest = id; hits0.push(r.avatar.hit); }
  const gh = raycaster.intersectObjects(hits0, false);
  // 3) 장면
  const hits = raycaster.intersectObjects(scene.children, true).filter((h) => usable(h.object));
  if (gh.length && (!hits.length || gh[0].distance < hits[0].distance + 0.3)) return { kind: 'guest', id: gh[0].object.userData.guest };
  if (!hits.length) return null;
  const h = hits[0];
  const o = h.object;
  if (o.userData.bookIds && h.faceIndex != null) return { kind: 'book', id: o.userData.bookIds[Math.floor(h.faceIndex / o.userData.trisPerBook)], point: h.point };
  if (o.userData.bookId) return { kind: 'book', id: o.userData.bookId, point: h.point };
  if (o.userData.counter) return { kind: 'counter', point: h.point };
  if (o.userData.suggest) return { kind: 'suggest', point: h.point };
  // 책등이 얇아 살짝 빗나가면 가장 가까운 책을 잡아 줌
  if (shelfBooks) {
    let bid = null, bdist = 0.28;
    for (const [id, wp] of shelfBooks.where) { const d = wp.distanceTo(h.point); if (d < bdist) { bdist = d; bid = id; } }
    if (bid) return { kind: 'book', id: bid, point: h.point };
  }
  return { kind: 'point', point: h.point, filler: !!o.userData.filler };
}

function onTap(x, y) {
  if (!me.entered) return;
  sound.ensure();
  const hit = pick(x, y);
  if (!hit) return;
  if (hit.kind === 'cat') { petCat(hit.id); return; }
  if (hit.kind === 'guest') { openGuest(hit.id); return; }
  if (hit.kind === 'book') { ui.openBook(hit.id); return; }
  if (hit.kind === 'counter') { goCounter(); return; }
  if (hit.kind === 'suggest') {
    if (me.pos.distanceTo(room.suggest) < 2.2) ui.openSuggest();
    else { walkTo(room.suggest, { type: 'suggest' }); ripple(room.suggest); }
    return;
  }
  const p = hit.point;
  const plv = p.y > 1.8 ? (levelOf(new THREE.Vector3(p.x, p.y + 0.1, p.z)) || levelOf(new THREE.Vector3(p.x, platformById(1).y, p.z))) : 0;
  // 앉을 자리 근처를 눌렀으면 앉기
  let best = null, bd = 0.6;
  for (const s of room.seats) {
    if (Math.abs(p.y - s.fy) > 1.3) continue;
    const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z);
    if (d < bd && (p.y > s.fy + 0.05 || s.kind === 'floor' && d < 0.4)) { bd = d; best = s; }
  }
  ui.hideCard();
  if (best && best !== me.seat) {
    walkTo(best.appr, { type: 'seat', seat: best });
    ripple(best.appr);
    return;
  }
  const lvY = plv ? platformById(plv).y : 0;
  const floorPt = new THREE.Vector3(p.x, lvY, p.z);
  walkTo(floorPt);
  ripple(floorPt);
}

function goCounter() {
  if (me.pos.distanceTo(room.counter) < 2.6) openDrinks();
  else { walkTo(room.counter, { type: 'counter' }); ripple(room.counter); ui.toast('카운터로 걸어가요 ☕'); }
}
function openDrinks(opts = {}) { ui.openDrinks({ ...opts, current: me.drink?.id }); }

let lastPet = 0;
function petCat(id) {
  const c = cats.find(id);
  if (!c) return;
  ui.showCat(c.def, () => giveTreat(id));
  if (performance.now() - lastPet < 700) return;
  lastPet = performance.now();
  cats.pet(id, me.pos.clone(), true);
  net.send({ t: 'pet', id, p: [+me.pos.x.toFixed(2), +me.pos.z.toFixed(2)] });
  if (!sound.enabled) ui.soundNudge();
  const d = c.pos.clone().setY(0).sub(me.pos.clone().setY(0));
  if (!me.seat && d.length() > 1.3 && c.pos.y < 0.5 && levelOf(me.pos) === 0) {
    walkTo(c.pos.clone().setY(0).sub(d.normalize().multiplyScalar(0.75)), { type: 'faceCat', id });
  } else if (!me.seat) me.yaw = Math.atan2(c.pos.x - me.pos.x, c.pos.z - me.pos.z);
}
let lastTreat = 0;
function giveTreat(id) {
  if (performance.now() - lastTreat < 3500) { ui.toast('천천히, 아직 먹는 중이에요'); return; }
  lastTreat = performance.now();
  cats.treat(id, me.pos.clone(), true);
  net.send({ t: 'treat', id, p: [+me.pos.x.toFixed(2), +me.pos.z.toFixed(2)] });
}

function openGuest(id) {
  const r = remotes.get(id);
  if (!r) return;
  const seat = room.seats[r.seat];
  ui.showGuest({ uid: id, name: r.name, drink: r.drink, seat: seat?.name, nook: seat?.nook, blocked: blocked.has(id) }, {
    wave: () => { me.avatar?.wave(); net.send({ t: 'wave' }); },
    block: () => { const on = blocked.toggle(id); applyBlock(r, id); return on; },
  });
}
function applyBlock(r, id) {
  const b = blocked.has(id);
  r.avatar.root.visible = !b;
  if (b) r.avatar.clearBubble();
}

// 누른 자리에 동그란 물결
const rippleMesh = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.19, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff5e0', transparent: true, opacity: 0, depthWrite: false }));
rippleMesh.renderOrder = 5;
rippleMesh.userData.noHit = true;
scene.add(rippleMesh);
let rippleT = 1;
function ripple(p) { if (!p) return; rippleMesh.position.set(p.x, p.y + 0.03, p.z); rippleT = 0; }

// ---------- 조작 ----------
const typing = () => document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
const controls = new Controls(canvas, {
  tap: onTap,
  drag: (dx, dy) => { cam.yaw -= dx * 0.0065; cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, 0.35, 1.3); },
  pinch: (s) => { cam.userZoomed = true; cam.dist = THREE.MathUtils.clamp(cam.dist * s, 4.5, cam.maxDist); },
  wheel: (dy) => { cam.userZoomed = true; cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + dy * 0.001), 4.5, cam.maxDist); },
  holdStart: (x, y) => { if (!me.entered) return; const h = floorAt(x, y); if (h) { me.hold = h; me.target = null; me.route = []; } },
  holdMove: (x, y) => { const h = floorAt(x, y); if (h) me.hold = h; },
  holdEnd: () => { me.hold = null; },
});
function floorAt(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -me.pos.y);
  return raycaster.ray.intersectPlane(plane, p) ? p : null;
}

// ---------- 네트워크 ----------
const SERVER = !!CONFIG.serverUrl;
let usingServer = SERVER;
const netHandlers = {
  onHost: (host) => { if (host) sendCatSync(); },
  onServerDown: () => switchToP2P(),
  onFull: () => { ui.toast('이 방이 가득 찼어요. 다른 방을 골라 주세요'); ui.reopenEntry(); },
  hello: () => helloMsg(),
  onStatus: (s) => ui.setStatus(s),
  onClientOpen: (send) => { send(helloMsg()); send({ t: 'cs', c: cats.syncMsg(), uid }); },
  onConnected: () => { net.send(helloMsg()); sendState(true); flushSuggestions(); },
  onMessage: (m) => handle(m),
};
let net = SERVER ? new NetServer(uid, netHandlers) : new Net(uid, netHandlers);

function switchToP2P() {
  if (!usingServer) return;
  usingServer = false;
  try { net.stop?.(); } catch { /* 무시 */ }
  for (const id of [...remotes.keys()]) dropRemote(id);
  net = new Net(uid, netHandlers);
  if (me.entered) net.start(me.roomNo ? `s${me.roomNo}` : undefined);
  ui.toast('서버가 붐벼서 손님끼리 직접 연결하는 방식으로 이어서 머물러요');
}

// 고양이 계획 보내기 (고양이 담당일 때, 다른 손님이 있을 때만)
cats.onPlan = (msg) => { if (remotes.size) net.send({ t: 'cq', ...msg }); };
let syncTimer = null;
function sendCatSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { if (cats.isHost && remotes.size) net.send({ t: 'cs', c: cats.syncMsg() }); }, 400);
}

function helloMsg() { return { t: 'hi', n: me.name, l: me.look, d: me.drink?.id || null, uid }; }
// 내 상태: p 지금 위치 [x, z, 방향, 높이], s 앉은 자리, g 걸어갈 목적지 [x, z, 높이]
// 움직이기 시작할 때 · 멈출 때 · 앉을 때만 보냄 (가만히 있으면 0번)
let lastSent = '';
function sendState(force = false, goal = null) {
  if (!me.entered) return;
  const st = [+me.pos.x.toFixed(2), +me.pos.z.toFixed(2), +me.yaw.toFixed(2), +me.pos.y.toFixed(2)];
  const seatIdx = me.seat ? me.seat.idx : -1;
  const g = goal ? [+goal.x.toFixed(2), +goal.z.toFixed(2), +goal.y.toFixed(2)] : null;
  const key = JSON.stringify([st, seatIdx, g]);
  if (!force && key === lastSent) return;
  lastSent = key;
  net.send({ t: 'st', p: st, s: seatIdx, g });
}

function getRemote(id) {
  let r = remotes.get(id);
  if (!r) {
    const avatar = new Avatar('손님', {});
    scene.add(avatar.root);
    r = { avatar, name: '손님', pos: room.spawn.clone(), yaw: Math.PI, tpos: room.spawn.clone(), tyaw: Math.PI, seat: -1, path: null, last: performance.now(), lookKey: '', drink: null };
    remotes.set(id, r);
    ui.setCount(remotes.size + 1);
    if (cats.isHost) sendCatSync();
  }
  r.last = performance.now();
  return r;
}
function dropRemote(id) {
  const r = remotes.get(id);
  if (!r) return;
  scene.remove(r.avatar.root);
  remotes.delete(id);
  ui.setCount(remotes.size + 1);
}

const isHex = (s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
const sanitizeLook = (l = {}) => ({ top: isHex(l.top) ? l.top : LOOKS.tops[0], hair: isHex(l.hair) ? l.hair : LOOKS.hairs[0], skin: isHex(l.skin) ? l.skin : LOOKS.skins[0] });
const drinkOf = (id) => CONFIG.drinks.find((d) => d.id === id) || null;
const near = (r) => Math.hypot(r.pos.x - me.pos.x, r.pos.z - me.pos.z) + Math.abs(r.pos.y - me.pos.y) * 2;

function handle(m) {
  if (!m || !m.t || m.uid === uid) return;
  switch (m.t) {
    case 'cq':
    case 'cs': {
      if (net.isHost) break;
      getRemote(m.uid);
      cats.isHost = false;
      if (m.t === 'cq') cats.applyPlan(m);
      else if (Array.isArray(m.c)) m.c.forEach((x) => cats.applyPlan(x));
      break;
    }
    case 'hi': {
      const r = getRemote(m.uid);
      const name = cleanText(String(m.n || '손님')).slice(0, 12) || '손님';
      const lookKey = JSON.stringify(m.l || {});
      if (lookKey !== r.lookKey || name !== r.name) {
        const fresh = new Avatar(name, sanitizeLook(m.l));
        scene.remove(r.avatar.root);
        r.avatar = fresh;
        scene.add(fresh.root);
        if (!r.lookKey && !blocked.has(m.uid)) ui.chatLine('', `${name} 님이 서점에 들어왔어요`, 'sys');
        r.lookKey = lookKey; r.name = name;
        applyBlock(r, m.uid);
      }
      r.drink = drinkOf(m.d);
      r.avatar.setDrink(r.drink);
      break;
    }
    case 'st': {
      const r = getRemote(m.uid);
      if (Array.isArray(m.p)) {
        const p = new THREE.Vector3(+m.p[0] || 0, +m.p[3] || 0, +m.p[1] || 0);
        r.tyaw = +m.p[2] || 0;
        if (Array.isArray(m.g)) {
          if (r.pos.distanceTo(p) > 1.2) r.pos.copy(p);
          const goal = new THREE.Vector3(+m.g[0] || 0, +m.g[2] || 0, +m.g[1] || 0);
          r.path = findPath(room, r.pos, goal);
          r.tpos.copy(goal);
        } else { r.path = null; r.tpos.copy(p); }
      }
      r.seat = Number.isInteger(m.s) && room.seats[m.s] ? m.s : -1;
      break;
    }
    case 'chat': {
      const r = remotes.get(m.uid);
      if (!r || blocked.has(m.uid)) break;
      if (near(r) > CONFIG.chatRange) break;
      const text = cleanText(m.m);
      if (!text) break;
      r.avatar.say(text);
      ui.chatLine(r.name, text);
      break;
    }
    case 'gift': {
      if (m.to !== uid || blocked.has(m.uid)) break;
      const d = drinkOf(m.d);
      const r = remotes.get(m.uid);
      if (!d) break;
      setDrink(d);
      ui.toast(`☕ ${r?.name || '손님'} 님이 ${d.name}를 건넸어요`);
      ui.chatLine('', `${r?.name || '손님'} 님에게서 ${d.name} 선물`, 'sys');
      fx.hearts(me.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 3);
      break;
    }
    case 'pet': cats.pet(m.id, Array.isArray(m.p) ? new THREE.Vector3(m.p[0], 0, m.p[1]) : null, false); break;
    case 'treat': cats.treat(m.id, Array.isArray(m.p) ? new THREE.Vector3(m.p[0], 0, m.p[1]) : null, false); break;
    case 'wave': { const r = remotes.get(m.uid); if (r && !blocked.has(m.uid)) r.avatar.wave(); break; }
    case 'bye': dropRemote(m.uid); break;
  }
}

function updateRemotes(dt) {
  const now = performance.now();
  for (const [id, r] of remotes) {
    if (!usingServer && now - r.last > 20000) { dropRemote(id); continue; }
    const before = r.pos.clone();
    if (r.path && r.path.length) {
      const tgt = r.path[0];
      const d = tgt.clone().sub(r.pos).setY(0);
      const dist = d.length();
      if (dist < 0.08) r.path.shift();
      else {
        r.pos.addScaledVector(d.normalize(), Math.min(dist, 2.0 * dt));
        pushOut(room, r.pos, 0.22);
        r.yaw = dampAngle(r.yaw, Math.atan2(d.x, d.z), 12, dt);
      }
    } else {
      if (r.pos.distanceTo(r.tpos) > 4) r.pos.copy(r.tpos);
      r.pos.lerp(r.tpos, 1 - Math.exp(-8 * dt));
      if (r.pos.distanceTo(r.tpos) < 0.05) r.yaw = dampAngle(r.yaw, r.tyaw, 10, dt);
      else r.yaw = dampAngle(r.yaw, Math.atan2(r.tpos.x - r.pos.x, r.tpos.z - r.pos.z), 10, dt);
    }
    const seat = room.seats[r.seat];
    const speed = before.distanceTo(r.pos) / Math.max(dt, 1e-3);
    if (seat && (!r.path || !r.path.length)) { r.pos.lerp(new THREE.Vector3(seat.pos.x, seat.fy, seat.pos.z), 1 - Math.exp(-10 * dt)); r.yaw = dampAngle(r.yaw, seat.rotY, 10, dt); }
    r.avatar.root.position.copy(r.pos);
    if (seat) r.avatar.root.position.y = r.pos.y + (seat.pos.y - seat.fy - 0.38) * r.avatar.sitting;
    r.avatar.root.rotation.y = r.yaw;
    r.avatar.update(dt, speed > 0.2 ? speed : 0, !!seat && (!r.path || !r.path.length));
    // 숨은 자리에 앉은 손님은 가까이 가야 이름이 보임
    const dd = near(r);
    const hiddenSpot = seat?.nook && dd > 4;
    r.avatar.setLabelVisible(!hiddenSpot && dd < 18);
    // 2층이 접혀 있으면 그 위 손님도 잠시 숨김
    const lv = levelOf(r.pos);
    const hideLv = lv && room.hideables.some((h) => h.lv === lv && h.hidden);
    r.avatar.root.visible = !blocked.has(id) && !hideLv;
  }
  for (const s of room.seats) s.remoteTaken = false;
  for (const r of remotes.values()) if (room.seats[r.seat]) room.seats[r.seat].remoteTaken = true;
}

// ---------- 채팅 · 음료 · 건의함 ----------
const limiter = new ChatLimiter();
ui.onChatSend = (raw) => {
  if (!me.entered) return '먼저 들어와 주세요';
  const text = cleanText(raw);
  if (!text) return '보낼 말이 없어요';
  const err = limiter.check(text);
  if (err) return err;
  me.avatar.say(text);
  ui.chatLine(me.name, text, 'me');
  // 가까운 사람이 없으면 보내지 않음 (무료 한도 아끼기)
  const anyone = [...remotes.values()].some((r) => near(r) <= CONFIG.chatRange + 2);
  if (anyone) net.send({ t: 'chat', m: text });
  else if (remotes.size) ui.chatLine('', '가까이 아무도 없어서 혼잣말이 되었어요', 'sys');
  return null;
};
function setDrink(d) {
  me.drink = d;
  store.set('drink', d?.id || null);
  me.avatar?.setDrink(d);
  net.send(helloMsg());
}
ui.onDrinkPick = (d) => {
  setDrink(d);
  if (d) { ui.toast(`☕ ${d.name} 한 잔 받았어요`); fx.text(me.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), d.name, '#8a5a35'); }
};
ui.onDrinkButton = () => goCounter();
ui.nearbyGuests = () => [...remotes.entries()].filter(([id, r]) => !blocked.has(id) && near(r) < 12).map(([id, r]) => ({ uid: id, name: r.name }));
let lastGift = 0;
ui.onGift = (to, d) => {
  if (performance.now() - lastGift < 4000) { ui.toast('선물은 조금 천천히요'); return false; }
  lastGift = performance.now();
  net.send({ t: 'gift', to, d: d.id });
  const r = remotes.get(to);
  if (r) fx.hearts(r.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 3);
  return true;
};
ui.onBookOpen = () => { sound.ensure(); sound.pageTurn(); };
ui.canWalkTo = (id) => !!shelfBooks?.where.get(id);
ui.onWalkToBook = (id) => {
  const p = shelfBooks.where.get(id);
  if (!p) return;
  const lvY = p.y > 2.6 ? platformById(1).y : 0;
  walkTo(new THREE.Vector3(p.x, lvY, p.z));
  ui.toast('책이 꽂힌 자리로 걸어가요');
};
ui.onSheet = () => { /* 판을 여는 동안에도 장면은 그대로 */ };

// 건의함: 서버에 저장. 서버가 없거나 막히면 이 브라우저에 모아 두었다가 다음에 보냄
async function postSuggestion(item) {
  if (!CONFIG.serverUrl) throw new Error('no server');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  const r = await fetch(CONFIG.serverUrl.replace(/\/$/, '') + '/suggest', {
    method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify(item), signal: ctl.signal,
  }).finally(() => clearTimeout(timer));
  if (r.status === 429) { const e = new Error('slow'); e.slow = true; throw e; }
  if (!r.ok) throw new Error('status ' + r.status);
  return r.json();
}
ui.onSuggest = async (text, name) => {
  const item = { m: text.slice(0, 600), n: (name || '').slice(0, 20), room: me.roomNo || 0, t: Date.now() };
  try { await postSuggestion(item); return { ok: true }; } catch (e) {
    if (e.slow) return { ok: false, error: '오늘은 이미 여러 번 넣으셨어요. 내일 다시 들러 주세요' };
    const q = store.get('suggestQueue', []);
    q.push(item);
    store.set('suggestQueue', q.slice(-10));
    return { ok: true, queued: true };
  }
};
async function flushSuggestions() {
  const q = store.get('suggestQueue', []);
  if (!q.length || !CONFIG.serverUrl) return;
  const rest = [];
  for (const it of q) { try { await postSuggestion(it); } catch { rest.push(it); } }
  store.set('suggestQueue', rest);
}

// ---------- 화면 UI 연결 ----------
ui.onEnter = async ({ name, look, soundOn, room: roomChoice }) => {
  me.name = name; me.look = look;
  ui.myName = name;
  store.set('name', name); store.set('look', look);
  if (me.avatar) scene.remove(me.avatar.root);
  me.avatar = new Avatar(name, look);
  me.avatar.setDrink(me.drink);
  scene.add(me.avatar.root);
  me.entered = true;
  if (soundOn) { sound.setEnabled(true); sound.setNight(dayNight.target); ui.setSound(true); }
  if (usingServer) {
    let n = roomChoice;
    let ok = true;
    if (!n) { try { const info = await fetchRooms(); n = info.best || 1; } catch { ok = false; n = 1; } }
    me.roomNo = n;
    ui.setRoom(n);
    if (ok) { net.stopped = false; net.failures = 0; net.start(n); } else switchToP2P();
  } else net.start(me.roomNo ? `s${me.roomNo}` : undefined);
  ui.showHint(IS_MOBILE
    ? ['톡: 걸어가기 · 의자를 누르면 앉아요', '책등을 누르면 책이 펼쳐져요', '끌어서 둘러보기 · 두 손가락으로 크게 작게', '숲으로 난 문은 오른쪽(동쪽)에 있어요']
    : ['바닥을 누르면 걸어가요 (WASD도 돼요)', '책등을 누르면 책이 펼쳐져요 · Enter 로 말하기', '끌어서 둘러보기 · 휠로 크게 작게', '숲으로 난 문은 오른쪽(동쪽)에 있어요']);
  walkTo(room.firstWalk);
};
ui.loadRooms = SERVER ? fetchRooms : null;
ui.onToggleRain = () => {
  room.rainOn = !room.rainOn;
  cats.rain = room.rainOn;
  sound.setRain(room.rainOn);
  store.set('rain', room.rainOn);
  return room.rainOn;
};
cats.birdsPresent = () => room.birdsPresent?.();
ui.onToggleNight = () => { dayNight.target = dayNight.target > 0.5 ? 0 : 1; sound.setNight(dayNight.target); return dayNight.target > 0.5; };
ui.onToggleSound = () => { const on = !sound.enabled; sound.setEnabled(on); sound.setNight(dayNight.target); return on; };
ui.onWave = () => { if (!me.entered) return; me.avatar?.wave(); net.send({ t: 'wave' }); };
ui.init({ name: me.name, look: me.look, night: dayNight.target > 0.5, server: SERVER, rain: store.get('rain', false), lib: LIB });
room.rainOn = cats.rain = store.get('rain', false);
sound.setRain(room.rainOn);
document.getElementById('loading').classList.add('gone');

// ---------- 가까이 있는 고양이 위에 「쓰다듬기」 ----------
const tmpV = new THREE.Vector3();
function updatePetBubble() {
  if (!me.entered) { ui.petBubble(null); return; }
  let best = null, bd = 1.8;
  for (const c of cats.cats) {
    const d = Math.hypot(c.pos.x - me.pos.x, c.pos.z - me.pos.z) + Math.max(0, Math.abs(c.pos.y - me.pos.y) - 1);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) { ui.petBubble(null); return; }
  best.model.headWorld(tmpV);
  tmpV.y += 0.28;
  tmpV.project(camera);
  if (tmpV.z > 1) { ui.petBubble(null); return; }
  ui.petBubble({ id: best.def.id, name: best.def.name, x: (tmpV.x + 1) / 2 * window.innerWidth, y: (1 - tmpV.y) / 2 * window.innerHeight });
}
ui.onPetBubble = (id) => petCat(id);

window.addEventListener('pagehide', () => { try { net.send({ t: 'bye' }); } catch { /* 무시 */ } });

// ---------- P2P 모드에서만: 2~3초마다 짧은 안부 (서버 모드는 주기적으로 보내는 것 없음) ----------
let tick = 0;
setInterval(() => {
  tick++;
  if (usingServer || !me.entered) return;
  if (tick % 2 === 0) sendState(true);
  if (tick % 3 === 0) net.send(helloMsg());
}, 1000);

// ---------- 그리기 반복 ----------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  updateDayNight(dt, t);
  updateMe(dt);
  const shouldHost = remotes.size === 0 || net.isHost;
  if (shouldHost !== cats.isHost) {
    if (shouldHost) cats.adopt();
    cats.isHost = shouldHost;
    if (shouldHost) sendCatSync();
  }
  cats.update(dt, t);
  updateRemotes(dt);
  fx.update(dt);
  if (rippleT < 1) {
    rippleT += dt * 1.6;
    rippleMesh.material.opacity = (1 - rippleT) * 0.8;
    rippleMesh.scale.setScalar(1 + rippleT * 1.5);
  } else rippleMesh.material.opacity = 0;
  updateCamera(dt);
  updateCutaway(dt);
  if (me.entered) {
    updateCanopies(room, me.pos, camera.position, dt);
    const out = isOutdoor(me.pos);
    sound.setOutdoor(out);
    if (room.stream && out) sound.setWater(1 - Math.abs(me.pos.x - room.stream.x(me.pos.z)) / 9);
    else sound.setWater(0);
  }
  updatePetBubble();
  sun.target.position.set(cam.target.x, 0, cam.target.z);
  sun.position.copy(sun.target.position).add(SUN_OFFSET);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 디버그용 (콘솔에서 window.shop)
window.shop = { scene, camera, room, me, cats, get net() { return net; }, cam, dayNight, onTap, pick, remotes, walkTo, switchToP2P, LIB, CABIN };

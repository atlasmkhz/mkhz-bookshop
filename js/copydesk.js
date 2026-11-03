// 책상 자리 「필사하기」 — 철학아틀라스 「오늘의 필사」(data/copynote.json)를 공책에 옮겨 쓰기
// - 오늘 편 = (한국 날짜 일련번호) % 편수. 철학아틀라스 사이트와 같은 날 같은 편이 뜹니다.
// - 따라 쓰기: 입력하면 사각사각 필기 소리 + 공책에 손글씨 + 펜이 글자를 따라감
// - 소리만 듣기: 손이 저절로 한 글자씩 써 내려감 (필기 소리 듣기)
// - 내 화면에서만 (메시지 0건). 다 쓴 편은 이 브라우저의 「내 필사 공책」에 남음
import * as THREE from 'three';
import { store } from './config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => String(s || '').replace(/\s+/g, '');
const $ = (q) => document.querySelector(q);
export const kstDay = (now = Date.now()) => Math.floor((now + 9 * 3600 * 1000) / 86400000);

const PW = 1024, PH = 640;   // 공책 그림 크기 (양쪽 면)

export class CopyDesk {
  constructor(scene, sound, fx) {
    this.scene = scene; this.sound = sound; this.fx = fx;
    this.notes = [];
    this.on = false;
    this.auto = false;
    this.ready = fetch('data/copynote.json', { cache: 'no-cache' }).then((r) => r.json()).then((d) => { this.notes = d.notes || []; this.site = d.site; }).catch(() => {});
    // 펼친 공책 + 펜
    this.canvas = document.createElement('canvas'); this.canvas.width = PW; this.canvas.height = PH;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.book = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.012, 0.31), new THREE.MeshStandardMaterial({ color: '#6d4630', roughness: 0.8 }));
    cover.position.y = 0.006; this.book.add(cover);
    const pages = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.29).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.95 }));
    pages.position.y = 0.0135; this.book.add(pages);
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.29, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9b79a' }));
    spine.position.y = 0.014; this.book.add(spine);
    this.pen = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0055, 0.14, 8), new THREE.MeshStandardMaterial({ color: '#23303f', roughness: 0.4, metalness: 0.3 }));
    body.position.y = 0.07; this.pen.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.014, 8).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: '#c9a45a', metalness: 0.6, roughness: 0.3 }));
    tip.position.y = -0.007; this.pen.add(tip);
    this.pen.rotation.set(0.5, 0, -0.35);
    this.book.add(this.pen);
    this.book.visible = false;
    this.book.traverse((o) => { o.userData.noHit = true; });
    scene.add(this.book);
    this.penAt = new THREE.Vector3(0.12, 0.014, 0);
    this.lastInk = 0;
    this.wire();
  }

  todayIndex() { return this.notes.length ? kstDay() % this.notes.length : 0; }

  wire() {
    $('#cpClose').addEventListener('click', () => this.onClose?.());
    $('#cpPrev').addEventListener('click', () => this.go(this.ni - 1));
    $('#cpNext').addEventListener('click', () => this.go(this.ni + 1));
    $('#cpToday').addEventListener('click', () => this.go(this.todayIndex()));
    $('#cpMode').addEventListener('click', () => this.setAuto(!this.auto));
    $('#cpBook').addEventListener('click', () => this.onNotebook?.(this.saved()));
    const ta = $('#cpInput');
    ta.addEventListener('input', () => this.typed());
    ta.addEventListener('keydown', (e) => e.stopPropagation());
  }

  // 책상 자리에 앉아 필사 시작
  async open(seat) {
    await this.ready;
    if (!this.notes.length) return false;
    this.seat = seat;
    const f = new THREE.Vector3(Math.sin(seat.rotY), 0, Math.cos(seat.rotY));
    this.book.position.set(seat.pos.x + f.x * seat.desk.d, seat.fy + seat.desk.h + 0.002, seat.pos.z + f.z * seat.desk.d);
    this.book.rotation.y = seat.rotY + Math.PI;
    this.book.visible = true;
    this.on = true;
    document.body.classList.add('copying');
    $('#copyPanel').classList.add('show');
    this.go(this.todayIndex());
    this.sound.pageTurn?.(0.8);
    return true;
  }
  close() {
    this.on = false;
    this.setAuto(false, true);
    this.book.visible = false;
    document.body.classList.remove('copying');
    $('#copyPanel').classList.remove('show');
    $('#cpInput').blur();
  }

  go(i) {
    const N = this.notes.length;
    this.ni = ((i % N) + N) % N;
    this.note = this.notes[this.ni];
    this.pi = 0;
    this.done = this.note.bodyKo.map(() => '');
    this.startT = performance.now();
    this.renderHead();
    this.loadPara();
    this.sound.pageTurn?.(0.6);
  }

  renderHead() {
    const n = this.note, today = this.ni === this.todayIndex();
    $('#cpKicker').textContent = `✍️ ${today ? '오늘의 필사' : '지난 필사'} · ${n.no}/${this.notes.length} · ${n.themeKo}`;
    $('#cpOrigin').textContent = n.origin && n.origin !== n.ko ? n.origin : '';
    $('#cpKo').textContent = n.ko;
    $('#cpSrc').textContent = `— ${n.srcKo}`;
    $('#cpLink').href = n.url;
    $('#cpToday').style.display = today ? 'none' : '';
  }

  loadPara() {
    const ta = $('#cpInput');
    ta.value = this.done[this.pi] || '';
    this.prevLen = norm(ta.value).length;
    this.autoPos = norm(ta.value).length;
    this.renderPara();
    this.drawPage();
  }

  // 단락을 글자마다: 쓴 곳(맞으면 먹색, 다르면 붉은 밑줄) · 안 쓴 곳(연하게)
  renderPara() {
    const target = this.note.bodyKo[this.pi];
    const typed = norm(this.done[this.pi]);
    let k = 0, html = '';
    for (const ch of target) {
      if (/\s/.test(ch)) { html += ch; continue; }
      const t = typed[k];
      html += t == null ? `<span class="todo">${esc(ch)}</span>` : t === ch ? `<span class="ok">${esc(ch)}</span>` : `<span class="bad">${esc(ch)}</span>`;
      k++;
    }
    const last = this.pi === this.note.bodyKo.length - 1;
    const doneAll = this.done.every((d, i) => norm(d).length >= norm(this.note.bodyKo[i]).length);
    $('#cpPara').innerHTML = html;
    $('#cpStep').textContent = `단락 ${this.pi + 1} / ${this.note.bodyKo.length}`;
    $('#cpQ').textContent = doneAll || last ? `질문 — ${this.note.qKo}` : '';
    const tot = norm(this.note.bodyKo.join('')).length, got = this.done.reduce((a, d) => a + norm(d).length, 0);
    $('#cpBar').style.width = `${Math.min(100, (got / tot) * 100).toFixed(1)}%`;
  }

  // 따라 쓰기: 새로 쓴 글자만큼 사각사각
  typed() {
    const ta = $('#cpInput');
    this.done[this.pi] = ta.value;
    const len = norm(ta.value).length;
    const add = len - this.prevLen;
    this.prevLen = len;
    if (add > 0) { this.sound.pen?.(Math.min(add, 4)); this.inked(); }
    this.renderPara();
    this.drawPage();
    this.checkPara();
  }

  checkPara() {
    const target = norm(this.note.bodyKo[this.pi]);
    if (norm(this.done[this.pi]).length < target.length) return;
    if (this.pi < this.note.bodyKo.length - 1) {
      clearTimeout(this.nextT);
      this.nextT = setTimeout(() => { if (!this.on) return; this.pi++; this.sound.pageTurn?.(0.5); this.loadPara(); if (!this.auto) $('#cpInput').focus(); }, this.auto ? 1400 : 700);
    } else this.finish();
  }

  finish() {
    const n = this.note;
    const list = this.saved();
    const chars = norm(n.bodyKo.join('')).length;
    const ok = this.done.reduce((a, d, i) => { const t = norm(n.bodyKo[i]), u = norm(d); let c = 0; for (let k = 0; k < t.length; k++) if (u[k] === t[k]) c++; return a + c; }, 0);
    const min = Math.max(1, Math.round((performance.now() - this.startT) / 60000));
    if (!this.auto) {
      list.unshift({ id: n.id, no: n.no, ko: n.ko, src: n.srcKo, theme: n.themeKo, url: n.url, day: new Date().toISOString().slice(0, 10), acc: Math.round(ok / chars * 100), min });
      store.set('copybook', list.slice(0, 200));
    }
    this.onFinish?.(n, this.auto ? null : { acc: Math.round(ok / chars * 100), min, count: list.length });
    this.setAuto(false, true);
  }
  saved() { const v = store.get('copybook', []); return Array.isArray(v) ? v : []; }

  // 소리만 듣기: 저절로 써 내려감
  setAuto(on, quiet = false) {
    this.auto = on;
    clearTimeout(this.autoT);
    $('#cpMode').textContent = on ? '✍️ 직접 따라 쓰기' : '🎧 소리만 듣기';
    $('#copyPanel').classList.toggle('auto', on);
    if (on) { $('#cpInput').blur(); this.autoStep(); }
    else if (!quiet && this.on) $('#cpInput').focus();
  }
  autoStep() {
    if (!this.on || !this.auto) return;
    const target = this.note.bodyKo[this.pi];
    const plain = norm(target);
    if (this.autoPos >= plain.length) { this.checkPara(); this.autoT = setTimeout(() => this.autoStep(), 1500); return; }
    // 다음 글자를 원문 띄어쓰기 그대로 이어 붙임
    let k = 0, out = '';
    for (const ch of target) { if (/\s/.test(ch)) { if (k > 0 && k <= this.autoPos) out += ch; continue; } if (k >= this.autoPos + 1) break; out += ch; k++; }
    this.autoPos++;
    this.done[this.pi] = out;
    $('#cpInput').value = out;
    this.prevLen = this.autoPos;
    const ch = plain[this.autoPos - 1];
    if (/[.,!?。、·…—]/.test(ch)) this.sound.penDot?.(); else this.sound.pen?.(1);
    this.inked();
    this.renderPara();
    this.drawPage();
    const pause = /[.!?。]/.test(ch) ? 650 : /[,、·]/.test(ch) ? 380 : 140 + Math.random() * 140;
    this.autoT = setTimeout(() => this.autoStep(), pause);
  }

  inked() { this.lastInk = performance.now(); this.onInk?.(); }

  // 공책 그리기: 왼쪽 면 = 원문 · 우리말 · 출처, 오른쪽 면 = 지금 단락을 쓴 만큼 (손글씨)
  drawPage() {
    const g = this.canvas.getContext('2d');
    g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, PW, PH);
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(PW / 2 - 3, 0, 6, PH);
    g.strokeStyle = 'rgba(110,140,190,0.35)'; g.lineWidth = 2;
    for (let y = 92; y < PH - 20; y += 46) { g.beginPath(); g.moveTo(30, y); g.lineTo(PW / 2 - 24, y); g.moveTo(PW / 2 + 24, y); g.lineTo(PW - 30, y); g.stroke(); }
    const n = this.note;
    const wrap = (text, x, y, w, lh, font, color, maxLines = 99) => {
      g.font = font; g.fillStyle = color;
      let line = '', lines = 0, last = { x, y };
      for (const ch of text) {
        const test = line + ch;
        if (g.measureText(test).width > w && line) { g.fillText(line, x, y); last = { x: x + g.measureText(line).width, y }; line = ch; y += lh; if (++lines >= maxLines) return last; }
        else line = test;
      }
      if (line) { g.fillText(line, x, y); last = { x: x + g.measureText(line).width, y }; }
      return last;
    };
    g.textBaseline = 'alphabetic';
    let y = 80;
    if (n.origin && n.origin !== n.ko) { wrap(n.origin, 44, y, PW / 2 - 90, 44, '34px "Gowun Batang", serif', '#5a4636', 2); y += 92; }
    wrap(n.ko, 44, y, PW / 2 - 90, 46, '40px "Nanum Pen Script", "Gowun Dodum", sans-serif', '#2c3550', 4);
    g.font = '26px "Gowun Dodum", sans-serif'; g.fillStyle = '#7d6553'; g.fillText(`— ${n.srcKo}`.slice(0, 26), 44, PH - 40);
    g.fillText(`${this.pi + 1}/${n.bodyKo.length}`, PW - 90, 50);
    const text = this.done[this.pi] || '';
    const end = wrap(text, PW / 2 + 40, 84, PW / 2 - 80, 46, '42px "Nanum Pen Script", "Gowun Dodum", sans-serif', '#1f2a55', 12);
    this.tex.needsUpdate = true;
    // 펜 끝을 마지막 글자 자리로 (공책 판 좌표: 가로 0.45 · 세로 0.29)
    const u = text ? end.x / PW : 0.56, v = text ? (end.y - 12) / PH : 0.14;
    this.penAt.set(-0.225 + u * 0.45, 0.014, -0.145 + v * 0.29);
  }

  update(dt) {
    if (!this.on) return;
    const writing = performance.now() - this.lastInk < 400;
    const t = performance.now() / 1000;
    const wob = writing ? Math.sin(t * 40) * 0.0025 : 0;
    const p = this.pen.position;
    p.x += (this.penAt.x + wob - p.x) * Math.min(1, dt * 14);
    p.z += (this.penAt.z + (writing ? Math.cos(t * 33) * 0.002 : 0) - p.z) * Math.min(1, dt * 14);
    p.y += ((writing ? 0.014 : 0.03) - p.y) * Math.min(1, dt * 10);
  }
}

// 화면 위 UI: 입장 · 안내 · 펼친 책 · 책바구니 · 음료 · 건의함 · 채팅 (안내는 화면 위에 짧게)
import * as THREE from 'three';
import { LOOKS, Avatar } from './avatar.js';
import { CONFIG, store } from './config.js';
import { coverHTML } from './covers.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  init({ name, look, firstLook, night, server, rain, lib }) {
    this.look = { ...look };
    this.server = server;
    this.lib = lib;
    this.atlas = Object.fromEntries(lib.atlases.map((a) => [a.id, a]));
    this.byId = new Map(lib.books.map((b) => [b.id, b]));
    this.basket = store.get('basket', []).filter((id) => this.byId.has(id));
    this.read = store.get('read', {});
    if (server) { $('#roomField').classList.remove('hidden'); this.refreshRooms(); }
    $('#entryInfo').textContent = `가입 없이 닉네임만 · 책 ${lib.count}권 · 앉을 자리 ${this.seatCount || 100}곳`;
    this.setRain(rain);
    $('#btnRain').addEventListener('click', () => {
      const on = this.onToggleRain?.();
      this.setRain(on);
      this.toast(on ? '☔ 창밖에 비가 와요' : '☀️ 비가 그쳤어요');
    });
    $('#petBubble').addEventListener('click', () => { if (this.bubbleId) this.onPetBubble?.(this.bubbleId); });
    $('#fireLog').addEventListener('click', () => { if (this.fireId) this.onFireLog?.(this.fireId); });
    $('#fireGaze').addEventListener('click', () => { if (this.fireId) this.onFireGaze?.(this.fireId); });
    $('#gazeLog').addEventListener('click', () => this.onGazeLog?.());
    $('#gazeExit').addEventListener('click', () => this.onGazeExit?.());
    $('#gazeConst').addEventListener('click', () => { const on = this.onConst?.(); $('#gazeConst').textContent = on ? '✨ 별자리 끄기' : '✨ 별자리 보기'; });
    $('#starChip').addEventListener('click', () => this.onStarGaze?.());
    $('#gameStop').addEventListener('click', () => this.onGameStop?.());
    $('#nameInput').value = name || '';
    this.swatches('#topSwatches', LOOKS.tops, 'top');
    this.swatches('#hairSwatches', LOOKS.hairs, 'hair');
    this.swatches('#skinSwatches', LOOKS.skins, 'skin');
    this.swatches('#bcSwatches', LOOKS.bottoms, 'bc');
    this.chips('#hsChips', LOOKS.hairStyles, 'hs');
    this.chips('#btChips', LOOKS.bottomStyles, 'bt');
    this.chips('#acChips', LOOKS.accs, 'ac');
    this.startPreview();
    // 꾸미기는 접어 두고(미리 보기만 작게), 「🎨 꾸미기」를 누르면 펼침
    $('#lookNote').textContent = firstLook ? '처음 모습은 알아서 골라 두었어요' : '지난번 모습 그대로예요';
    $('#btnCustom').addEventListener('click', () => {
      const open = $('#lookBox').classList.toggle('closed') === false;
      $('#btnCustom').textContent = open ? '🎨 접기' : '🎨 꾸미기';
      $('#btnCustom').setAttribute('aria-expanded', String(open));
    });
    $('#enterForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = $('#nameInput').value.trim().slice(0, 12);
      if (!n) { $('#nameInput').focus(); $('#nameInput').classList.add('shake'); setTimeout(() => $('#nameInput').classList.remove('shake'), 400); return; }
      this.stopPreview();
      $('#entry').classList.add('gone');
      $('#hud').classList.remove('hidden');
      this.onEnter?.({ name: n, look: this.look, soundOn: $('#soundOnEnter').checked, room: +$('#roomSelect').value || null });
    });
    this.setNight(night);
    $('#btnNight').addEventListener('click', () => this.setNight(this.onToggleNight?.()));
    $('#btnSound').addEventListener('click', () => this.setSound(this.onToggleSound?.()));
    $('#btnMusic').addEventListener('click', () => { const on = this.onToggleMusic?.(); this.setMusic(on); this.toast(on ? '🎵 배경 음악을 켰어요 (고양이서가 카페 음악)' : '🎵 배경 음악을 껐어요 — 장작 · 빗소리 · 연필 소리는 그대로'); });
    $('#btnWave').addEventListener('click', () => this.onWave?.());
    $('#btnDance').addEventListener('click', () => this.onDance?.());
    $('#btnPlaces').addEventListener('click', () => this.openPlaces());
    $('#btnMyCat').addEventListener('click', () => this.openMyCat());
    $('#playerClose').addEventListener('click', () => this.hidePlayer(true));
    $('#playerSize').addEventListener('click', () => { $('#player').classList.toggle('big'); $('#playerSize').textContent = $('#player').classList.contains('big') ? '작게' : '크게'; });
    $('#btnBasket').addEventListener('click', () => this.openBasket());
    $('#btnDrink').addEventListener('click', () => this.onDrinkButton?.());
    $('#btnChat').addEventListener('click', () => this.toggleChat());
    $('#cardClose').addEventListener('click', () => this.hideCard());
    $('#gGo').addEventListener('click', () => this.onGuideGo?.());
    $('#gSkip').addEventListener('click', () => this.onGuideSkip?.());
    $('#gStop').addEventListener('click', () => this.onGuideStop?.());
    $('#guideAgain').addEventListener('click', () => this.onGuideAgain?.());
    $('#sheetClose').addEventListener('click', () => this.closeSheet());
    $('#sheetBody').addEventListener('scroll', (e) => { if (this.sheetKind === 'basket') this.scrollKeep = e.target.scrollTop; }, { passive: true });
    $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') this.closeSheet(); });
    $('#chatBar').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('#chatInput').value.trim();
      if (!v) return;
      const err = this.onChatSend?.(v);
      if (err) { this.toast(err); return; }
      $('#chatInput').value = '';
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (!$('#sheet').classList.contains('hidden')) this.closeSheet(); else if (!$('#chatBar').classList.contains('hidden')) this.toggleChat(false); else this.hideCard(); }
      if (e.key === 'Enter' && !e.target.closest?.('input, textarea, select, button') && !$('#hud').classList.contains('hidden') && $('#sheet').classList.contains('hidden')) { e.preventDefault(); this.toggleChat(true); }
    });
    this.updateBadge();
    this.setCount(1);
  }

  swatches(sel, colors, key) {
    const box = $(sel);
    box.innerHTML = '';
    colors.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw' + (this.look[key] === c ? ' on' : '');
      b.style.background = c;
      b.setAttribute('aria-label', c);
      b.addEventListener('click', () => {
        this.look[key] = c;
        box.querySelectorAll('.sw').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        this.refreshPreview();
      });
      box.appendChild(b);
    });
    if (!colors.includes(this.look[key])) { this.look[key] = colors[0]; box.firstChild.classList.add('on'); }
  }

  // 글자 단추 고르기 (머리 모양 · 아래옷 · 소품)
  chips(sel, list, key) {
    const box = $(sel);
    box.innerHTML = '';
    if (!list.some(([k]) => k === this.look[key])) this.look[key] = list[0][0];
    for (const [k, label] of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.className = this.look[key] === k ? 'on' : '';
      b.addEventListener('click', () => { this.look[key] = k; box.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); this.refreshPreview(); });
      box.appendChild(b);
    }
  }
  // 들어가기 전 내 모습 미리 보기 (작은 그림판 하나, 들어가면 치움)
  startPreview() {
    const cv = $('#lookPreview');
    if (!cv) return;
    try {
      const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      r.setSize(90, 115, false);
      r.outputColorSpace = THREE.SRGBColorSpace;
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight('#fff1dc', '#8a7a5a', 1.6));
      const dl = new THREE.DirectionalLight('#ffe8c8', 1.6); dl.position.set(1.5, 3, 2.5); sc.add(dl);
      const cam = new THREE.PerspectiveCamera(30, 90 / 115, 0.1, 20);
      cam.position.set(0, 0.95, 3.1); cam.lookAt(0, 0.68, 0);
      this.pv = { r, sc, cam, av: null, t: 0, last: performance.now() };
      this.refreshPreview();
      const tick = () => {
        if (!this.pv) return;
        const now = performance.now(), dt = Math.min(0.05, (now - this.pv.last) / 1000); this.pv.last = now;
        this.pv.t += dt;
        if (this.pv.av) { this.pv.av.root.rotation.y = Math.sin(this.pv.t * 0.6) * 0.6; this.pv.av.update(dt, 0, false); }
        this.pv.r.render(this.pv.sc, this.pv.cam);
        this.pv.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch { cv.style.display = 'none'; }
  }
  refreshPreview() {
    if (!this.pv) return;
    if (this.pv.av) this.pv.sc.remove(this.pv.av.root);
    const a = new Avatar('', this.look);
    a.dispose();   // 이름표는 쓰지 않음
    this.pv.sc.add(a.root);
    this.pv.av = a;
  }
  stopPreview() {
    if (!this.pv) return;
    cancelAnimationFrame(this.pv.raf);
    try { this.pv.r.dispose(); this.pv.r.forceContextLoss(); } catch { /* 무시 */ }
    this.pv = null;
  }

  async refreshRooms() {
    if (!this.loadRooms) return;
    const sel = $('#roomSelect');
    try {
      const info = await this.loadRooms();
      const keep = sel.value;
      sel.innerHTML = '';
      const auto = document.createElement('option');
      auto.value = '';
      auto.textContent = info.best ? `빈자리 있는 방으로 (${info.best}호점)` : '빈자리 있는 방으로';
      sel.appendChild(auto);
      for (const r of info.rooms) {
        const o = document.createElement('option');
        o.value = r.n;
        const full = r.count >= info.cap;
        o.textContent = `${r.n}호점 · ${r.count}/${info.cap}명${full ? ' (가득)' : ''}`;
        o.disabled = full;
        sel.appendChild(o);
      }
      sel.value = keep;
    } catch (e) {
      console.warn('방 목록을 못 불러왔어요', e);
    }
  }
  reopenEntry() { $('#hud').classList.add('hidden'); $('#entry').classList.remove('gone'); this.refreshRooms(); }
  setRoom(n) { $('#roomNo').innerHTML = n ? `${n}호<span class="long">점</span>` : ''; }   // 휴대폰에선 「1호」
  setRain(on) { $('#btnRain').classList.toggle('off', !on); $('#btnRain').title = on ? '비 그치게 하기' : '빗소리'; }
  setNight(on) { $('#btnNight').textContent = on ? '🌙' : '☀️'; $('#btnNight').title = on ? '밤 (누르면 낮)' : '낮 (누르면 밤)'; }
  setMusic(on) { $('#btnMusic').classList.toggle('off', !on); $('#btnMusic').title = on ? '배경 음악 끄기' : '배경 음악 켜기'; $('#btnMusic').textContent = on ? '🎵' : '🔇'; }
  setSound(on) { $('#btnSound').textContent = on ? '🔊' : '🔈'; $('#btnSound').classList.toggle('off', !on); }
  soundNudge() {
    if (this.nudged) return;
    this.nudged = true;
    this.toast('🔈 소리를 켜면 골골송이 들려요');
    $('#btnSound').classList.add('pulse');
    setTimeout(() => $('#btnSound').classList.remove('pulse'), 3000);
  }
  setStatus(s) { this.status = s; $('#statusDot').className = 'dot ' + s; this.renderCount(); }
  // 첫 방문 길잡이 카드 (그림 위 · 위쪽 가운데)
  guideShow({ n, total, title, line, done }) {
    $('#gStep').textContent = done ? '끝' : `${n}/${total}`;
    $('#gTitle').textContent = title;
    $('#gLine').textContent = line;
    $('#gStop').textContent = done ? '닫기' : '그만 보기';
    $('#guide').classList.toggle('done', !!done);
    $('#guide').classList.add('show');
    document.body.classList.add('guiding');
  }
  guideHide() { $('#guide').classList.remove('show'); document.body.classList.remove('guiding'); }
  setCount(n) { this.count = n; this.renderCount(); }
  renderCount() {
    const s = this.status;
    $('#count').innerHTML = s === 'offline' ? '혼자<span class="long"> 읽는 중</span>' : s === 'reconnecting' ? '<span class="long">연결 중</span>…' : `${this.count}명`;
  }

  showHint(lines) {
    const el = $('#hint');
    let i = 0;
    clearTimeout(this.hintTimer);
    const next = () => {
      if (i >= lines.length) { el.classList.remove('show'); return; }
      el.textContent = lines[i++];
      el.classList.add('show');
      this.hintTimer = setTimeout(next, 3400);
    };
    next();
  }
  toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => el.classList.remove('show'), 2800);
  }

  petBubble(info) {
    const el = $('#petBubble');
    const hide = !info || ($('#card').classList.contains('show') && this.cardCat === info.id) || !$('#sheet').classList.contains('hidden');
    if (hide) { el.classList.remove('show'); this.bubbleId = null; return; }
    this.bubbleId = info.id;
    el.style.left = info.x + 'px';
    el.style.top = info.y + 'px';
    el.querySelector('span').textContent = `${info.name} 쓰다듬기`;
    el.classList.add('show');
  }

  // 모닥불 곁에 서면 뜨는 단추 (장작 넣기 · 불멍)
  fireBar(info) {
    const el = $('#fireBar');
    const hide = !info || !$('#sheet').classList.contains('hidden') || $('#card').classList.contains('show');
    if (hide) { el.classList.remove('show'); this.fireId = null; return; }
    this.fireId = info.id;
    el.style.left = info.x + 'px';
    el.style.top = info.y + 'px';
    el.classList.add('show');
  }
  // 불멍 화면: 단추들을 숨기고 가장자리를 어둡게
  setGaze(on, name, mode = 'fire') {
    document.body.classList.toggle('gazing', !!on);
    $('#gazeLog').style.display = mode === 'fire' ? '' : 'none';
    $('#gazeConst').style.display = mode === 'star' ? '' : 'none';
    if (on) $('#gazeInfo').textContent = mode === 'star' ? '🌌 별멍 중' : mode === 'wood' ? '🪚 목공 멍 중' : `🔥 ${name} 불멍 중`;
  }
  gazeInfo(text) { $('#gazeInfo').textContent = text; }

  // ---------- 캣타워 제품 카드 ----------
  // 캣타워 놀이터 카드 (제품 이름과 크기만 — 사러 가는 링크는 카운터 한켠 안내판에만)
  showProduct(p, h = {}) {
    this.cardCat = null;
    const toy = h.toy ? CONFIG.toys.find((t) => t.id === h.toy) : null;
    $('#cardBody').innerHTML = `
      <div class="card-kicker">🐈 고양이서가 캣타워</div>
      <div class="card-title">${esc(p.name)}</div>
      <div class="card-desc">${esc(p.desc)}</div>
      <div class="row">
        <button class="btn primary" id="pHide" type="button">🔍 숨은 아깽이 찾기</button>
        <button class="btn" id="pCall" type="button">${toy ? `${toy.ico} 고양이 불러 놀기` : '🐾 고양이 불러 놀기'}</button>
      </div>
      ${toy ? '' : '<p class="note" style="margin-top:8px">카운터에서 장난감을 빌려 오면 고양이가 캣타워 위에서 더 신나게 뛰어요.</p>'}`;
    $('#pHide').addEventListener('click', () => { this.hideCard(); h.onHide?.(); });
    $('#pCall').addEventListener('click', () => { this.hideCard(); h.onCall?.(); });
    this.openCard();
  }
  // 카운터 한켠 「고양이서가」 안내판
  showStore() {
    this.cardCat = null;
    const st = CONFIG.store || {};
    $('#cardBody').innerHTML = `
      <div class="card-kicker">건의함 위</div>
      <div class="card-title">${esc(st.name || '고양이서가')}</div>
      <div class="card-desc">이 서점의 캣타워 여섯 가지(집사4호 · 커스텀B · 벨라4호 · 계단형 숨숨집 · 오르미 · 월스텝 선반)는 모두 고양이서가에서 만든 원목 캣타워예요. 고양이들이 매일 오르내리며 써 보고 있어요.</div>
      <a class="btn" href="${esc(st.url || '#')}" target="_blank" rel="noopener" style="width:100%">고양이서가 둘러보기 ↗</a>`;
    this.openCard();
  }
  showSupport() {
    this.cardCat = null;
    $('#cardBody').innerHTML = `
      <div class="card-kicker">카운터 한켠</div>
      <div class="card-title">💗 서점지기 응원하기</div>
      <div class="card-desc">커피 한 잔으로 서점을 응원해 주세요.</div>
      <a class="btn primary" href="${esc(CONFIG.support?.kakao || '#')}" target="_blank" rel="noopener" style="width:100%">카카오페이로 응원하기 ↗</a>`;
    this.openCard();
  }
  // 놀이 안내 막대 (숨은 아깽이 찾기)
  gameBar(text, onStop) {
    const el = $('#gameBar');
    if (!text) { el.classList.remove('show'); return; }
    $('#gameText').textContent = text;
    this.onGameStop = onStop || this.onGameStop;
    el.classList.add('show');
  }
  starChip(show) { $('#starChip').classList.toggle('show', !!show); }
  // 폭죽 고르기
  openFireworks(kinds, onPick) {
    this.sheetKind = 'fireworks';
    this.openSheet(`<h2>🎆 바닷가 폭죽 놀이</h2><p class="note">고르면 발사 통에 불을 붙여 바다 위로 쏘아 올려요. 같은 방의 밤 손님들도 같은 불꽃을 봐요. 한 번 쏘고 3초 쉬어요.</p>
      <div class="drinks">${kinds.map((k) => `<button type="button" class="drink" data-k="${k.id}"><b>${k.ico} ${esc(k.name)}</b><span>${esc(k.note)}</span></button>`).join('')}</div>`);
    document.querySelectorAll('#sheetBody [data-k]').forEach((el) => el.addEventListener('click', () => { this.closeSheet(); onPick(el.dataset.k); }));
  }

  // ---------- 영화관: 상영표 · 플레이어 ----------
  openProgram(program) {
    this.sheetKind = 'program';
    const d = program.data, n = program.now();
    const items = d.items.length ? d.items.map((it, i) => `<li><a href="https://www.youtube.com/watch?v=${esc(it.id)}" target="_blank" rel="noopener"><span>${esc(it.title || it.id)}${i === n.index && n.kind === 'item' ? ' <em style="color:var(--wood);font-style:normal">· 지금 상영 중</em>' : ''}</span><span class="done" style="color:var(--ink-soft)">${it.min}분</span></a></li>`).join('') : '';
    this.openSheet(`
      <h2>숲속 영화관 상영표</h2>
      <p class="note">${esc(d.channelName || '엠케이아틀라스')} 채널 영상이 하루 종일 돌아가요. 모든 손님이 같은 장면을 봐요. 자리에 앉으면 화면 위에 영상이 켜져요 (소리는 켜는 사람에게만).</p>
      <p class="note" style="margin:8px 0 12px"><b style="font-weight:400;color:var(--wood-dark)">지금:</b> ${esc(n.kind === 'item' ? n.title : (d.channelName || '채널') + ' 올린 영상 차례로')} </p>
      ${items ? `<ol class="toc">${items}</ol>` : '<div class="empty">아직 대표 영상 모음이 없어서 채널에 올린 영상을 차례로 틀어요.<br>서점지기가 data/program.json 에 목록을 적으면 여기에 보여요.</div>'}
      <p style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="${esc(d.channelUrl || '#')}" target="_blank" rel="noopener">채널 가기 ↗</a><button class="btn primary" type="button" id="prGo">자리로 걸어가기</button></p>`);
    $('#prGo').addEventListener('click', () => { this.closeSheet(); this.onGoCinema?.(); });
  }
  showPlayer(url, title) {
    if (!url) { this.toast('상영할 영상이 없어요'); return; }
    const el = $('#player');
    const fr = $('#playerFrame');
    if (fr.src !== url) fr.src = url;
    $('#playerTitle').textContent = title || '상영 중';
    el.classList.remove('hidden');
    this.playerOn = true;
  }
  hidePlayer(byUser = false) {
    const el = $('#player');
    el.classList.add('hidden');
    $('#playerFrame').src = 'about:blank';
    this.playerOn = false;
    if (byUser) this.toast('자리에서 일어나면 다시 켤 수 있어요 · 영화관 의자를 다시 누르세요');
  }

  // ---------- 가볼 곳 ----------
  openPlaces() {
    this.sheetKind = 'places';
    const list = this.places || [];
    this.openSheet(`<h2>어디로 갈까</h2><p class="note">누르면 그곳까지 걸어가요. 길이 갈라지는 곳마다 이정표가 있어요.</p>
      <div class="places">${list.map((p, i) => `<button type="button" data-p="${i}"><span class="ico">${p.ico}</span><b>${esc(p.name)}</b><span>${esc(p.note)}</span></button>`).join('')}</div>`);
    document.querySelectorAll('#sheetBody [data-p]').forEach((el) => el.addEventListener('click', () => { this.closeSheet(); this.onGoPlace?.(list[+el.dataset.p]); }));
  }

  // ---------- 우리 집 고양이 입장시키기 ----------
  // 미술관 작품 카드: 크게 보기 · 하트 · 신고 (신고는 한 번 더 눌러야 보냄)
  showArt(a, h) {
    this.cardCat = null;
    const left = a.queue > 0 && a.until ? Math.max(0, Math.round((a.until - Date.now()) / 60000)) : null;
    $('#cardBody').innerHTML = `
      <div class="card-kicker">🖼️ MK 갤러리 · ${a.no}번 벽</div>
      <img class="art-img" src="${esc(a.img)}" alt="${esc(a.title || '무제')} — ${esc(a.name || '손님')} 님이 찍은 사진" />
      <div class="card-title">${esc(a.title || '무제')}</div>
      <div class="card-desc">${esc(a.name || '손님')} 님이 찍은 사진 · 👁 <span id="artViews">${a.views || 0}</span>명 · ❤ <span id="artHearts">${a.hearts || 0}</span>${left != null ? ` · 약 ${left}분 뒤 다음 작품과 교대` : ''}</div>
      <div class="row">
        <button class="btn primary" id="artHeart" type="button" ${a.hearted ? 'disabled' : ''}>${a.hearted ? '❤ 하트를 보냈어요' : '❤ 하트'}</button>
        <button class="btn ghost" id="artReport" type="button">🚩 신고</button>
      </div>
      <p class="note" id="artMsg" style="margin-top:6px"></p>`;
    $('#artHeart').addEventListener('click', async () => { if (await h.heart()) { $('#artHearts').textContent = (a.hearts || 0) + 1; $('#artHeart').textContent = '❤ 하트를 보냈어요'; $('#artHeart').disabled = true; } });
    let armed = false;
    $('#artReport').addEventListener('click', async () => {
      if (!armed) { armed = true; $('#artReport').textContent = '🚩 정말 신고할까요? 한 번 더 누르기'; $('#artMsg').textContent = '야하거나 폭력적인 사진, 남의 사진을 퍼 온 것 같을 때 신고해 주세요. 여러 분이 신고하면 자동으로 내려가요.'; return; }
      $('#artReport').disabled = true;
      const r = await h.report();
      $('#artMsg').textContent = r.msg || (r.ok ? '신고를 받았어요' : '신고를 보내지 못했어요');
    });
    this.openCard();
    clearTimeout(this.cardT);
    this.cardT = setTimeout(() => this.hideCard(), 30000);
  }

  // 미술관 작품 올리기
  openArtUpload(st, onSubmit) {
    this.sheetKind = 'artup';
    this.openSheet(`<h2>📷 MK 갤러리에 작품 올리기</h2>
      ${st.on ? '' : '<p class="note" style="color:#b4462e">미술관 서버가 아직 열리지 않아 지금은 올릴 수 없어요. 서점지기가 서버를 열면 바로 쓸 수 있어요.</p>'}
      <p class="note">직접 찍은 사진 한 장을 30개 벽 가운데 한 곳에 걸어요. 기다리는 작품이 있으면 한 시간씩 교대하고, 없으면 계속 걸려 있어요. 본 사람 수와 하트가 이름표에 보여요.</p>
      <ul class="note art-rules">
        <li>올리면 자동 검사기가 먼저 봐요. 야하거나 폭력적인 사진은 걸리지 않아요.</li>
        <li>걸린 뒤에도 서로 다른 다섯 분이 신고하면 자동으로 내려가요. 두 번 내려가면 한 달 동안 올릴 수 없어요.</li>
        <li>사진은 긴 쪽 1280px로 줄여서 보내요. 이때 사진 속 위치 정보(GPS)가 지워져요.</li>
        <li>한 사람이 한 번에 한 작품, 하루 세 장까지예요.</li>
      </ul>
      <label class="btn" style="margin:8px 0">🖼️ 사진 고르기<input id="auFile" type="file" accept="image/*" hidden /></label>
      <div id="auPrev" class="au-prev"></div>
      <label class="field"><span>작품 이름</span><input id="auTitle" maxlength="24" placeholder="예: 비 갠 오후의 책방" /></label>
      <label class="field" style="margin-top:8px"><span>찍은 사람</span><input id="auName" maxlength="12" value="${esc(st.name || '')}" /></label>
      <label class="check" style="margin-top:10px"><input type="checkbox" id="auOwn" /> 제가 직접 찍은 사진이에요</label>
      <label class="check"><input type="checkbox" id="auOk" /> 사진에 나온 분들께 걸어도 된다고 허락받았어요 (사람이 없으면 체크)</label>
      <p style="margin-top:12px"><button class="btn primary" type="button" id="auGo" ${st.on ? '' : 'disabled'}>올리기</button></p>
      <p class="note" id="auMsg"></p>`);
    let file = null;
    $('#auFile').addEventListener('change', (e) => {
      file = e.target.files?.[0] || null;
      if (!file) return;
      const u = URL.createObjectURL(file);
      $('#auPrev').innerHTML = `<img src="${u}" alt="고른 사진 미리 보기" />`;
    });
    $('#auGo').addEventListener('click', async () => {
      const msg = $('#auMsg');
      if (!file) { msg.textContent = '사진을 먼저 골라 주세요'; return; }
      if (!$('#auOwn').checked || !$('#auOk').checked) { msg.textContent = '두 가지 확인란에 체크해 주세요'; return; }
      $('#auGo').disabled = true; msg.textContent = '사진을 줄이고 자동 검사를 하는 중이에요…';
      const r = await onSubmit({ file, title: $('#auTitle').value.trim(), name: $('#auName').value.trim() });
      msg.textContent = r.msg || (r.ok ? '올렸어요!' : '올리지 못했어요');
      if (!r.ok) $('#auGo').disabled = false;
    });
  }

  // 내 필사 공책 (이 브라우저에만 저장)
  // ---------- 목공방 나무 다듬기 판 ----------
  craftPanel(show, craft, crafts, h = {}) {
    const p = $('#craftPanel');
    if (!show) { p.classList.remove('show'); return; }
    if (!this._crBound) {
      this._crBound = true;
      $('#crClose').addEventListener('click', () => this.onCraftExit?.());
      $('#crHit').addEventListener('pointerdown', (e) => { e.preventDefault(); this.onCraftHit?.(); });
      $('#crGaze').addEventListener('click', () => this.onCraftGaze?.());
      $('#crForm').addEventListener('submit', (e) => { e.preventDefault(); const err = this.onChatSend?.($('#crInput').value); if (err) this.toast(err); else $('#crInput').value = ''; });
    }
    $('#crTools').innerHTML = crafts.map((c) => `<button type="button" data-k="${c.id}" class="${c.id === craft.kind ? 'on' : ''}">${c.ico} ${c.name}</button>`).join('');
    document.querySelectorAll('#crTools [data-k]').forEach((b) => b.addEventListener('click', () => this.onCraftKind?.(b.dataset.k)));
    p.classList.add('show');
    this.craftUpdate(craft);
  }
  craftChat(name, text, kind = '') {
    const box = $('#crChat');
    const d = document.createElement('div');
    if (kind) d.className = kind;
    d.innerHTML = `<b>${esc(name)}</b>${esc(text)}`;
    box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
  }
  spaceTag(text) { const t = $('#spaceTag'); t.textContent = text; t.classList.toggle('show', !!text); }
  craftUpdate(craft, res = null) {
    const d = craft.def;
    $('#crTitle').textContent = `${d.name} · ${d.job}`;
    $('#crCount').textContent = `${craft.points} / ${d.goal}`;
    $('#crProg').style.width = `${(craft.points / d.goal) * 100}%`;
    $('#crHit').textContent = `${d.ico} ${d.verb}`;
    const cb = $('#crCombo');
    if (res?.done) { cb.textContent = `🎉 ${res.done.done} 완성!`; cb.classList.add('good'); }
    else if (res) { cb.textContent = res.good ? `좋아요! ${craft.combo > 1 ? `· ${craft.combo}번 연속` : ''}` : '조금 일찍 · 늦게 — 초록 칸에서 눌러 봐요'; cb.classList.toggle('good', res.good); }
    else { cb.textContent = '초록 칸에서 누르면 「좋아요!」 — 두 칸씩'; cb.classList.remove('good'); }
    $('#crMade').textContent = craft.madeLine();
  }
  craftNeedle(v) { const n = $('#crNeedle'); if (n) n.style.left = `${(v * 100).toFixed(1)}%`; }

  // ---------- 독서 모임 방 단체 채팅 ----------
  clubOpen(topic) {
    if (!this._clBound) {
      this._clBound = true;
      $('#clForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = $('#clInput').value;
        const err = this.onChatSend?.(v);
        if (err) this.toast(err); else $('#clInput').value = '';
      });
      $('#clClose').addEventListener('click', () => this.onClubLeave?.());
      $('#clCopy').addEventListener('click', async () => {
        const txt = [...document.querySelectorAll('#clList > div')].map((d) => d.dataset.line || d.textContent).join('\n');
        try { await navigator.clipboard.writeText(txt); this.toast('📋 대화를 복사했어요'); } catch { this.toast('복사하지 못했어요'); }
      });
      $('#clInput').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); $('#clInput').blur(); } });
    }
    $('#clList').innerHTML = '';
    $('#clTopic').textContent = topic ? `💬 오늘의 이야깃거리 — ${topic}` : '';
    $('#clubPanel').classList.add('show');
    document.body.classList.add('clubbing');
    this.toggleChat(false);
  }
  clubClose() { $('#clubPanel').classList.remove('show'); document.body.classList.remove('clubbing'); $('#clInput').blur(); }
  clubMembers(n, names) { $('#clCount').textContent = `${n}/10`; $('#clWho').textContent = names.join(' · '); }
  clubLine(name, text, kind = '') {
    const list = $('#clList');
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    const d = document.createElement('div');
    const now = new Date(), tm = `${now.getHours() < 12 ? '오전' : '오후'} ${((now.getHours() + 11) % 12) + 1}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (kind === 'sys') { d.className = 'cl-sys'; d.textContent = text; d.dataset.line = `— ${text}`; }
    else {
      d.className = 'cl-msg' + (kind === 'me' ? ' me' : '');
      d.innerHTML = `${kind === 'me' ? '' : `<span class="n">${esc(name)}</span>`}<div class="row"><span class="b">${esc(text)}</span><span class="t">${tm}</span></div>`;
      d.dataset.line = `[${tm}] ${name}: ${text}`;
    }
    list.appendChild(d);
    while (list.children.length > 300) list.firstChild.remove();
    if (atBottom || kind === 'me') list.scrollTop = list.scrollHeight;
  }

  // 내 필사 공책: 이어 쓴 날 · 달력 도장 · 편 수와 글자 수 · 글로 복사하기 (이 기기에만, 메시지 0건)
  openCopybook(list) {
    this.sheetKind = 'copybook';
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const dayOf = (k) => new Date(Date.parse(today) + k * 86400000).toISOString().slice(0, 10);
    const per = {};
    for (const e of list) if (e.day) per[e.day] = (per[e.day] || 0) + 1;
    // 이어 쓴 날: 오늘(오늘 아직 안 썼으면 어제)부터 거꾸로 하루도 빠지지 않은 날 수
    let streak = 0;
    for (let k = per[today] ? 0 : -1; per[dayOf(k)]; k--) streak++;
    const chars = list.reduce((a, e) => a + (e.chars || 0), 0);
    let ym = today.slice(0, 7);
    if (!per[today] && list[0]?.day && !Object.keys(per).some((d) => d.startsWith(ym))) ym = list[0].day.slice(0, 7);
    this.openSheet(`<h2>📓 내 필사 공책</h2>
      <div class="cb-keep">💾 이 기기에만 저장돼요. 기기를 바꾸거나 방문 기록을 지우면 사라지니, 가끔 글로 복사해 두세요. 200편이 넘으면 오래된 편부터 사라져요.</div>
      ${list.length ? `<div class="cb-stats">
        <div class="cb-streak">${streak ? `🔥 ${streak}일째 이어 쓰는 중` : '🔥 오늘 한 편 쓰면 1일째가 돼요'}</div>
        <div class="cb-total">지금까지 <b>${list.length}</b>편 · <b>${chars.toLocaleString('ko-KR')}</b>자</div>
      </div>
      <div class="cb-cal" id="cbCal"></div>
      <p style="margin:10px 0 4px"><button id="cbCopy" class="btn small" type="button">📋 글로 복사하기</button></p>
      <div id="cbText" class="hidden"><p class="note">복사가 안 되는 브라우저예요. 아래 글을 길게 눌러 모두 골라 복사해 주세요.</p><textarea class="cb-text" readonly></textarea></div>
      <ol class="toc">${list.map((e) => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener"><span><b style="font-weight:400">${esc(e.ko)}</b><br><small style="color:var(--ink-soft)">${esc(e.day)} · ${esc(e.src)} · ${e.min}분 · 정확도 ${e.acc}%</small></span></a></li>`).join('')}</ol>` : '<div class="empty">아직 끝까지 쓴 편이 없어요. 한 편을 다 쓰면 여기에 남고, 쓴 날마다 달력에 도장이 찍혀요.</div>'}
      <p class="note">문장은 철학아틀라스의 「오늘의 필사」에서 왔어요.</p>`);
    if (!list.length) return;
    const draw = () => {
      const [y, m] = ym.split('-').map(Number);
      const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const cells = [];
      for (let i = 0; i < first; i++) cells.push('<span></span>');
      for (let d = 1; d <= days; d++) {
        const key = `${ym}-${String(d).padStart(2, '0')}`;
        const n = per[key] || 0;
        cells.push(`<span class="${n ? 'ink' : ''}${key === today ? ' today' : ''}" style="${n ? `--r:${(d * 47) % 50 - 25}deg` : ''}" title="${n ? `${n}편` : ''}">${d}${n > 1 ? `<i>${n}</i>` : ''}</span>`);
      }
      const inMonth = Object.keys(per).filter((k) => k.startsWith(ym)).length;
      $('#cbCal').innerHTML = `<div class="cb-cal-head"><button type="button" class="cb-nav" data-d="-1" aria-label="지난달">‹</button><b>${y}년 ${m}월</b><small>${inMonth}일 씀</small><button type="button" class="cb-nav" data-d="1" aria-label="다음 달">›</button></div>
        <div class="cb-grid cb-week">${['일', '월', '화', '수', '목', '금', '토'].map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="cb-grid">${cells.join('')}</div>`;
      $('#cbCal').querySelectorAll('.cb-nav').forEach((b) => b.addEventListener('click', () => {
        const dt = new Date(Date.UTC(y, m - 1 + Number(b.dataset.d), 1));
        ym = dt.toISOString().slice(0, 7);
        draw();
      }));
    };
    draw();
    $('#cbCopy').addEventListener('click', async () => {
      const text = `📓 내 필사 공책 · ${CONFIG.brand.name}\n\n` + [...list].reverse().map((e) => `${e.day}\n${e.ko}\n— ${e.src || ''}${e.theme ? ` · ${e.theme}` : ''}\n${e.url || ''}`).join('\n\n') + '\n';
      try {
        await navigator.clipboard.writeText(text);
        this.toast(`📋 ${list.length}편을 글로 복사했어요. 메모나 카톡에 붙여 넣어 두세요`);
      } catch {
        $('#cbText').classList.remove('hidden');
        const ta = $('#cbText textarea');
        ta.value = text;
        ta.focus(); ta.select();
      }
    });
  }

  openMyCat() {
    this.sheetKind = 'mycat';
    const cur = this.getMyCat?.();
    this.openSheet(`
      <h2>우리 집 고양이 입장시키기</h2>
      <p class="note">고양이 사진을 올리면 털색을 따서 서점에 함께 들어와요. 사진은 내 기기 안에서만 쓰여요.</p>
      ${cur ? `<p class="note" style="margin:10px 0">지금 함께 있는 고양이: <b style="color:var(--wood-dark)">${esc(cur.name || '우리 고양이')}</b> <button id="mcHome" class="btn ghost small" type="button">집으로 보내기</button></p>` : ''}
      <label class="btn" style="margin:8px 0">📷 사진 고르기<input id="mcPhoto" type="file" accept="image/*" hidden /></label>
      <div id="mcStatus" class="note"></div>
      <div id="mcPreview" class="hidden" style="margin-top:10px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div id="mcSwatches" class="swatches"></div><span id="mcKind" class="note"></span></div>
        <label class="field"><span>이름</span><input id="mcName" maxlength="10" placeholder="고양이 이름" /></label>
        <p style="margin-top:12px"><button id="mcAdopt" class="btn primary" type="button">서점에 들여보내기</button></p>
      </div>`);
    $('#mcHome')?.addEventListener('click', () => { this.onSendHome?.(); this.closeSheet(); });
    $('#mcPhoto').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      $('#mcStatus').textContent = '털색을 살펴보는 중…';
      try {
        const info = await this.onPhoto(file);
        this.pendingCat = info;
        const sw = $('#mcSwatches'); sw.innerHTML = '';
        for (const c of [info.base, info.dark, info.light, info.orange].filter(Boolean)) { const d = document.createElement('span'); d.className = 'sw'; d.style.background = c; d.style.cursor = 'default'; sw.appendChild(d); }
        $('#mcKind').textContent = info.patches ? '삼색 얼룩' : info.stripes ? (info.white ? '줄무늬 + 흰 배' : '줄무늬') : info.white ? '두 가지 색' : '단색';
        $('#mcPreview').classList.remove('hidden');
        $('#mcStatus').textContent = '';
        $('#mcName').focus();
      } catch (err) { console.warn(err); $('#mcStatus').textContent = '사진을 읽지 못했어요. 다른 사진으로 해 볼까요?'; }
    });
    $('#mcAdopt').addEventListener('click', () => {
      if (!this.pendingCat) return;
      this.pendingCat.name = $('#mcName').value.trim().slice(0, 10) || '우리 고양이';
      this.onAdoptCat?.(this.pendingCat);
      this.closeSheet();
    });
  }

  // ---------- 작은 카드 (고양이 · 손님) ----------
  showCat(def, onTreat, play = {}) {
    this.cardCat = def.id;
    const toy = play.toy ? CONFIG.toys.find((t) => t.id === play.toy) : null;
    $('#cardBody').innerHTML = `
      <div class="card-kicker">서점 고양이</div>
      <div class="card-title">${esc(def.name)} <span class="purr">골골…</span></div>
      <div class="card-desc">${esc(def.desc)}</div>
      <div class="row">
        <button class="btn primary" id="treatBtn" type="button">🐟 간식 주기</button>
        ${toy ? `<button class="btn" id="playBtn" type="button">${toy.ico} ${esc(toy.name)}로 놀아 주기</button>` : '<button class="btn ghost" id="playBtn" type="button">🧸 장난감 빌리러 가기</button>'}
      </div>`;
    $('#treatBtn').addEventListener('click', onTreat);
    $('#playBtn').addEventListener('click', () => { this.hideCard(); toy ? play.onPlay?.() : play.onRent?.(); });
    this.openCard();
  }
  showDog(def, onPet) {
    this.cardCat = null;
    $('#cardBody').innerHTML = `
      <div class="card-kicker">서점 마당 강아지 · 진돗개</div>
      <div class="card-title">${esc(def.name)} <span class="purr">왈!</span></div>
      <div class="card-desc">${esc(def.desc)}</div>
      <button class="btn primary" id="dogPetBtn" type="button" style="width:100%">🐾 한 번 더 쓰다듬기</button>`;
    $('#dogPetBtn').addEventListener('click', onPet);
    this.openCard();
  }
  showPanda(def, info) {
    this.cardCat = null;
    $('#cardBody').innerHTML = `
      <div class="card-kicker">숲의 손님 · 레서판다</div>
      <div class="card-title">${esc(def.name)} <span class="purr">꾸잉?</span></div>
      <div class="card-desc">${esc(def.desc)}</div>
      <div class="card-desc" style="margin-top:6px;color:var(--wood-dark)">${info.first ? '🍁 오늘 처음 찾았어요!' : '🍁 오늘 또 만났어요'} · 이 기기에서 ${info.days}일 동안 찾았어요${info.up ? ' · 지금은 나무 위에 있어요' : ''}</div>`;
    this.openCard();
  }
  showGuest(g, h) {
    this.cardCat = null;
    $('#cardBody').innerHTML = `
      <div class="card-kicker">${g.nook ? '숨은 자리에서 읽는 손님' : '함께 머무는 손님'}</div>
      <div class="card-title">${esc(g.name)}</div>
      <div class="card-desc">${g.drink ? `${esc(g.drink.name)}를 들고 있어요` : '빈손이에요'}${g.seat ? ` · ${esc(g.seat)}` : ''}</div>
      <div class="row">
        <button class="btn primary" id="gGift" type="button">☕ 음료 선물</button>
        <button class="btn" id="gWave" type="button">👋 인사</button>
        ${g.blocked ? '' : '<button class="btn" id="gWalk" type="button">🚶 같이 산책</button>'}
        <button class="btn ghost" id="gBlock" type="button">${g.blocked ? '가리기 풀기' : '가리기'}</button>
      </div>`;
    $('#gGift').addEventListener('click', () => { this.hideCard(); this.openDrinks({ giftTo: g.uid }); });
    $('#gWave').addEventListener('click', () => { h.wave?.(); this.hideCard(); });
    $('#gWalk')?.addEventListener('click', () => { h.walk?.(); this.hideCard(); });
    $('#gBlock').addEventListener('click', () => { const on = h.block?.(); this.toast(on ? `${g.name} 님을 가렸어요. 말풍선과 모습이 안 보여요` : `${g.name} 님이 다시 보여요`); this.hideCard(); });
    this.openCard();
  }
  // 같이 산책 청이 왔을 때 (30초 뒤 저절로 닫힘 — 답하지 않으면 아무것도 보내지 않음)
  walkInvite(name, yes, no) {
    $('#paText').innerHTML = `🚶 <b>${esc(name)}</b> 님이 둘레길을 같이 한 바퀴 걷자고 해요`;
    const box = $('#pairAsk');
    box.classList.add('show');
    clearTimeout(this.paT);
    const done = (f) => { box.classList.remove('show'); clearTimeout(this.paT); $('#paYes').onclick = $('#paNo').onclick = null; f?.(); };
    $('#paYes').onclick = () => done(yes);
    $('#paNo').onclick = () => done(no);
    this.paT = setTimeout(() => done(null), 30000);
  }
  pairChip(show, text = '') {
    if (!this._pcBound) { this._pcBound = true; $('#pcStop').addEventListener('click', () => this.onPairStop?.()); }
    $('#pcText').textContent = text;
    $('#pairChip').classList.toggle('show', show);
  }
  openCard() {
    $('#card').classList.add('show');
    $('#hint').classList.remove('show');
    clearTimeout(this.cardT);
    this.cardT = setTimeout(() => this.hideCard(), 12000);
  }
  hideCard() { $('#card').classList.remove('show'); }

  // ---------- 아래에서 올라오는 판 ----------
  openSheet(html) {
    $('#sheetBody').innerHTML = html;
    $('#sheet').classList.remove('hidden');
    $('#sheetBody').scrollTop = 0;
    this.hideCard();
    this.onSheet?.(true);
  }
  closeSheet() {
    $('#sheet').classList.add('hidden');
    this.sheetKind = null;
    this.onSheet?.(false);
  }

  // 펼친 책: 표지 + 첫 문장 + 목차
  openBook(id) {
    const b = this.byId.get(id);
    if (!b) return;
    this.sheetKind = 'book';
    const a = this.atlas[b.atlas];
    const inBasket = this.basket.includes(id);
    const readN = b.toc.filter((t) => this.read[t.u]).length;
    this.openSheet(`
      <div class="book">
        <div>${coverHTML(b, a, 'big')}${b.coverNote ? `<div class="credit">표지 그림: ${esc(b.coverNote)}</div>` : ''}</div>
        <div>
          <div class="book-meta">${esc(b.fieldName || a.name)} · ${esc(b.shelfName)}${b.gradeName ? ` · ${esc(b.gradeName)}` : ''}${b.tag ? ` · ${esc(b.tag)}` : ''}${b.period ? ` · ${esc(b.period)}` : ''} · ${esc(a.name)}</div>
          <div class="book-title">${esc(b.title)}</div>
          ${b.subtitle ? `<div class="book-sub">${esc(b.subtitle)}</div>` : ''}
          ${b.first ? `<p class="first"><small>첫 문장</small>${esc(b.first)}</p>` : ''}
          ${b.blurb && b.blurb !== b.first ? `<p class="blurb">${esc(b.blurb)}</p>` : ''}
          <div class="row">
            <button class="btn primary" id="bkAdd" type="button">${inBasket ? '✓ 담았어요 (빼기)' : '🧺 담기'}</button>
            <a class="btn" href="${esc(b.url)}" target="_blank" rel="noopener">${b.kind === 'map' ? '지도 열기' : b.kind === 'tool' ? '열어 보기' : b.kind === 'video' ? '영상 보기' : '시리즈 표지'} ↗</a>
            ${this.canWalkTo?.(id) ? '<button class="btn ghost" id="bkWalk" type="button">꽂힌 자리로</button>' : ''}
          </div>
          <h3>${b.kind === 'collection' ? '차례' : '목차'} · ${b.parts}${b.kind === 'collection' ? '장' : '편'}${readN ? ` <small style="font-family:var(--sans);font-size:12px;color:var(--ink-soft)">(${readN}편 읽음)</small>` : ''}</h3>
          <ol class="toc">${b.toc.map((t) => `<li><a href="${esc(t.u)}" target="_blank" rel="noopener" data-u="${esc(t.u)}"><span>${esc(t.t)}</span>${this.read[t.u] ? '<span class="done">읽음</span>' : ''}</a></li>`).join('')}</ol>
        </div>
      </div>`);
    $('#bkAdd').addEventListener('click', () => { this.toggleBasket(id); this.openBook(id); });
    $('#bkWalk')?.addEventListener('click', () => { this.closeSheet(); this.onWalkToBook?.(id); });
    this.bindReadLinks();
    this.onBookOpen?.(b);
  }
  bindReadLinks() {
    document.querySelectorAll('#sheetBody a[data-u]').forEach((el) => el.addEventListener('click', () => {
      this.read[el.dataset.u] = 1;
      store.set('read', this.read);
      const done = el.querySelector('.done');
      if (!done) el.insertAdjacentHTML('beforeend', '<span class="done">읽음</span>');
    }));
  }

  toggleBasket(id) {
    const i = this.basket.indexOf(id);
    if (i >= 0) { this.basket.splice(i, 1); this.toast('책바구니에서 뺐어요'); } else { this.basket.unshift(id); this.toast('🧺 책바구니에 담았어요 · 어디서든 펼쳐 읽어요'); }
    store.set('basket', this.basket);
    this.updateBadge();
  }
  updateBadge() {
    const el = $('#basketCount');
    el.textContent = this.basket.length;
    el.classList.toggle('hidden', !this.basket.length);
  }

  mini(b) {
    const a = this.atlas[b.atlas];
    const bg = b.cover ? `background-image:url('${esc(b.cover)}');color:transparent` : `background:#f1e9dc`;
    return `<span class="minicover" style="--spine:${a.spine};${bg}">${b.cover ? '' : esc(b.title.slice(0, 8))}</span>`;
  }

  // 책바구니 · 서가 목록(분야별 · 학년별) · 도구 모음
  openBasket(tab = 'basket', openId = null, field = null, grade = null) {
    this.sheetKind = 'basket';
    const lib = this.lib;
    const fields = lib.fields || [];
    const tools = lib.tools || [];
    field = field || this.lastField || (fields[0] && fields[0].id);
    this.lastField = field;
    const tabs = `<div class="tabs"><button type="button" data-tab="basket" class="${tab === 'basket' ? 'on' : ''}">🧺 내 책바구니 ${this.basket.length}</button><button type="button" data-tab="shelf" class="${tab === 'shelf' ? 'on' : ''}">📚 서가 목록 ${lib.count}권</button><button type="button" data-tab="tools" class="${tab === 'tools' ? 'on' : ''}">🧰 도구 모음 ${tools.length}</button></div>`;
    let body = '';
    const item = (b) => `<div class="bitem" data-book="${esc(b.id)}">${this.mini(b)}<div class="bt"><b>${esc(b.title)}</b><span>${esc(b.subtitle || b.blurb).slice(0, 48)}</span></div><span class="prog">${this.basket.includes(b.id) ? '🧺' : ''} ${b.parts}${b.kind === 'collection' ? '장' : '편'}</span></div>`;
    if (tab === 'basket') {
      if (!this.basket.length) body = '<div class="empty">아직 담은 책이 없어요.<br>책장에서 책을 눌러 「담기」 하거나, 「서가 목록」에서 골라 보세요.<br>담은 책은 이 브라우저에 남아요.</div>';
      else {
        body = '<div class="blist">' + this.basket.map((id) => {
          const b = this.byId.get(id);
          const readN = b.toc.filter((t) => this.read[t.u]).length;
          const open = openId === id;
          return `<div class="bitem" data-open="${esc(id)}">${this.mini(b)}<div class="bt"><b>${esc(b.title)}</b><span>${esc(this.atlas[b.atlas].short)} · ${b.parts}편 · ${open ? '목차 접기' : '눌러서 편 고르기'}</span></div><span class="prog">${readN}/${b.parts}</span></div>
            ${open ? `<ol class="toc" style="margin:0 0 10px 58px">${b.toc.map((t) => `<li><a href="${esc(t.u)}" target="_blank" rel="noopener" data-u="${esc(t.u)}"><span>${esc(t.t)}</span>${this.read[t.u] ? '<span class="done">읽음</span>' : ''}</a></li>`).join('')}</ol>
            <div style="margin:0 0 12px 58px;display:flex;gap:6px"><button class="btn small" type="button" data-book="${esc(id)}">표지 보기</button><button class="btn small ghost" type="button" data-remove="${esc(id)}">빼기</button></div>` : ''}`;
        }).join('') + '</div><p class="note" style="margin-top:12px">편을 누르면 아틀라스의 실제 글이 새 창으로 열려요. 앉아서, 서서, 정원에서도 언제든.</p>';
      }
    } else if (tab === 'shelf') {
      const fieldTabs = `<div class="tabs sub">${fields.map((f) => `<button type="button" data-field="${f.id}" class="${f.id === field ? 'on' : ''}" style="${f.id === field ? `background:${f.color};border-color:${f.color}` : ''}">${f.ico || ''} ${esc(f.name)} ${lib.books.filter((b) => b.field === f.id).length}</button>`).join('')}</div>`;
      const f = fields.find((x) => x.id === field) || fields[0];
      const grades = f?.grades || [];
      let gradeTabs = '';
      if (grades.length) gradeTabs = `<div class="tabs sub grades"><button type="button" data-grade="" class="${!grade ? 'on' : ''}">전부</button>${grades.map((g) => `<button type="button" data-grade="${g.id}" class="${grade === g.id ? 'on' : ''}">${esc(g.name)}</button>`).join('')}</div>`;
      const shelves = (lib.shelves || []).filter((s) => s.field === field);
      const inField = lib.books.filter((b) => b.field === field && (!grade || b.grade === grade));
      body = fieldTabs + gradeTabs + (f?.note ? `<p class="note" style="margin:0 0 6px">${esc(f.note)}</p>` : '') + shelves.map((s) => {
        const list = inField.filter((b) => b.shelf === s.id);
        if (!list.length) return '';
        return `<div class="shelf-h">${esc(s.name)} <small>${list.length}권</small></div><div class="blist">${list.map(item).join('')}</div>`;
      }).join('') + (inField.length ? '' : '<div class="empty">이 칸에는 아직 책이 없어요.</div>');
    } else {
      const byField = {};
      for (const t of tools) (byField[t.field] = byField[t.field] || []).push(t);
      body = '<p class="note" style="margin:0 0 10px">과학아틀라스의 놀이판 · 지도 · 실험 도구예요. 역사 · 철학 · 정치아틀라스의 지도와 도구는 책이 되어 시대별 책장에 꽂혀 있어요. 새 창으로 열려요.</p>' + fields.map((f) => {
        const list = byField[f.id] || [];
        if (!list.length) return '';
        return `<div class="shelf-h" style="color:${f.color}">${f.ico || ''} ${esc(f.name)} <small>${list.length}</small></div><div class="tools">${list.map((t) => `<a class="tool" href="${esc(t.url)}" target="_blank" rel="noopener"><span class="ico">${t.ico || '🧰'}</span><b>${esc(t.name)}</b><span>${esc(t.note || '')}${t.grade ? ` · ${esc(t.grade)}` : ''}</span></a>`).join('')}</div>`;
      }).join('');
    }
    this.openSheet(`<h2>${tab === 'tools' ? '도구 모음' : tab === 'shelf' ? '서가 목록' : '책바구니'}</h2>${tabs}${body}`);
    document.querySelectorAll('#sheetBody [data-tab]').forEach((el) => el.addEventListener('click', () => this.openBasket(el.dataset.tab, null, field, grade)));
    document.querySelectorAll('#sheetBody [data-field]').forEach((el) => el.addEventListener('click', () => this.openBasket('shelf', null, el.dataset.field, null)));
    document.querySelectorAll('#sheetBody [data-grade]').forEach((el) => el.addEventListener('click', () => this.openBasket('shelf', null, field, el.dataset.grade || null)));
    document.querySelectorAll('#sheetBody [data-open]').forEach((el) => el.addEventListener('click', () => this.openBasket('basket', openId === el.dataset.open ? null : el.dataset.open)));
    document.querySelectorAll('#sheetBody [data-book]').forEach((el) => el.addEventListener('click', () => this.openBook(el.dataset.book)));
    document.querySelectorAll('#sheetBody [data-remove]').forEach((el) => el.addEventListener('click', () => { this.toggleBasket(el.dataset.remove); this.openBasket('basket'); }));
    this.bindReadLinks();
    if (tab !== 'basket' && this.scrollKeep) $('#sheetBody').scrollTop = this.scrollKeep;
  }
  openCatalog(field, grade = null) { this.scrollKeep = 0; this.openBasket('shelf', null, field, grade); }
  openTools() { this.scrollKeep = 0; this.openBasket('tools'); }

  // 음료: 카운터에서 고르기, 또는 다른 손님에게 선물
  openDrinks({ giftTo = null, current = null, tab = 'drinks' } = {}) {
    this.sheetKind = 'drinks';
    const guests = this.nearbyGuests?.() || [];
    let target = giftTo;
    const tabs = (on) => giftTo ? '' : `<div class="tabs"><button type="button" class="tab2 ${on === 'drinks' ? 'on' : ''}" data-ct="drinks">☕ 음료</button><button type="button" class="tab2 ${on === 'toys' ? 'on' : ''}" data-ct="toys">🧸 고양이 장난감 대여</button>${CONFIG.support?.kakao ? `<a class="tab2 support-tab" href="${esc(CONFIG.support.kakao)}" target="_blank" rel="noopener">💗 서점지기 응원하기 ↗</a>` : ''}</div>`;
    const storeLine = giftTo ? '' : '<p class="note store-line">🐈 이 서점의 캣타워는 모두 고양이서가 원목 캣타워예요.</p>';
    const renderToys = () => {
      const mine = this.getToy?.();
      this.openSheet(`${tabs('toys')}
        <h2>고양이 장난감 대여 (무료)</h2>
        <p class="note">빌린 장난감은 손에 들려요. 고양이를 누르거나 캣타워 놀이터에서 놀아 줄 수 있어요. 한 번에 하나씩, 다 놀면 반납해 주세요.</p>
        <div class="drinks">${CONFIG.toys.map((t) => `<button type="button" class="drink ${mine === t.id ? 'on' : ''}" data-y="${t.id}"><b>${t.ico} ${esc(t.name)}</b><span>${esc(t.note)}</span></button>`).join('')}</div>
        ${mine ? '<p style="margin-top:14px"><button class="btn ghost small" type="button" id="yBack">장난감 반납하기</button></p>' : ''}
        ${storeLine}`);
      document.querySelectorAll('#sheetBody [data-ct]').forEach((el) => el.addEventListener('click', () => (el.dataset.ct === 'toys' ? renderToys() : render())));
      document.querySelectorAll('#sheetBody [data-y]').forEach((el) => el.addEventListener('click', () => { this.onToyPick?.(el.dataset.y); this.closeSheet(); }));
      document.querySelector('#yBack')?.addEventListener('click', () => { this.onToyPick?.(null); this.closeSheet(); });
    };
    const render = () => {
      const tgt = guests.find((g) => g.uid === target);
      this.openSheet(`${tabs('drinks')}
        <h2>${target ? `${esc(tgt?.name || '손님')} 님에게 음료 선물` : '오늘의 차 (모두 무료)'}</h2>
        <p class="note">${target ? '고르면 바로 건네져요. 받은 분 손에 컵이 생겨요.' : '고르면 손에 컵을 들어요. 아래에서 가까운 손님에게 선물할 수도 있어요.'}</p>
        <div class="drinks">${CONFIG.drinks.map((d) => `<button type="button" class="drink ${!target && current === d.id ? 'on' : ''}" data-d="${d.id}"><b><i style="background:${d.color}"></i>${esc(d.name)}</b><span>${esc(d.note)}</span></button>`).join('')}</div>
        <h3>선물할 손님 ${guests.length ? '' : '<small style="font-family:var(--sans);font-size:12px;color:var(--ink-soft)">— 가까이 다른 손님이 없어요</small>'}</h3>
        <div class="guests"><button type="button" data-g="" class="${!target ? 'on' : ''}">나에게</button>${guests.map((g) => `<button type="button" data-g="${esc(g.uid)}" class="${target === g.uid ? 'on' : ''}">${esc(g.name)}</button>`).join('')}</div>
        ${!target && current ? '<p style="margin-top:14px"><button class="btn ghost small" type="button" id="dPut">컵 내려놓기</button></p>' : ''}
        ${storeLine}`);
      document.querySelectorAll('#sheetBody [data-ct]').forEach((el) => el.addEventListener('click', () => (el.dataset.ct === 'toys' ? renderToys() : render())));
      document.querySelectorAll('#sheetBody [data-g]').forEach((el) => el.addEventListener('click', () => { target = el.dataset.g || null; render(); }));
      document.querySelectorAll('#sheetBody [data-d]').forEach((el) => el.addEventListener('click', () => {
        const d = CONFIG.drinks.find((x) => x.id === el.dataset.d);
        if (target) { const ok = this.onGift?.(target, d); if (ok !== false) { this.toast(`${tgt?.name || '손님'} 님에게 ${d.name}를 건넸어요`); this.closeSheet(); } }
        else { this.onDrinkPick?.(d); this.closeSheet(); }
      }));
      document.querySelector('#dPut')?.addEventListener('click', () => { this.onDrinkPick?.(null); this.closeSheet(); });
    };
    if (tab === 'toys') renderToys(); else render();
  }

  // 서점지기에게 한마디 (건의함)
  openSuggest() {
    this.sheetKind = 'suggest';
    const draft = store.get('suggestDraft', '');
    this.openSheet(`
      <h2>서점지기에게 한마디</h2>
      <p class="note">들여놓았으면 하는 책, 고쳤으면 하는 곳, 그냥 하고 싶은 말. 서점지기만 읽어요.</p>
      <label class="field" style="margin:10px 0"><span>이름</span><input id="sgName" maxlength="20" placeholder="비워 두면 익명" value="${esc(this.myName || '')}" /></label>
      <textarea id="sgText" maxlength="600" placeholder="여기에 적어 주세요 (600자까지)">${esc(draft)}</textarea>
      <p style="display:flex;gap:8px;align-items:center;margin:10px 0 0"><button class="btn primary" type="button" id="sgSend">건의함에 넣기</button><span class="note" id="sgStatus"></span></p>
      <a class="tab2 store-tab" style="margin-top:14px" href="${esc(CONFIG.store?.url || '#')}" target="_blank" rel="noopener">🐈 고양이서가 캣타워 둘러보기 ↗</a>
      <p class="tiny legal" style="margin-top:12px"><a href="privacy.html" target="_blank" rel="noopener">개인정보 안내</a></p>`);
    const ta = $('#sgText');
    ta.addEventListener('input', () => store.set('suggestDraft', ta.value));
    $('#sgSend').addEventListener('click', async () => {
      const text = ta.value.trim();
      if (text.length < 2) { $('#sgStatus').textContent = '조금만 더 적어 주세요'; return; }
      $('#sgSend').disabled = true;
      $('#sgStatus').textContent = '넣는 중…';
      const r = await this.onSuggest?.(text, $('#sgName').value.trim());
      $('#sgSend').disabled = false;
      if (r?.ok) { store.set('suggestDraft', ''); ta.value = ''; $('#sgStatus').textContent = r.queued ? '서버가 열리면 전해 드릴게요. 고마워요!' : '잘 들어갔어요. 고마워요!'; }
      else $('#sgStatus').textContent = r?.error || '지금은 못 넣었어요. 잠시 뒤에 다시 해 주세요';
    });
  }

  // ---------- 채팅 ----------
  toggleChat(force) {
    const bar = $('#chatBar');
    const show = force ?? bar.classList.contains('hidden');
    bar.classList.toggle('hidden', !show);
    document.body.classList.toggle('chatting', show);
    $('#btnChat').classList.toggle('on', show);
    if (show) setTimeout(() => $('#chatInput').focus(), 30);
    else $('#chatInput').blur();
  }
  chatLine(name, text, kind = '') {
    const log = $('#chatLog');
    const d = document.createElement('div');
    if (kind) d.className = kind;
    d.innerHTML = name ? `<b>${esc(name)}</b>${esc(text)}` : esc(text);
    log.appendChild(d);
    while (log.children.length > 6) log.firstChild.remove();
    setTimeout(() => d.classList.add('old'), 24000);
    setTimeout(() => d.remove(), 25500);
  }
}

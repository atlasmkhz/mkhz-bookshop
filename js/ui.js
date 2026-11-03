// 화면 위 UI: 입장 · 안내 · 펼친 책 · 책바구니 · 음료 · 건의함 · 채팅 (안내는 화면 위에 짧게)
import { LOOKS } from './avatar.js';
import { CONFIG, store } from './config.js';
import { coverHTML } from './covers.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  init({ name, look, night, server, rain, lib }) {
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
    $('#nameInput').value = name || '';
    this.swatches('#topSwatches', LOOKS.tops, 'top');
    this.swatches('#hairSwatches', LOOKS.hairs, 'hair');
    this.swatches('#skinSwatches', LOOKS.skins, 'skin');
    $('#enterForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = $('#nameInput').value.trim().slice(0, 12);
      if (!n) { $('#nameInput').focus(); $('#nameInput').classList.add('shake'); setTimeout(() => $('#nameInput').classList.remove('shake'), 400); return; }
      $('#entry').classList.add('gone');
      $('#hud').classList.remove('hidden');
      this.onEnter?.({ name: n, look: this.look, soundOn: $('#soundOnEnter').checked, room: +$('#roomSelect').value || null });
    });
    this.setNight(night);
    $('#btnNight').addEventListener('click', () => this.setNight(this.onToggleNight?.()));
    $('#btnSound').addEventListener('click', () => this.setSound(this.onToggleSound?.()));
    $('#btnWave').addEventListener('click', () => this.onWave?.());
    $('#btnPlaces').addEventListener('click', () => this.openPlaces());
    $('#btnMyCat').addEventListener('click', () => this.openMyCat());
    $('#playerClose').addEventListener('click', () => this.hidePlayer(true));
    $('#playerSize').addEventListener('click', () => { $('#player').classList.toggle('big'); $('#playerSize').textContent = $('#player').classList.contains('big') ? '작게' : '크게'; });
    $('#btnBasket').addEventListener('click', () => this.openBasket());
    $('#btnDrink').addEventListener('click', () => this.onDrinkButton?.());
    $('#btnChat').addEventListener('click', () => this.toggleChat());
    $('#cardClose').addEventListener('click', () => this.hideCard());
    $('#sheetClose').addEventListener('click', () => this.closeSheet());
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
      });
      box.appendChild(b);
    });
    if (!colors.includes(this.look[key])) { this.look[key] = colors[0]; box.firstChild.classList.add('on'); }
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
  setRoom(n) { $('#roomNo').textContent = n ? `${n}호점` : ''; }
  setRain(on) { $('#btnRain').classList.toggle('off', !on); $('#btnRain').title = on ? '비 그치게 하기' : '빗소리'; }
  setNight(on) { $('#btnNight').textContent = on ? '🌙' : '☀️'; $('#btnNight').title = on ? '밤 (누르면 낮)' : '낮 (누르면 밤)'; }
  setSound(on) { $('#btnSound').textContent = on ? '🔊' : '🔈'; $('#btnSound').classList.toggle('off', !on); }
  soundNudge() {
    if (this.nudged) return;
    this.nudged = true;
    this.toast('🔈 소리를 켜면 골골송이 들려요');
    $('#btnSound').classList.add('pulse');
    setTimeout(() => $('#btnSound').classList.remove('pulse'), 3000);
  }
  setStatus(s) { this.status = s; $('#statusDot').className = 'dot ' + s; this.renderCount(); }
  setCount(n) { this.count = n; this.renderCount(); }
  renderCount() {
    const s = this.status;
    $('#count').textContent = s === 'offline' ? '혼자 읽는 중' : s === 'reconnecting' ? '연결 중…' : `${this.count}명`;
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

  // ---------- 캣타워 제품 카드 ----------
  showProduct(p) {
    this.cardCat = null;
    $('#cardBody').innerHTML = `
      <div class="card-kicker">고양이서가 원목 캣타워</div>
      <div class="card-title">${esc(p.name)}</div>
      <div class="card-desc">${esc(p.desc)}</div>
      <a class="btn primary" href="${esc(p.url)}" target="_blank" rel="noopener" style="width:100%">이 캣타워 보러 가기 ↗</a>`;
    this.openCard();
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
  showCat(def, onTreat) {
    this.cardCat = def.id;
    $('#cardBody').innerHTML = `
      <div class="card-kicker">서점 고양이</div>
      <div class="card-title">${esc(def.name)} <span class="purr">골골…</span></div>
      <div class="card-desc">${esc(def.desc)}</div>
      <button class="btn primary" id="treatBtn" type="button" style="width:100%">🐟 간식 주기</button>`;
    $('#treatBtn').addEventListener('click', onTreat);
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
        <button class="btn ghost" id="gBlock" type="button">${g.blocked ? '가리기 풀기' : '가리기'}</button>
      </div>`;
    $('#gGift').addEventListener('click', () => { this.hideCard(); this.openDrinks({ giftTo: g.uid }); });
    $('#gWave').addEventListener('click', () => { h.wave?.(); this.hideCard(); });
    $('#gBlock').addEventListener('click', () => { const on = h.block?.(); this.toast(on ? `${g.name} 님을 가렸어요. 말풍선과 모습이 안 보여요` : `${g.name} 님이 다시 보여요`); this.hideCard(); });
    this.openCard();
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
    $('#sheet .sheet').scrollTop = 0;
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
          <div class="book-meta">${esc(a.name)} · ${esc(b.shelfName)}${b.tag ? ` · ${esc(b.tag)}` : ''}${b.period ? ` · ${esc(b.period)}` : ''}</div>
          <div class="book-title">${esc(b.title)}</div>
          ${b.subtitle ? `<div class="book-sub">${esc(b.subtitle)}</div>` : ''}
          ${b.first ? `<p class="first"><small>첫 문장</small>${esc(b.first)}</p>` : ''}
          ${b.blurb && b.blurb !== b.first ? `<p class="blurb">${esc(b.blurb)}</p>` : ''}
          <div class="row">
            <button class="btn primary" id="bkAdd" type="button">${inBasket ? '✓ 담았어요 (빼기)' : '🧺 담기'}</button>
            <a class="btn" href="${esc(b.url)}" target="_blank" rel="noopener">시리즈 표지 ↗</a>
            ${this.canWalkTo?.(id) ? '<button class="btn ghost" id="bkWalk" type="button">꽂힌 자리로</button>' : ''}
          </div>
          <h3>목차 · ${b.parts}편${readN ? ` <small style="font-family:var(--sans);font-size:12px;color:var(--ink-soft)">(${readN}편 읽음)</small>` : ''}</h3>
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

  // 책바구니 + 서가 둘러보기
  openBasket(tab = 'basket', openId = null) {
    this.sheetKind = 'basket';
    const tabs = `<div class="tabs"><button type="button" data-tab="basket" class="${tab === 'basket' ? 'on' : ''}">🧺 내 책바구니 ${this.basket.length}</button><button type="button" data-tab="shelf" class="${tab === 'shelf' ? 'on' : ''}">서가 둘러보기 ${this.lib.count}권</button></div>`;
    let body = '';
    if (tab === 'basket') {
      if (!this.basket.length) body = '<div class="empty">아직 담은 책이 없어요.<br>책장에서 책을 눌러 「담기」 하거나, 「서가 둘러보기」에서 골라 보세요.<br>담은 책은 이 브라우저에 남아요.</div>';
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
    } else {
      body = this.lib.atlases.map((a) => {
        const shelves = this.lib.shelves.filter((s) => s.atlas === a.id);
        return `<h3 style="color:${a.spine}">${esc(a.name)}</h3>` + shelves.map((s) => `<div class="shelf-h">${esc(s.name)} <small>${s.count}권</small></div><div class="blist">` +
          this.lib.books.filter((b) => b.atlas === a.id && b.shelf === s.id).map((b) => `<div class="bitem" data-book="${esc(b.id)}">${this.mini(b)}<div class="bt"><b>${esc(b.title)}</b><span>${esc(b.subtitle || b.blurb).slice(0, 48)}</span></div><span class="prog">${this.basket.includes(b.id) ? '🧺' : ''} ${b.parts}편</span></div>`).join('') + '</div>').join('');
      }).join('');
    }
    this.openSheet(`<h2>책바구니</h2>${tabs}${body}`);
    document.querySelectorAll('#sheetBody [data-tab]').forEach((el) => el.addEventListener('click', () => this.openBasket(el.dataset.tab)));
    document.querySelectorAll('#sheetBody [data-open]').forEach((el) => el.addEventListener('click', () => this.openBasket('basket', openId === el.dataset.open ? null : el.dataset.open)));
    document.querySelectorAll('#sheetBody [data-book]').forEach((el) => el.addEventListener('click', () => this.openBook(el.dataset.book)));
    document.querySelectorAll('#sheetBody [data-remove]').forEach((el) => el.addEventListener('click', () => { this.toggleBasket(el.dataset.remove); this.openBasket('basket'); }));
    this.bindReadLinks();
  }

  // 음료: 카운터에서 고르기, 또는 다른 손님에게 선물
  openDrinks({ giftTo = null, current = null } = {}) {
    this.sheetKind = 'drinks';
    const guests = this.nearbyGuests?.() || [];
    let target = giftTo;
    const render = () => {
      const tgt = guests.find((g) => g.uid === target);
      this.openSheet(`
        <h2>${target ? `${esc(tgt?.name || '손님')} 님에게 음료 선물` : '오늘의 차 (모두 무료)'}</h2>
        <p class="note">${target ? '고르면 바로 건네져요. 받은 분 손에 컵이 생겨요.' : '고르면 손에 컵을 들어요. 아래에서 가까운 손님에게 선물할 수도 있어요.'}</p>
        <div class="drinks">${CONFIG.drinks.map((d) => `<button type="button" class="drink ${!target && current === d.id ? 'on' : ''}" data-d="${d.id}"><b><i style="background:${d.color}"></i>${esc(d.name)}</b><span>${esc(d.note)}</span></button>`).join('')}</div>
        <h3>선물할 손님 ${guests.length ? '' : '<small style="font-family:var(--sans);font-size:12px;color:var(--ink-soft)">— 가까이 다른 손님이 없어요</small>'}</h3>
        <div class="guests"><button type="button" data-g="" class="${!target ? 'on' : ''}">나에게</button>${guests.map((g) => `<button type="button" data-g="${esc(g.uid)}" class="${target === g.uid ? 'on' : ''}">${esc(g.name)}</button>`).join('')}</div>
        ${!target && current ? '<p style="margin-top:14px"><button class="btn ghost small" type="button" id="dPut">컵 내려놓기</button></p>' : ''}`);
      document.querySelectorAll('#sheetBody [data-g]').forEach((el) => el.addEventListener('click', () => { target = el.dataset.g || null; render(); }));
      document.querySelectorAll('#sheetBody [data-d]').forEach((el) => el.addEventListener('click', () => {
        const d = CONFIG.drinks.find((x) => x.id === el.dataset.d);
        if (target) { const ok = this.onGift?.(target, d); if (ok !== false) { this.toast(`${tgt?.name || '손님'} 님에게 ${d.name}를 건넸어요`); this.closeSheet(); } }
        else { this.onDrinkPick?.(d); this.closeSheet(); }
      }));
      document.querySelector('#dPut')?.addEventListener('click', () => { this.onDrinkPick?.(null); this.closeSheet(); });
    };
    render();
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
      <p style="display:flex;gap:8px;align-items:center;margin:10px 0 0"><button class="btn primary" type="button" id="sgSend">건의함에 넣기</button><span class="note" id="sgStatus"></span></p>`);
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
    while (log.children.length > 5) log.firstChild.remove();
    setTimeout(() => d.classList.add('old'), 14000);
    setTimeout(() => d.remove(), 15500);
  }
}

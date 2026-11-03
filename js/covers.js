// 책 표지: 히어로 그림이 있으면 그림 + 제목, 없으면 제목 글자만으로 단정하게 (독립출판물 느낌)
// - coverHTML: 책 카드 · 책바구니에 쓰는 HTML
// - drawCover: 3D 평대(누워 있는 책)에 쓰는 캔버스 그림

const PAPER = { history: '#f1e6d8', philo: '#e6e8ee', science: '#e2eeeb', politics: '#ebebdc' };
const INK = { history: '#4a2418', philo: '#1a2440', science: '#123f3c', politics: '#3a4120' };
const LETTER = { history: 'H', philo: 'P', science: 'S', politics: 'G' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function catalogNo(book) {
  return `${LETTER[book.atlas] || 'A'}-${String(book.no ?? 0).padStart(2, '0')}`;
}

// 제목을 표지 폭에 맞게 몇 줄로
function titleLines(t, max = 7) {
  const words = String(t).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

export function coverHTML(book, atlas, size = 'big') {
  const paper = PAPER[book.atlas] || '#efe8dc', ink = INK[book.atlas] || '#333', spine = atlas?.spine || '#555';
  const style = `--paper:${paper};--ink:${ink};--spine:${spine}`;
  const top = `<div class="cv-top"><span>MK ATLAS</span><span>${esc(catalogNo(book))}</span></div>`;
  const foot = `<div class="cv-foot"><span>${esc(atlas?.name || '')}</span><span>${book.parts}편</span></div>`;
  if (book.cover) {
    return `<div class="cover ${size}" style="${style}">${top}
      <div class="cv-pic"><img src="${esc(book.cover)}" alt="${esc(book.title)} 표지 그림" loading="lazy" /></div>
      <div class="cv-title">${esc(book.title)}</div>
      ${book.subtitle ? `<div class="cv-sub">${esc(book.subtitle)}</div>` : ''}
      ${foot}</div>`;
  }
  const lines = titleLines(book.title, size === 'big' ? 6 : 5);
  return `<div class="cover ${size} type" style="${style}">${top}
    <div class="cv-mark" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="cv-title big">${lines.map(esc).join('<br>')}</div>
    ${book.subtitle ? `<div class="cv-sub">${esc(book.subtitle)}</div>` : ''}
    ${foot}</div>`;
}

// 캔버스 표지 (w×h, 2:3)
export function drawCover(g, w, h, book, atlas, img) {
  const paper = PAPER[book.atlas] || '#efe8dc', ink = INK[book.atlas] || '#333', spine = atlas?.spine || '#555';
  g.fillStyle = paper; g.fillRect(0, 0, w, h);
  g.fillStyle = spine; g.fillRect(0, 0, w * 0.05, h);
  const pad = w * 0.1;
  g.fillStyle = ink;
  g.font = `600 ${w * 0.05}px "Gowun Dodum", sans-serif`;
  g.textBaseline = 'top';
  g.fillText('MK ATLAS', pad, pad * 0.8);
  g.textAlign = 'right';
  g.fillText(catalogNo(book), w - pad * 0.7, pad * 0.8);
  g.textAlign = 'left';
  let y = pad * 1.7;
  if (img) {
    const iw = w - pad * 1.7, ih = iw * 0.75;
    try { g.drawImage(img, pad, y, iw, ih); } catch { /* 무시 */ }
    g.strokeStyle = ink; g.lineWidth = 1; g.strokeRect(pad, y, iw, ih);
    y += ih + pad * 0.6;
    g.font = `700 ${w * 0.085}px "Gowun Batang", serif`;
    for (const l of titleLines(book.title, 9).slice(0, 2)) { g.fillText(l, pad, y); y += w * 0.1; }
  } else {
    g.strokeStyle = spine; g.lineWidth = w * 0.012;
    g.beginPath(); g.arc(w * 0.68, h * 0.3, w * 0.16, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(pad, h * 0.3); g.lineTo(w * 0.45, h * 0.3); g.stroke();
    y = h * 0.47;
    g.font = `700 ${w * 0.12}px "Gowun Batang", serif`;
    for (const l of titleLines(book.title, 5).slice(0, 3)) { g.fillText(l, pad, y); y += w * 0.14; }
  }
  if (book.subtitle) {
    g.font = `${w * 0.045}px "Gowun Dodum", sans-serif`;
    g.globalAlpha = 0.8;
    g.fillText(book.subtitle.slice(0, 22), pad, y + w * 0.02);
    g.globalAlpha = 1;
  }
  g.font = `600 ${w * 0.045}px "Gowun Dodum", sans-serif`;
  g.textBaseline = 'bottom';
  g.fillText(atlas?.name || '', pad, h - pad * 0.7);
  g.textAlign = 'right';
  g.fillText(`${book.parts}편`, w - pad * 0.7, h - pad * 0.7);
  g.textAlign = 'left';
}

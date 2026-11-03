// 말풍선 채팅 도우미: 거친 말 거르기 · 연속 입력 제한 · 가린 손님 기억
// (서버도 같은 거르기를 한 번 더 합니다: server/src/filter.js)
import { store } from './config.js';

// 거친 말 (글자 사이에 띄어쓰기 · 점 · 숫자를 끼워도 잡히게)
const WORDS = [
  // '새끼 고양이' · '보지 않았다' · '자지 마' · 디킨스(Dickens) 같은 말은 잡지 않도록 고른 낱말만
  '씨발', '시발', '씨빨', '씨바ㄹ', 'ㅅㅂ', 'ㅆㅂ', 'ㅅ1ㅂ', '씹새', '씹할', '좆', 'ㅈ같', '존나', '졸라', 'ㅈㄴ',
  '병신', 'ㅂㅅ', '븅신', '빙신', '개새끼', '개색', 'ㅅㄲ', '개같은', '지랄', 'ㅈㄹ', '미친놈', '미친년', '미친새',
  '닥쳐', '꺼져', '엠창', '느금', '니애미', '니미럴', '창녀', '섹스', '야동',
  '한남충', '한녀', '김치녀', '틀딱', '급식충', '맘충', '일베', '메갈', '장애인새', '죽어라', '뒤져', '뒤질',
  'fuck', 'shit', 'bitch', 'asshole', 'pussy', 'nigger', 'faggot', 'cunt',
];
const GAP = '[\\s.·,_\\-~*0-9!@#$%^&()]*';
const RE = new RegExp(WORDS.map((w) => [...w].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(GAP)).join('|'), 'gi');

export function cleanText(s) {
  return String(s || '')
    .replace(/[\u0000-\u001f\u200b-\u200f\u2028-\u202e]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .replace(RE, (m) => '♡'.repeat(Math.min(3, Math.max(1, Math.round(m.length / 2)))));
}
export const hasBadWord = (s) => { RE.lastIndex = 0; return RE.test(String(s || '')); };

// 연속 입력 제한: 2.5초에 한 번, 30초에 6번, 같은 말 되풀이 금지
export class ChatLimiter {
  constructor() { this.times = []; this.last = ''; this.lastT = 0; }
  check(text) {
    const now = Date.now();
    this.times = this.times.filter((t) => now - t < 30000);
    if (now - this.lastT < 2500) return '조금만 천천히요';
    if (this.times.length >= 6) return '잠시 쉬었다가 말해 주세요';
    if (text === this.last && now - this.lastT < 30000) return '같은 말을 바로 또 보낼 순 없어요';
    this.times.push(now); this.last = text; this.lastT = now;
    return null;
  }
}

// 가린 손님 (이 브라우저에만 저장)
export const blocked = {
  set: new Set(store.get('blocked', [])),
  has(uid) { return this.set.has(uid); },
  toggle(uid) {
    if (this.set.has(uid)) this.set.delete(uid); else this.set.add(uid);
    store.set('blocked', [...this.set].slice(-200));
    return this.set.has(uid);
  },
};

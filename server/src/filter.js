// 거친 말 거르기 (js/chat.js 와 같은 목록 — 한쪽을 고치면 다른 쪽도 고칠 것)
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

export const cleanText = (s) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80).replace(RE, (m) => '♡'.repeat(Math.min(3, Math.max(1, Math.round(m.length / 2)))));

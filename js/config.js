// =============================================================
//  엠케이아틀라스 서점 — 설정 파일
//  서버 주소, 방 인원, 음료, 고양이는 여기만 고치면 됩니다.
// =============================================================

export const CONFIG = {
  // 같은 room 이름으로 들어온 사람끼리 만납니다 (서버가 없을 때 P2P 방 이름 앞머리)
  roomPrefix: 'mkhz-bookshop-v1',

  // Cloudflare 방 서버 주소 (예: 'https://mkhz-bookshop.내아이디.workers.dev')
  // 비워 두면 PeerJS(P2P, 손님끼리 직접 연결)로 동작합니다.
  // "Deploy bookshop server" 워크플로가 배포한 뒤 이 자리에 주소를 자동으로 적어 넣습니다.
  serverUrl: new URLSearchParams(location.search).get('server') || '',

  // 서버가 막혀 P2P 로 넘어갔을 때 한 무리(방장 한 명에게 붙는 사람 수). 넘치면 다음 무리로.
  p2pCap: 20,

  // 말풍선이 보이는 거리 (m). 서점처럼 가까운 사람끼리만.
  chatRange: 9,

  // 배경 음악: audio/ 폴더에 파일을 넣으면 낮 · 밤에 따라 자연스럽게 바뀝니다. 없으면 조용히 넘어갑니다.
  music: {
    day: 'audio/bgm-day.mp3',
    night: 'audio/bgm-night.mp3',
    volume: 0.32,
  },

  // 카운터 음료 (모두 무료). color 는 컵 안의 색
  drinks: [
    { id: 'latte', name: '따뜻한 라떼', color: '#c99a6b', note: '우유 거품 위에 계피 한 꼬집' },
    { id: 'barley', name: '보리차', color: '#b8803e', note: '구수하게, 끝없이 리필' },
    { id: 'yuja', name: '유자차', color: '#f0b93a', note: '책장 넘기다 목이 칼칼할 때' },
    { id: 'cocoa', name: '핫초코', color: '#6b3f2a', note: '마시멜로 두 알' },
    { id: 'americano', name: '아메리카노', color: '#3a2418', note: '진하게, 밤새 읽을 사람에게' },
    { id: 'milktea', name: '밀크티', color: '#d6b38c', note: '얼그레이로 우렸어요' },
    { id: 'chamomile', name: '캐모마일', color: '#e8d27a', note: '잠들기 전 한 잔' },
    { id: 'omija', name: '오미자차', color: '#d0505a', note: '다섯 가지 맛' },
  ],

  // 서점 고양이
  cats: [
    { id: 'chaekgalpi', name: '책갈피', pattern: 'cheese', desc: '노랑 줄무늬. 펼쳐 둔 책 위에 꼭 눕는다' },
    { id: 'meokmul', name: '먹물', pattern: 'tuxedo', desc: '흰 양말 신은 먹물. 책장 꼭대기가 자기 자리' },
  ],
};

// 책바구니 · 이름 · 설정을 이 브라우저에 저장
export const store = {
  get(k, d) { try { const v = localStorage.getItem('mkhzbook.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mkhzbook.' + k, JSON.stringify(v)); } catch { /* 무시 */ } },
};

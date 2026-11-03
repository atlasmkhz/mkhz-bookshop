// =============================================================
//  엠케이아틀라스 서점 — 설정 파일
//  서버 주소, 방 인원, 음료, 고양이, 캣타워 제품, 영화관은 여기만 고치면 됩니다.
// =============================================================

export const CONFIG = {
  // 같은 room 이름으로 들어온 사람끼리 만납니다 (서버가 없을 때 P2P 방 이름 앞머리)
  roomPrefix: 'mkhz-bookshop-v2',

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

  // 야외 영화관
  cinema: {
    // 상영 목록은 data/program.json (대표 영상 모음을 거기에 적으면 됩니다)
    program: 'data/program.json',
    // 3D 스크린에 흐르는 짧은 예고 영상 자리 (없으면 글자 포스터가 보입니다). 소리 없이 반복.
    loop: 'video/screen-loop.mp4',
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

  // ---------------------------------------------------------
  // 고양이서가 캣타워 (실제 제품) — 고양이서가 카페에서 옮겨 옴
  //   glb: null 이면 코드로 만든 기본 모델을 씁니다. 'models/ormi.glb' 처럼 경로를 넣으면 그 파일로 바뀝니다.
  //   솔리드웍스는 보통 mm 단위라 scale: 0.001 이 맞을 때가 많습니다. (서점 단위는 1 = 1m)
  //   고양이가 오르내리는 자리는 js/products.js 의 *_NAV 에 제품 기준 좌표(m)로 있어 GLB로 바꿔도 그대로 쓰입니다.
  //   url 은 스마트스토어 주소로 바꾸세요.
  // ---------------------------------------------------------
  // 고양이서가 스마트스토어 — 카운터 한켠의 작은 안내판에서만 엽니다 (캣타워 카드에는 넣지 않음)
  store: { name: '고양이서가', url: 'https://smartstore.naver.com/withindesign' },

  // 카운터에서 빌리는 고양이 장난감 (무료). 들고 있으면 고양이 · 캣타워에서 놀아 줄 수 있어요
  toys: [
    { id: 'wand', ico: '🪶', name: '깃털 낚싯대', note: '카샤카샤 — 흔들면 펄쩍 뛰어올라요' },
    { id: 'laser', ico: '🔴', name: '레이저 포인터', note: '바닥의 빨간 점을 쫓아 우다다' },
    { id: 'ball', ico: '🔔', name: '방울 공', note: '굴리면 쫓아가 앞발로 톡톡' },
    { id: 'mouse', ico: '🐭', name: '쥐 인형', note: '던지면 덮쳐서 꼭 끌어안아요' },
    { id: 'catnip', ico: '🌿', name: '캣닢 쿠션', note: '킁킁, 뒹굴뒹굴 — 기분이 아주 좋아져요' },
  ],

  products: {
    jipsa4: { name: '집사4호 원목 캣타워', desc: '책장과 고양이 계단이 하나로 — 200.6 × 40 × 179.8 cm. 왼쪽은 수납장과 고양이 얼굴 칸, 오른쪽은 지그재그 계단과 방석 칸', glb: null, scale: 1, rotationY: 0, offset: [0, 0, 0] },
    customB: { name: '커스텀B 월캣타워', desc: '벽을 따라 250 × 46 × 179.8 cm. 흰 숨숨집 상자를 계단처럼 쌓고, 오른쪽은 둥근 창 칸과 지그재그 계단, 투명 해먹 30 cm', glb: null, scale: 1, rotationY: 0, offset: [0, 0, 0] },
    bella4: { name: '벨라4호 원목 캣타워', desc: '120 × 45.4 × 165 cm. 40 × 40 선반, 둥근 창 숨숨집, 아치 숨숨집, 스크래쳐 기둥, 투명 해먹과 옆 계단 상자(37 × 30 × 30)', glb: null, scale: 1, rotationY: 0, offset: [0, 0, 0] },
    cathouse: { name: '계단형 숨숨집', desc: '상자 넷을 계단처럼 — 맨 위는 아치 문 숨숨집, 아래는 열린 칸, 계단마다 펠트 방석', glb: null, scale: 1, rotationY: 0, offset: [0, 0, 0] },
    ormi: { name: '오르미캣타워', desc: '계단 프레임 · 숨숨집 상자 · 옆 수납칸', glb: null, scale: 1, rotationY: 0, offset: [0, 0, 0] },
    catwalk: { name: '월스텝 선반', desc: '벽에 붙이는 계단 선반 네 칸과 꼭대기 전망 선반', glb: null, scale: 1, rotationY: 0, offset: [0, 0, 0] },
  },

  // 서점 고양이 (카페 고양이들과 합쳤습니다)
  cats: [
    { id: 'chaekgalpi', name: '책갈피', pattern: 'cheese', desc: '노랑 줄무늬. 펼쳐 둔 책 위에 꼭 눕고, 가끔 우다다' },
    { id: 'meokmul', name: '먹물', pattern: 'tuxedo', desc: '흰 양말 신은 먹물. 책장 꼭대기가 자기 자리' },
    { id: 'samsaek', name: '삼색이', pattern: 'calico', desc: '삼색 얼룩, 서점 터줏대감. 평대 위 책을 떨어뜨린다' },
    { id: 'godeung', name: '고등어', pattern: 'mackerel', desc: '회색 고등어무늬, 캣타워 꼭대기 담당. 나비를 쫓는다' },
  ],
  // 서점 밖을 돌아다니는 진돗개 강아지 (coat: white 백구 · fawn 황구). 이름 · 소개는 여기서 바꿉니다.
  dogs: [
    { id: 'baekgu', name: '백구', coat: 'white', desc: '하얀 진돗개 강아지. 형 노릇을 하며 앞장서 걷고, 들꽃 언덕에서 땅 파기를 좋아한다' },
    { id: 'hwanggu', name: '황구', coat: 'fawn', desc: '누런 진돗개 강아지. 백구 뒤를 졸졸 따라다니다 바닷가에서 같이 뛰어논다' },
  ],
};

// 책바구니 · 이름 · 설정을 이 브라우저에 저장
export const store = {
  get(k, d) { try { const v = localStorage.getItem('mkhzbook.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mkhzbook.' + k, JSON.stringify(v)); } catch { /* 무시 */ } },
};

# 엠케이아틀라스 서점 (mkhz-bookshop)

역사 · 철학 · 과학 · 정치 아틀라스의 자료실 시리즈가 한 권씩 책이 된 **온라인 독립서점**입니다.
숲속 통나무 오두막 서점과, 문을 열고 나가면 펼쳐지는 숲 정원. 핵심은 "숨는 곳" — 넓지만 탁 트인 광장이 아니라, 다른 손님 눈에 잘 안 띄는 구석이 곳곳에 있습니다.

주소: https://atlasmkhz.github.io/mkhz-bookshop/ · 서점지기 건의함: https://atlasmkhz.github.io/mkhz-bookshop/admin.html

- 고양이서가 카페 엔진을 가져와 다시 지음: Three.js 3D, Cloudflare 방 서버(방 하나 100명), 서버가 막히면 P2P 자동 전환, 낮 · 밤, 앉기, 고양이, 톡 · 끌기 · 꾹 누르기 · 키보드 조작
- 책 84권 · 960편 (역사 57 · 철학 7 · 과학 12 · 정치 8). 앉을 자리 106곳 (실내 39 · 정원 67, 그중 숨은 자리 40)
- 설치 · 가입 없음, 폰 · PC

## 서점 안

| 자리 | 내용 |
|---|---|
| 다락 아래 책장 골목 | 역사아틀라스 (우리 역사 · 세계사 · 옛 문학 · 인물열전). 골목 끝은 막다른 자리, 계단 뒤 구석 |
| 2층 다락 | 커튼 친 다락 구석, 빈백, 난간 아래를 내려다보는 방석, 작은 책상, 둥근 창 |
| 높은 책장 + 사다리 | 과학아틀라스 (북동쪽 벽, 4.8m). 고양이 먹물이 사다리를 타고 꼭대기에서 잠 |
| 가운데 책장 섬 | 정치아틀라스(앞) · 철학아틀라스(뒤) |
| 평대 | 이번 달의 책 8권 (표지가 보이게 누워 있음, 달마다 바뀜) |
| 벽난로 | 방석 · 안락의자 · 빈백, 장작 소리 |
| 창가 독서 의자 · 퇴창 벤치 · 소파 | 스탠드 조명 |
| 카운터 | 음료 8가지 (무료), 다른 손님에게 선물 |
| 건의함 | 「서점지기에게 한마디」 |

## 숲 정원

오솔길이 갈래로 나뉘고 끝마다 숨은 자리: 나무 그늘 해먹 숲, 시냇가 바위(다리 두 개), 덤불 뒤 벤치 네 곳, 작은 정자, 들꽃 언덕 돗자리, 나무 위 오두막(사다리 계단), 모닥불 통나무, 큰 나무 그네, 길가 그루터기.
낮엔 햇살 · 나뭇잎 그림자 · 나비 · 새소리, 밤엔 길가 등불 · 반딧불 · 풀벌레 · 모닥불. 시냇가에 가까이 가면 물소리.

## 손님이 하는 일

- 책등을 누르면 표지와 목차가 펼쳐짐 → 「담기」로 책바구니에
- 🧺 책바구니: 어디서든(앉아서 · 서서 · 정원에서) 담은 책의 편을 골라 읽기 → 아틀라스 실제 글이 새 창으로. 읽은 편은 표시됨. 「서가 둘러보기」에서 84권 전체를 고르고 「꽂힌 자리로」 걸어갈 수도 있음
- 책바구니 · 읽은 편 · 이름 · 음료는 그 브라우저에 저장 (localStorage)
- ☕ 카운터에서 음료 고르기, 다른 손님을 눌러 음료 선물 · 인사 · 가리기
- 💬 말풍선 채팅: 9m 안의 사람에게만 보임. 거친 말 거르기, 연속 입력 제한(2.5초에 한 번, 30초에 6번, 같은 말 되풀이 금지), 특정 손님 가리기
- 고양이 책갈피 · 먹물: 쓰다듬기(하트 + 골골송), 간식 주기
- ☀️/🌙 낮밤, ☔ 빗소리, 🔈 소리. 책을 펼치면 책장 넘기는 소리

## 조작

| 폰 | PC |
|---|---|
| 톡: 그 자리로 걷기 · 의자 누르면 앉기 · 책 · 고양이 · 손님 누르기 | 클릭 |
| 끌기: 시점 돌리기 | 드래그 |
| 꾹 누른 채 끌기: 손가락 쪽으로 걷기 | WASD · 방향키, Q/E 회전 |
| 두 손가락: 크게 · 작게 | 휠 · Enter 로 말하기 |

다락 · 나무 위 오두막은 계단으로 올라갑니다 (2층 바닥을 누르면 알아서 계단으로 감). 다락 아래로 들어가면 다락이 잠시 접혀 책장 골목이 보입니다. 카메라와 나 사이의 벽 · 들보 · 나뭇잎도 잠시 접힙니다.

## 책 만들기 (data/books.json)

```bash
python3 scripts/build_books.py
```

네 아틀라스 저장소가 이 폴더 옆(../atlas, ../philo-atlas, ../science-atlas, ../politics-atlas)에 있어야 합니다. 다른 곳이면 `--src 폴더`. 네 저장소는 읽기만 합니다.
필요한 것: python3, node(아틀라스 자료 파일이 자바스크립트라서), Pillow(표지 줄이기).

| 아틀라스 | 읽는 곳 | 편 주소 |
|---|---|---|
| 역사 | content/archive/*.js | 글 파일의 canonical (https://atlas.mkhz.kr/archive/…) |
| 철학 | data/archive_index.js + build/port_src/series.json | https://philo.mkhz.kr/archive/… |
| 과학 | data/library.js (시리즈 LIBRARY_SERIES) | https://science.mkhz.kr/library/… |
| 정치 | content/archive/*.js + js/library-data.js(연재) | https://politics.mkhz.kr/library/… |

- 책 한 권 = 제목, 부제, 편수, 첫 문장 한 줄(첫 편 본문의 첫 문장), 한 줄 소개, 각 편의 실제 주소(목차)
- 같은 시리즈가 두 곳에 있으면 한 곳에만: 철학 > 과학 > 정치 > 역사. 정치아틀라스가 역사아틀라스를 원본으로 둔 시리즈는 역사
- 표지: 시리즈 히어로 그림이 있으면 가운데를 4:3으로 잘라 420px webp로 `assets/covers/` 에 복사(77권). 없으면 제목 글자 · 원 · 선으로 코드가 그리는 글자 표지(7권). 둘 다 종이색 바탕, 아틀라스 색 책등, MK ATLAS · 분류 번호 · 편수가 찍힌 독립출판물 판형. 그림 출처는 책 카드에 함께 표시
- 책등 색: 역사 붉은 갈색, 철학 짙은 남색, 과학 청록, 정치 올리브

## 고치는 곳

`js/config.js` — 서버 주소, P2P 한 무리 인원, 말풍선 거리, 음악, 음료, 고양이.

```
index.html · admin.html   화면 틀 · 건의함 목록(서점지기용)
css/style.css             화면 위 UI · 표지
js/main.js                시작 · 카메라 · 잘라 보기 · 낮밤 · 손님 · 동기화 · 채팅 · 음료 · 건의함
js/cabin.js               오두막 실내 · 다락 · 책장 · 벽난로 · 카운터 · 건의함
js/forest.js              숲 정원 · 오솔길 · 시내 · 해먹 · 정자 · 들꽃 언덕 · 나무 위 오두막 · 모닥불
js/shelves.js             책장 · 진짜 책(책등 글씨) · 장식 책 · 평대
js/covers.js              표지 (HTML · 캔버스)
js/furniture.js           앉을 자리 · 의자 · 방석 · 빈백 · 벤치 · 조명
js/nav.js                 이동 · 2층(계단) · 격자 길찾기(A*)
js/cats.js js/catModel.js 서점 고양이
js/avatar.js              손님 캐릭터 · 컵 · 말풍선
js/chat.js                거친 말 거르기 · 연속 입력 제한 · 가리기
js/net.js js/netServer.js P2P(PeerJS) · Cloudflare 방 서버 연결
js/audio.js               빗소리 · 장작 · 책장 · 시냇물 · 새 · 풀벌레 · 골골송 · 음악
js/ui.js js/kit.js js/fx.js js/controls.js
data/books.json           책 목록 (scripts/build_books.py 가 만듦)
assets/covers/            표지 그림
server/                   Cloudflare Workers + Durable Objects 방 서버
audio/                    배경 음악 자리 (bgm-day.mp3, bgm-night.mp3)
vendor/                   three.js r160, PeerJS 1.5.4 (CDN 없이 동작)
```

## 방 서버 (Cloudflare) 처음 한 번 설정 — 고양이서가 카페와 같은 방식

1. Cloudflare 대시보드 → My Profile → API Tokens → Create Token → Edit Cloudflare Workers 템플릿으로 토큰 만들기
2. Cloudflare 대시보드 Workers 화면에서 Account ID 복사
3. GitHub 레포 → Settings → Secrets and variables → Actions → New repository secret
   - `CLOUDFLARE_API_TOKEN` = 1번 토큰
   - `CLOUDFLARE_ACCOUNT_ID` = 2번 ID
   - `ADMIN_KEY` = 건의함 목록을 여는 열쇠 (아무 긴 글자, 선택)
4. GitHub 레포 → Actions → Deploy bookshop server → Run workflow

그러면 서버가 올라가고, 주소가 `js/config.js` 의 `serverUrl` 에 자동으로 적힙니다. 이후 `server/` 를 고쳐 main 에 올리면 자동으로 다시 배포됩니다.
서버 주소가 없는 동안에는 P2P(손님끼리 직접 연결)로 동작하고, 건의함 글은 손님 브라우저에 모아 두었다가 서버가 생기면 보냅니다.

- 방 인원: `server/wrangler.toml` 의 `ROOM_CAP` (100)
- 방 개수: `MAX_ROOMS` (5)
- 말풍선이 전해지는 거리: `CHAT_RANGE` (12m, 화면에는 9m 안쪽만 보임)
- 건의함: 서버에 저장(최근 2,000건). 한 사람 하루 5번, 서점 전체 하루 300건까지

## 무료 플랜(Workers Free)으로 버티는 방법

무료 한도는 하루 요청 10만 건 · 실행시간 13,000 GB-s이고, 넘으면 오류가 납니다. 그래서:

- 서버는 WebSocket Hibernation API를 써서 메시지가 없을 땐 잠듭니다 (실행시간이 안 쌓임). 서버 쪽 타이머 · 알람 없음
- 연결 유지용 ping(50초마다)은 서버를 깨우지 않는 자동 응답
- 손님 위치는 움직일 때만: 톡으로 걸으면 목적지 1번 + 도착 1번, 키보드로 움직일 땐 1초에 3번 이하
- 고양이는 좌표 대신 "어디로 간다 · 무엇을 한다"는 계획만 (걸을 길도 계획에 같이 담아 보냄). 혼자 있는 방에선 보내지 않음
- 채팅: 서버가 가까운 손님에게만 전달. 보내는 쪽도 가까이 아무도 없으면 아예 보내지 않음. 음료 선물은 받는 사람 한 명에게만
- 서버가 막히면(한도 초과 · 고장) 손님 화면은 자동으로 P2P로 넘어가 계속 머뭅니다. P2P 한 무리는 20명, 넘치면 다음 무리로

대략적인 계산 (Durable Object 는 받은 WebSocket 메시지 20개를 요청 1건으로 셉니다)

| 무엇 | 손님 1명 · 1시간 |
|---|---|
| ping (50초마다) | 72개 |
| 걷기 · 앉기 (톡 30번 안팎) | 60개 |
| 말풍선 · 음료 · 인사 | 20~40개 |
| 합계 | 약 150~170개 ≈ 요청 8~9건 (+ 접속 1건) |

→ 하루 10만 건이면 약 1만 손님-시간. 말풍선을 새로 만들며 더해진 몫은 손님 1명이 1분에 한 번 말할 때 시간당 3건 남짓입니다.
실행시간이 더 빠듯합니다: 손님이 늘 있는 방은 계속 깨어 있어 방 하나가 하루 종일 깨어 있으면 약 10,800 GB-s(한도의 83%)를 씁니다. 그래서 `MAX_ROOMS` 는 5로 두었고, 넘치면 P2P로 넘어갑니다.
실제 사용량은 Cloudflare 대시보드 → Workers → Durable Objects 에서 확인하세요.

## 로컬에서 보기

```bash
python3 -m http.server 8765
```

http://localhost:8765 (서버까지: `cd server && npm ci && npx wrangler dev --port 8787` 후 `http://localhost:8765/?server=http://127.0.0.1:8787`)

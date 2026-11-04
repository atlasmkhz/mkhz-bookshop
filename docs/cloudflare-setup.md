# 엠케이아틀라스 서점 — Cloudflare 정리 · 도메인 · 배포 지시서 (Claude 채팅용)

이 글은 서점지기(박효순)가 Claude 채팅(브라우저를 함께 보는 Claude)에게 붙여 넣어 순서대로 함께 진행하기 위한 지시서입니다.
답과 안내는 한국어로, 쉬운 말로, 굵은 글씨 없이 해 주세요. 한 단계를 끝낼 때마다 화면을 확인하고 다음으로 넘어갑니다.

## 지금 상태 (2026-11-05 기준)

- 서점 사이트: https://bookshop.mkhz.kr/ (2026-11-04 주소 옮김, 옛 주소 https://atlasmkhz.github.io/mkhz-bookshop/ 는 새 주소로 넘어감)
  (저장소 atlasmkhz/mkhz-bookshop, main 에 올리면 gh-pages 로 저절로 옮겨져 배포됨. 이 부분은 할 일 없음)
- 서점 채팅 서버(Cloudflare Worker 이름 mkhz-bookshop)와 미술관 서버(Worker 이름 mkhz-gallery)는 아직 한 번도 올라가지 않았음.
  원인: 저장소에 Cloudflare 비밀값(CLOUDFLARE_API_TOKEN · CLOUDFLARE_ACCOUNT_ID)이 없음. 그래서 지금 서점은 손님끼리 직접 잇는 P2P 로만 돌아감.
- 고양이서가 카페: Worker 이름 catseoga-cafe (주소 https://catseoga-cafe.hyosoonpark2477.workers.dev),
  사이트는 GitHub Pages(atlasmkhz/catseoga-cafe 저장소). 서점이 카페를 합쳐 이어받았으므로 카페는 내린다.
- Cloudflare 계정의 workers.dev 하위 주소: hyosoonpark2477.workers.dev

## 지켜 주세요

- 비밀값(API 토큰 · ADMIN_KEY)은 채팅에 적지 않습니다. 서점지기가 직접 복사해 붙여 넣게 안내만 하고, 화면에 보이면 다시 가려 달라고 합니다.
- 지우는 것은 아래 4단계에 적힌 catseoga-cafe 하나뿐입니다. 다른 Worker · Pages(역사 · 철학 · 과학 · 정치 아틀라스 사이트)는 절대 건드리지 않습니다. 지우기 전에 이름을 소리 내어 확인받습니다.
- 저장소 코드는 Claude 채팅이 고치지 않습니다. 코드를 고칠 일(3단계 끝)은 Claude Code 에게 맡깁니다.

## 1단계. 서점 저장소에 Cloudflare 비밀값 넣기 (채팅 · 미술관 서버를 올리기 위해)

1. Cloudflare 대시보드(dash.cloudflare.com) → 오른쪽 위 사람 모양 → My Profile → API Tokens → Create Token.
2. 「Edit Cloudflare Workers」 템플릿 → Use template.
   - Account Resources: 서점지기 계정 하나만, Zone Resources: All zones 그대로.
   - 권한 목록에 「Workers R2 Storage: Edit」이 있는지 확인. 없으면 + Add more 로 Account → Workers R2 Storage → Edit 를 더함 (미술관 사진 창고를 만드는 데 필요).
   - Continue to summary → Create Token → 나온 토큰을 복사 (이 화면을 닫으면 다시 볼 수 없음).
3. Cloudflare 대시보드 → Workers & Pages 첫 화면 오른쪽의 Account ID 를 복사.
4. GitHub → atlasmkhz/mkhz-bookshop → Settings → Secrets and variables → Actions → New repository secret 으로 세 개를 만든다.
   - CLOUDFLARE_API_TOKEN: 2번의 토큰
   - CLOUDFLARE_ACCOUNT_ID: 3번의 Account ID
   - ADMIN_KEY: 서점지기가 정한 아무 긴 글자 (건의함 · 미술관 관리 화면 admin.html 을 여는 열쇠). 따로 적어 둔다.

## 2단계. 미술관 사진 창고(R2) 켜기

1. Cloudflare 대시보드 → R2 Object Storage → 켜기(Purchase/Enable R2). 무료 한도(10 GB) 안이면 돈이 나가지 않지만 결제 수단 등록을 요구할 수 있다.
2. 버킷은 만들지 않아도 된다 (다음 단계 워크플로가 mkhz-gallery 를 만든다).

## 3단계. 서버 두 개 올리기

1. GitHub → atlasmkhz/mkhz-bookshop → Actions → 왼쪽 「Deploy bookshop server」 → Run workflow (Branch: main) → 초록 체크가 될 때까지 기다림.
   - 끝나면 워크플로가 js/config.js 의 serverUrl 에 https://mkhz-bookshop.hyosoonpark2477.workers.dev 를 저절로 적어 넣고 사이트에 반영함.
2. 같은 곳에서 「Deploy gallery server」 → Run workflow → 초록 체크 확인.
   - js/config.js 의 gallery.api 에 https://mkhz-gallery.hyosoonpark2477.workers.dev 가 저절로 들어감.
3. 빨간 X 가 나오면 실패한 단계를 눌러 로그 마지막 20줄을 서점지기에게 보여 주고 원인을 쉬운 말로 설명 (흔한 원인: 토큰 권한 부족, R2 꺼짐).
4. (선택, 권장) R2 → mkhz-gallery → Settings → Public access 에서 r2.dev 공개 주소를 켜고, 그 주소를 서점지기가 Claude Code 에게 알려 준다 (사진을 서버를 거치지 않고 받아 하루 요청 수가 줄어듦).
5. 확인: https://atlasmkhz.github.io/mkhz-bookshop/ 를 새로고침 → 왼쪽 위 「MK 서점」 옆 점이 초록이고 「혼자 머무는 중」 또는 「n명」이 뜨면 서버 연결 성공.

## 4단계. 고양이서가 카페 내리기

1. Cloudflare 대시보드 → Workers & Pages → 목록에서 이름이 정확히 「catseoga-cafe」 인 Worker 를 연다.
   이름을 서점지기에게 확인받은 뒤 → Settings → 맨 아래 Delete → 이름을 입력해 지움.
   (안의 Durable Object 방 데이터도 함께 지워진다. 서점 Worker(mkhz-bookshop · mkhz-gallery)는 지우지 않는다.)
2. GitHub → atlasmkhz/catseoga-cafe → Settings → Pages → 「Unpublish site」(또는 Source 를 None 으로) → 카페 사이트가 내려간다.
3. (선택) 같은 저장소 Settings → General → 맨 아래 Archive this repository (읽기 전용 보관. 서점이 배경 음악을 이 저장소에서 복사해 왔으므로 지우기보다 보관을 권함).
4. (선택) catseoga-cafe 저장소의 Settings → Secrets 에 남은 Cloudflare 토큰은 쓰지 않게 되므로, Cloudflare → API Tokens 에서 카페용으로 만들었던 옛 토큰을 Roll/Delete 해도 된다. 새로 만든 서점 토큰은 지우지 않는다.

## 5단계. 서점 주소(도메인) 바꾸기 — 예: bookshop.mkhz.kr

먼저 서점지기에게 쓸 주소를 정해 받는다 (추천: bookshop.mkhz.kr. 다른 아틀라스와 같은 mkhz.kr 아래).

1. (2026-11-04 완료) mkhz.kr 의 DNS 는 Cloudflare 가 아니라 가비아(dns.gabia.com)에 있다. 가비아 DNS 관리 → mkhz.kr 설정 → 레코드 수정 → 레코드 추가
   - 타입: CNAME, 호스트: bookshop, 값/위치: atlasmkhz.github.io. , TTL 600
   - 다른 아틀라스 줄(atlas · philo · politics · science · studio)은 건드리지 않는다.
2. 서점지기가 Claude Code 에게 이렇게 말한다 (1번 DNS 를 만든 바로 뒤에):
   「서점 주소를 https://bookshop.mkhz.kr 로 바꿀 거야. CNAME 파일을 만들고, 서버 두 곳의 ALLOWED_ORIGINS, 링크 미리 보기 주소(og:url · og:image), README 를 새 주소로 고쳐서 올려 줘」
   - 꼭 Claude Code 가 저장소에 CNAME 파일을 넣어야 한다. 이 저장소는 올릴 때마다 main 을 gh-pages 로 통째로 덮어써서,
     GitHub 설정 화면에서만 도메인을 넣으면 다음 배포 때 지워진다.
   - Claude Code 가 올리면 서버 두 개도 저절로 다시 배포되어 새 주소에서 채팅 · 미술관이 열린다.
3. GitHub → atlasmkhz/mkhz-bookshop → Settings → Pages 에 Custom domain 으로 bookshop.mkhz.kr 이 들어와 있는지 확인
   → 「DNS check successful」이 뜰 때까지 기다림(몇 분~1시간) → Enforce HTTPS 체크.
   인증서가 나온 뒤에는 Cloudflare DNS 의 구름을 주황(Proxied)으로 바꿔도 되지만, 바꾸면 SSL/TLS 를 Full 로 둔다. 잘 모르겠으면 회색 그대로 둔다.
4. 확인: https://bookshop.mkhz.kr 이 열리고, 옛 주소 https://atlasmkhz.github.io/mkhz-bookshop/ 로 들어가도 새 주소로 넘어가는지 본다.
5. 카카오톡 링크 미리 보기를 새로 읽히려면 카카오 공유 디버거(developers.kakao.com/tool/debugger/sharing)에서 새 주소를 넣고 「캐시 초기화」.

## 6단계. 마지막 확인표

- [ ] 서점 사이트 왼쪽 위 점이 초록 (채팅 서버 연결)
- [ ] 휴대폰 두 대로 같은 방에 들어가 서로 보이고, 말하기 · 같이 산책이 된다
- [ ] 미술관 입구 기둥에서 사진 올리기가 된다 (자동 검사 뒤 대기열 → 벽에 걸림)
- [ ] admin.html 이 ADMIN_KEY 로 열린다 (건의함 · 미술관 작품)
- [ ] Workers & Pages 목록에 catseoga-cafe 가 없고, mkhz-bookshop · mkhz-gallery 가 있다
- [ ] 새 주소 bookshop.mkhz.kr 이 열리고 자물쇠(HTTPS)가 보인다

## 무료 한도 메모

- Workers 무료: 하루 요청 10만 건(서점 채팅 + 미술관을 합쳐서), 넘으면 오류가 나고 서점은 저절로 P2P 로 넘어간다. 요금이 청구되지는 않는다.
- R2 무료: 10 GB 저장, 읽기 월 1천만 회. Workers AI 무료: 하루 일정량(사진 자동 검사에만 씀).
- 사용량은 Cloudflare 대시보드 → Workers & Pages → 각 Worker → Metrics 에서 본다.

# 스마트 옷장

옷을 기록하고, 서울의 현재 기온과 색조합 점수로 코디를 추천하는 웹앱입니다.

- 프런트엔드: `public/` (HTML·CSS·JavaScript)
- 백엔드: `lib/app.js` (Express) — 로컬은 `server.js`, Vercel은 `api/index.js`
- DB: Neon PostgreSQL (`DATABASE_URL`)
- 날씨: OpenWeatherMap (`WEATHER_API_KEY`, 서버에서만 호출)

## 로컬 실행

```bash
npm install
cp .env.example .env   # DATABASE_URL, WEATHER_API_KEY 입력
npm run dev            # http://localhost:3000
npm test               # 색조합·추천 규칙 테스트
```

테이블이 아직 없다면 `db/schema.sql`을 Neon SQL Editor에서 실행합니다.
이미 테이블이 있고 비밀번호 기능 이전 버전이라면 `db/002_add_password.sql`을 실행합니다.

## Vercel 배포

1. GitHub 저장소에 push합니다. (`.env`는 `.gitignore`로 제외됩니다.)
2. Vercel에서 저장소를 Import합니다. Framework Preset은 **Other**로 둡니다.
3. Project Settings → Environment Variables에 `DATABASE_URL`, `WEATHER_API_KEY`를 추가합니다. (`SESSION_SECRET`은 선택)
4. 배포 후 `public/`은 정적 파일로, `/api/*`는 `api/index.js` 함수로 처리됩니다.

## API

로그인하면 서버가 HttpOnly 세션 쿠키(`closet_session`, 30일)를 발급합니다. 가입·로그인을 제외한 모든 API는
이 쿠키로 로그인한 옷장을 확인하고, 그 옷장의 데이터만 다룹니다.

- 아이디: 영문 소문자, 숫자, `_`, `-` 3~20자 (대소문자 구분 없음, 중복 불가)
- 비밀번호: 3~20자, 영문·숫자·특수문자 각 1개 이상 (대소문자 구분). scrypt 해시로만 저장

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/closets` | 회원가입 `{id, password}` (아이디 중복이면 409) |
| POST | `/api/session` | 로그인 `{id, password}` |
| DELETE | `/api/session` | 로그아웃 |
| GET | `/api/closets/me` | 로그인한 아이디 확인 |
| GET | `/api/clothes?category=&color=` | 옷 목록 (종류·색상 필터) |
| POST / PUT / DELETE | `/api/clothes[/:id]` | 옷 등록·수정·삭제 |
| GET | `/api/weather` | 서울 현재 날씨 |
| GET | `/api/recommendations` | 오늘 기온 기준 추천 TOP 3 |
| GET / POST / DELETE | `/api/outfits[/:id]` | 저장한 코디 |

# 중고차마당 (carmarket)

개인간(C2C) 중고차 직거래 학습용 웹 애플리케이션. React + Vite 클라이언트와 Express +
SQLite(`better-sqlite3`) 서버로 구성된다. 상세 설계/API 문서는
`docs/superpowers/specs/design.md`, `docs/superpowers/specs/api-spec.md` 참고
(claude-project 저장소 루트 기준).

## Docker로 실행하기

로컬에 Docker Desktop(또는 Docker Engine + Compose plugin)만 있으면 된다 — Node/npm을
직접 설치할 필요 없음.

```bash
docker compose up --build
```

- 클라이언트: http://localhost:8080
- 서버 API: http://localhost:4000/api/health

최초 실행 시 서버 컨테이너가 뜨면서 DB 마이그레이션 + 카탈로그(제조사~트림) 시드 +
샘플 매물 27건이 자동으로 채워진다(전부 멱등 — 이미 데이터가 있으면 다시 채우지 않는다).
회원가입 후 매물 등록/검색/찜/채팅까지 바로 써볼 수 있다.

종료하려면 `Ctrl+C` 또는 다른 터미널에서:

```bash
docker compose down
```

`down`을 해도 DB/업로드 이미지는 named volume(`db-data`, `uploads-data`)에 남아있어서,
다시 `docker compose up`하면 이전 데이터 그대로 이어진다. 완전히 초기화하고 싶으면:

```bash
docker compose down -v
```

### 구성

| 컨테이너 | 이미지 베이스 | 역할 |
|---|---|---|
| `server` | `node:22-bookworm-slim` (멀티스테이지) | Express API, SQLite 파일 관리, 업로드 이미지 정적 서빙 |
| `client` | `node:22-bookworm-slim`(빌드) → `nginx:1.27-alpine`(서빙) | `vite build` 결과 정적 서빙 (dev 서버 아님) |

- `db-data` 볼륨 → 컨테이너 안 `/app/data/carmarket.sqlite` (서버 코드와 분리된 전용
  데이터 디렉터리 — `DB_PATH` 환경변수로 지정)
- `uploads-data` 볼륨 → 컨테이너 안 `/app/uploads` (매물 사진)
- 클라이언트는 빌드 시점에 `VITE_API_BASE_URL`(기본값 `http://localhost:4000`)을 정적
  번들에 박아 넣는다 — Vite 환경변수는 런타임이 아니라 빌드 타임에 고정되므로, API 주소를
  바꾸려면 `docker compose build client`로 다시 빌드해야 한다.

### 환경변수 바꾸기

호스트가 아닌 다른 주소로 배포하는 경우 등, 기본값을 바꾸려면 `ch05/` 밑에 `.env` 파일을
만들면 된다(git에는 안 올라감):

```
JWT_SECRET=실제로-쓸-랜덤-문자열
VITE_API_BASE_URL=http://내-서버-주소:4000
```

### 개별 컨테이너 로그/쉘 확인

```bash
docker compose logs -f server
docker compose exec server sh
```

## Docker 없이 로컬에서 실행하기 (기존 방식)

```bash
cd server && npm install && npm run seed && npm run seed:cars && npm run dev
cd client && npm install && npm run dev
```

# better-sqlite3는 네이티브(C++) 모듈이라 컨테이너 OS/아키텍처에 맞게 설치 단계에서
# 직접 빌드되어야 한다 — 호스트에서 만든 node_modules를 복사하면 안 된다.
# Debian slim(glibc) 베이스를 쓰는 이유: Alpine(musl)보다 네이티브 모듈 prebuilt 바이너리
# 호환성이 좋아 별도 컴파일 없이 설치되는 경우가 많다. 그래도 prebuilt가 없을 경우를 대비해
# 빌드 스테이지에만 컴파일 툴체인(python3/make/g++)을 넣는다 — 런타임 이미지엔 넣지 않는다.
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# ---- 런타임 스테이지: 컴파일 툴체인 없이 결과물만 ----
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 4000
CMD ["node", "index.js"]

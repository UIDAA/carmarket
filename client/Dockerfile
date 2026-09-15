# ---- build stage ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite는 VITE_ 접두사 환경변수를 "빌드 시점"에 정적 번들 안에 그대로 박아넣는다(런타임에 바꿀
# 수 없음) — 그래서 docker-compose의 build.args로 전달받아 여기서 ENV로 노출해야
# `npm run build`(vite build)가 읽을 수 있다. 브라우저가 실제로 접속할 서버 주소를 넣어야
# 하며(예: http://localhost:4000), 컨테이너 내부 네트워크 이름(http://server:4000)을 넣으면
# 안 된다 — API 요청은 서버 컨테이너가 아니라 사용자 브라우저가 직접 보낸다.
ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ---- 런타임 스테이지: dev 서버 대신 정적 파일을 nginx로 서빙 ----
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

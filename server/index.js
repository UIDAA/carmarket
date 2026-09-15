const { createDb } = require('./db/schema');
const { seed } = require('./db/seed');
const { seedCars } = require('./db/seedCars');
const { createApp } = require('./app');

// DB_PATH가 있으면 그 경로를 쓴다 — Docker에서 db/ 디렉터리(코드 파일들과 같이 있음) 대신
// 코드가 없는 별도 데이터 디렉터리에 볼륨을 마운트하기 위함(볼륨을 db/에 바로 마운트하면
// 최초 1회만 이미지 내용이 복사되고, 이후 schema.js/seed.js를 고쳐도 볼륨엔 반영되지 않는다).
const db = createDb(process.env.DB_PATH); // 마이그레이션은 항상 실행(멱등) — 이미 적용됐으면 그냥 통과한다.
seed(db); // 카탈로그(제조사~트림)도 find-or-create라 멱등 — 이미 있으면 다시 안 채운다.

// 샘플 매물은 최초 실행(매물이 0건일 때)에만 시드한다 — 매번 자동으로 돌리면 재시작할 때마다
// 데모 매물이 초기화되어 그 사이 생긴 즐겨찾기/채팅 등이 끊긴다.
const carCount = db.prepare('SELECT COUNT(*) AS c FROM cars').get().c;
if (carCount === 0) {
  seedCars(db);
}

const app = createApp(db);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

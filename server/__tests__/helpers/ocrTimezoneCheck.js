// carsOcr.test.js의 타임존 회귀 테스트가 별도 자식 프로세스로 실행하는 스크립트.
//
// 왜 별도 프로세스인가: V8/Node는 프로세스가 시작될 때 로컬 타임존을 캐시하기 때문에,
// 이미 떠 있는 Jest 워커 프로세스 안에서 테스트 도중 `process.env.TZ`를 바꿔도
// `Date.prototype.getFullYear()`/`getMonth()` 같은 로컬 getter의 결과에는 반영되지
// 않는다(직접 확인함 — 테스트 안에서 TZ를 바꿔봐도 버그 재현이 안 됐다). TZ를
// 프로세스 시작 "이전"에 환경변수로 넘겨야 실제로 그 타임존으로 동작하므로,
// `child_process`로 이 스크립트를 `TZ=America/New_York` 환경과 함께 새로 띄운다.
//
// jest.mock을 쓸 수 없는 순수 node 프로세스이므로, gemini 모듈의 export를 직접
// 덮어써서 recognizeRegistration을 스텁으로 바꾼다 — cars.js가 이 모듈을 처음
// require할 때(=이 스크립트가 app을 require할 때) 구조분해로 값을 읽어가므로,
// 그 전에 export 프로퍼티를 바꿔치기하면 된다.
const jwt = require('jsonwebtoken');
const request = require('supertest');

const gemini = require('../../services/gemini');
gemini.recognizeRegistration = async () => ({
  firstRegisteredDate: '2021-01-01',
  modelName: null,
  displacementCc: null,
  fuelType: null,
});

const { JWT_SECRET } = require('../../config');
const { createDb } = require('../../db/schema');
const { createApp } = require('../../app');

async function main() {
  const db = createDb(':memory:');
  const app = createApp(db);
  const token = jwt.sign({ userId: 1 }, JWT_SECRET);

  const res = await request(app)
    .post('/api/cars/ocr')
    .set('Authorization', `Bearer ${token}`)
    .attach('photo', Buffer.from('fake'), 'reg.png');

  process.stdout.write(JSON.stringify({ status: res.status, body: res.body }));
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.exit(1);
});

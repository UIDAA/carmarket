const { createDb } = require('./db/schema');
const { createApp } = require('./app');

const db = createDb();
const app = createApp(db);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

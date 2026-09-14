// manufacturers/model_groups/models/trims 등 "이미 있으면 재사용, 없으면 생성" 패턴을
// schema.js(레거시 마이그레이션), seed.js(카탈로그 시드), 테스트 픽스처가 공통으로 쓰는 헬퍼.
// 예전에는 세 곳에 동일한 함수가 그대로 복붙되어 있었다 — 여기 한 곳만 고치면 된다.
function findOrCreate(db, table, whereCols, insertCols) {
  const whereClause = Object.keys(whereCols)
    .map((col) => `${col} = ?`)
    .join(' AND ');
  const existing = db.prepare(`SELECT * FROM ${table} WHERE ${whereClause}`).get(...Object.values(whereCols));
  if (existing) return existing;

  const cols = Object.keys(insertCols);
  const placeholders = cols.map(() => '?').join(', ');
  const result = db
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
    .run(...Object.values(insertCols));
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid);
}

module.exports = { findOrCreate };

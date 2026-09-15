// 카탈로그 시드 데이터 무결성 검증 스크립트.
// 인메모리 DB에 스키마+시드를 적용한 뒤 아래 4가지를 검사한다. 전부 0건이어야 정상.
//   1. start_year > end_year인 세대
//   2. 같은 model_group 안에서, 같은 powertrain끼리 생산기간이 겹치는 세대
//      (일반/하이브리드/전기처럼 파워트레인이 다른 행은 같은 세대의 파생형이라
//      연도 범위가 겹치는 게 정상이므로 검사 대상에서 제외한다)
//   3. end_year가 미래(TODAY_YEAR 초과)인 세대
//   4. 트림이 0개인 세대
const { createDb } = require('../db/schema');
const { seed } = require('../db/seed');

const TODAY_YEAR = 2026;

function main() {
  const db = createDb(':memory:');
  seed(db);

  const models = db
    .prepare(
      `SELECT models.id, models.name, models.powertrain, models.start_year, models.end_year,
              model_groups.id AS model_group_id, model_groups.name AS model_group_name,
              manufacturers.name AS manufacturer_name
       FROM models
       JOIN model_groups ON model_groups.id = models.model_group_id
       JOIN manufacturers ON manufacturers.id = model_groups.manufacturer_id`
    )
    .all();

  const trimCounts = new Map(
    db
      .prepare('SELECT model_id, COUNT(*) AS count FROM trims GROUP BY model_id')
      .all()
      .map((row) => [row.model_id, row.count])
  );

  const label = (m) => `${m.manufacturer_name} ${m.model_group_name} / ${m.name} (${m.powertrain})`;

  // 1. start_year > end_year
  const invalidRange = models.filter((m) => m.end_year !== null && m.start_year > m.end_year);

  // 2. 같은 model_group + 같은 powertrain 안에서 겹치는 생산기간
  const overlaps = [];
  const byGroupPowertrain = new Map();
  for (const m of models) {
    const key = `${m.model_group_id}:${m.powertrain}`;
    if (!byGroupPowertrain.has(key)) byGroupPowertrain.set(key, []);
    byGroupPowertrain.get(key).push(m);
  }
  for (const group of byGroupPowertrain.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const aEnd = a.end_year ?? Infinity;
        const bEnd = b.end_year ?? Infinity;
        const overlapping = a.start_year <= bEnd && b.start_year <= aEnd;
        if (overlapping) overlaps.push([a, b]);
      }
    }
  }

  // 3. end_year가 미래
  const futureEnd = models.filter((m) => m.end_year !== null && m.end_year > TODAY_YEAR);

  // 4. 트림 0개
  const zeroTrims = models.filter((m) => !trimCounts.get(m.id));

  db.close();

  let ok = true;
  console.log(`총 세대 행: ${models.length}개`);

  console.log(`\n[1] start_year > end_year: ${invalidRange.length}건`);
  if (invalidRange.length > 0) {
    ok = false;
    for (const m of invalidRange) console.log(`  - ${label(m)}: ${m.start_year} > ${m.end_year}`);
  }

  console.log(`\n[2] 같은 model_group·powertrain 내 생산기간 겹침: ${overlaps.length}건`);
  if (overlaps.length > 0) {
    ok = false;
    for (const [a, b] of overlaps) {
      console.log(`  - ${label(a)} [${a.start_year}-${a.end_year ?? '현재'}] ↔ ${label(b)} [${b.start_year}-${b.end_year ?? '현재'}]`);
    }
  }

  console.log(`\n[3] end_year가 미래(${TODAY_YEAR} 초과): ${futureEnd.length}건`);
  if (futureEnd.length > 0) {
    ok = false;
    for (const m of futureEnd) console.log(`  - ${label(m)}: end_year=${m.end_year}`);
  }

  console.log(`\n[4] 트림 0개인 세대: ${zeroTrims.length}건`);
  if (zeroTrims.length > 0) {
    ok = false;
    for (const m of zeroTrims) console.log(`  - ${label(m)}`);
  }

  console.log(`\n${ok ? '✅ 전부 통과' : '❌ 실패 항목 있음'}`);
  process.exit(ok ? 0 : 1);
}

main();

// 샘플 매물 시드 스크립트. 카탈로그 시드(db/seed.js)와는 별도로 동작해서, 매물 데이터만
// 지웠다가 다시 채울 수 있다 — 카탈로그(제조사/모델그룹/세대/트림)는 절대 건드리지 않는다.
//
// 재실행해도 안전하도록, 이 스크립트가 만든 고정 이메일의 데모 판매자 계정 소유 매물만
// 지우고 다시 채운다(clearSeedCars). 다른 계정이 그 사이 직접 등록한 매물은 그대로 둔다.
const bcrypt = require('bcryptjs');
const { createDb } = require('./schema');
const { seed: seedCatalog } = require('./seed');

const TODAY_YEAR = 2026;

const DEMO_SELLERS = [
  { email: 'seed-seller-1@carmarket.local', nickname: '이든모터스' },
  { email: 'seed-seller-2@carmarket.local', nickname: '강남중고차' },
  { email: 'seed-seller-3@carmarket.local', nickname: '부산오토프라자' },
];

const SIDO_LIST = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

// 신차가 대략치(원). 데모 데이터 간 상대적인 가격 비교가 목적이라 실제 가격표와는 다르다.
const BASE_PRICE = {
  아반떼: 19000000, 쏘나타: 27000000, 그랜저: 38000000, 싼타페: 36000000, 투싼: 29000000,
  K5: 27000000, 쏘렌토: 38000000, 스포티지: 28000000, 카니발: 40000000, K8: 39000000,
  G80: 65000000, G70: 50000000, GV70: 58000000, GV80: 75000000,
  토레스: 27000000, '렉스턴 스포츠': 30000000, 코란도: 24000000, 티볼리: 20000000,
  SM6: 27000000, QM6: 31000000, XM3: 22000000, SM5: 20000000,
  트레일블레이저: 24000000, 트랙스: 21000000, 말리부: 27000000, 스파크: 13000000, 이쿼녹스: 33000000,
};
const POWERTRAIN_MULTIPLIER = { 일반: 1, 하이브리드: 1.15, 전기: 1.25 };

const DESCRIPTIONS = [
  '무사고 차량입니다. 실내외 상태 양호하며 정기 점검 꾸준히 받았습니다.',
  '단독 소유 차량으로 관리 상태 좋습니다. 직접 보시면 만족하실 거예요.',
  '옵션 풍부하고 주행감 깨끗합니다. 문의 주시면 상세 스펙 안내드립니다.',
  '가족용으로 타던 차량이라 흠집 거의 없습니다. 성능기록부 확인 가능합니다.',
];

function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(array, rand) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randInt(rand, min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function ensureDemoSellers(db) {
  const passwordHash = bcrypt.hashSync('seed-password', 4); // 데모 계정이라 라운드를 낮춰 시드 속도를 높인다
  return DEMO_SELLERS.map(({ email, nickname }) => {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return existing.id;
    const result = db
      .prepare('INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)')
      .run(email, passwordHash, nickname);
    return result.lastInsertRowid;
  });
}

function clearSeedCars(db) {
  const placeholders = DEMO_SELLERS.map(() => '?').join(',');
  const sellerIds = db
    .prepare(`SELECT id FROM users WHERE email IN (${placeholders})`)
    .all(...DEMO_SELLERS.map((s) => s.email))
    .map((row) => row.id);
  if (sellerIds.length === 0) return;

  const sellerPlaceholders = sellerIds.map(() => '?').join(',');
  const carIds = db
    .prepare(`SELECT id FROM cars WHERE seller_id IN (${sellerPlaceholders})`)
    .all(...sellerIds)
    .map((row) => row.id);
  if (carIds.length === 0) return;

  const carPlaceholders = carIds.map(() => '?').join(',');
  db.prepare(
    `DELETE FROM messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE car_id IN (${carPlaceholders}))`
  ).run(...carIds);
  db.prepare(`DELETE FROM chat_rooms WHERE car_id IN (${carPlaceholders})`).run(...carIds);
  db.prepare(`DELETE FROM favorites WHERE car_id IN (${carPlaceholders})`).run(...carIds);
  db.prepare(`DELETE FROM cars WHERE id IN (${carPlaceholders})`).run(...carIds);
}

// model_group 단위로 트림을 묶어 반환한다 — 브랜드/세대가 한쪽에 몰리지 않도록, 매물을 만들 때
// model_group마다 정확히 한 대씩만 뽑는다.
function loadTrimsByModelGroup(db) {
  const rows = db
    .prepare(
      `SELECT trims.id AS trim_id, trims.fuel_type, trims.transmission,
              models.start_year, models.end_year, models.powertrain,
              model_groups.id AS model_group_id, model_groups.name AS model_group_name,
              manufacturers.name AS manufacturer_name
       FROM trims
       JOIN models ON models.id = trims.model_id
       JOIN model_groups ON model_groups.id = models.model_group_id
       JOIN manufacturers ON manufacturers.id = model_groups.manufacturer_id`
    )
    .all();

  const byGroup = new Map();
  for (const row of rows) {
    if (!byGroup.has(row.model_group_id)) byGroup.set(row.model_group_id, []);
    byGroup.get(row.model_group_id).push(row);
  }
  return [...byGroup.values()];
}

function buildCar({ trimRows, rand, sellerIds, region, index }) {
  const trim = trimRows[randInt(rand, 0, trimRows.length - 1)];
  const maxYear = Math.min(trim.end_year ?? TODAY_YEAR, TODAY_YEAR);
  const firstRegisteredYear = randInt(rand, trim.start_year, maxYear);

  // 5대 중 1대는 연말 등록 → 다음 해 연형으로 표기되는 케이스를 섞는다("15/09식(16년형)").
  // 그 외에는 월만 있거나(연형 없음), 월도 연형도 없는 경우를 나눠서 표기 다양성을 만든다.
  let firstRegisteredMonth = null;
  let modelYear = null;
  if (index % 5 === 0) {
    firstRegisteredMonth = randInt(rand, 9, 12);
    modelYear = firstRegisteredYear + 1;
  } else if (index % 3 === 0) {
    firstRegisteredMonth = randInt(rand, 1, 8);
  }

  const age = Math.max(0, TODAY_YEAR - firstRegisteredYear);
  const annualKm = randInt(rand, 10000, 18000);
  const mileage = Math.max(500, age * annualKm + randInt(rand, -3000, 3000));

  // 연식이 오래되고 주행거리가 많을수록 가격이 낮아지도록 두 요인을 각각 반영해 곱한다.
  const basePrice = (BASE_PRICE[trim.model_group_name] || 25000000) * (POWERTRAIN_MULTIPLIER[trim.powertrain] || 1);
  const ageFactor = Math.max(0.3, 1 - age * 0.09);
  const mileageFactor = Math.max(0.7, 1 - (mileage / 200000) * 0.3);
  const noise = 0.95 + rand() * 0.1;
  const price = Math.round((basePrice * ageFactor * mileageFactor * noise) / 100000) * 100000;

  return {
    sellerId: sellerIds[randInt(rand, 0, sellerIds.length - 1)],
    trimId: trim.trim_id,
    brand: trim.manufacturer_name,
    model: trim.model_group_name,
    firstRegisteredYear,
    firstRegisteredMonth,
    modelYear,
    mileage,
    price,
    fuelType: trim.fuel_type,
    transmission: trim.transmission,
    region,
    description: DESCRIPTIONS[randInt(rand, 0, DESCRIPTIONS.length - 1)],
  };
}

function seedCars(db, { seedValue = 42 } = {}) {
  seedCatalog(db); // 매물이 참조할 트림이 있어야 하니, 카탈로그가 비어있다면 먼저 채운다(멱등).
  clearSeedCars(db);
  const sellerIds = ensureDemoSellers(db);

  const rand = mulberry32(seedValue);
  const groups = shuffle(loadTrimsByModelGroup(db), rand);
  const regions = shuffle(SIDO_LIST, rand);

  const insert = db.prepare(
    `INSERT INTO cars (
       seller_id, trim_id, title, brand, model, year,
       first_registered_year, first_registered_month, model_year,
       mileage, price, fuel_type, transmission, region, description, status
     )
     VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '판매중')`
  );

  groups.forEach((trimRows, index) => {
    const car = buildCar({ trimRows, rand, sellerIds, region: regions[index % regions.length], index });
    insert.run(
      car.sellerId,
      car.trimId,
      car.brand,
      car.model,
      car.firstRegisteredYear,
      car.firstRegisteredYear,
      car.firstRegisteredMonth,
      car.modelYear,
      car.mileage,
      car.price,
      car.fuelType,
      car.transmission,
      car.region,
      car.description
    );
  });

  console.log(`샘플 매물 ${groups.length}건 시드 완료 (model_group당 1건, 브랜드/지역 분산)`);
  return groups.length;
}

if (require.main === module) {
  const db = createDb(process.env.DB_PATH);
  seedCars(db);
}

module.exports = { seedCars };

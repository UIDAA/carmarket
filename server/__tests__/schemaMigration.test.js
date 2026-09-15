const { createDb, migrateLegacyCarsToTrims, backfillRegionDetail } = require('../db/schema');
const { seed, reconcileLegacyCars } = require('../db/seed');

describe('카탈로그 스키마', () => {
  it('creates catalog tables and the new nullable columns', () => {
    const db = createDb(':memory:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(['manufacturers', 'model_groups', 'models', 'trims']));

    const carColumns = db.prepare('PRAGMA table_info(cars)').all().map((c) => c.name);
    expect(carColumns).toEqual(
      expect.arrayContaining(['trim_id', 'first_registered_year', 'first_registered_month', 'model_year'])
    );

    const manufacturerColumns = db.prepare('PRAGMA table_info(manufacturers)').all().map((c) => c.name);
    expect(manufacturerColumns).toContain('name_legacy');

    const modelColumns = db.prepare('PRAGMA table_info(models)').all().map((c) => c.name);
    expect(modelColumns).toContain('powertrain');
  });

  it('migrates a legacy free-text car row into a trim and backfills first_registered_year only', () => {
    const db = createDb(':memory:');
    db.prepare('INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)').run(
      'seller@test.com',
      'hash',
      '판매자'
    );
    db.prepare(
      `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, status)
       VALUES (1, '레거시 매물', '현대', '아반떼', 2019, 50000, 12000000, '가솔린', '자동', '서울', '판매중')`
    ).run();

    migrateLegacyCarsToTrims(db);

    const car = db.prepare('SELECT * FROM cars WHERE id = 1').get();
    expect(car.trim_id).not.toBeNull();
    expect(car.first_registered_year).toBe(2019);
    expect(car.first_registered_month).toBeNull();
    expect(car.model_year).toBeNull();

    const trim = db
      .prepare(
        `SELECT trims.*, models.name AS model_name, models.start_year, models.end_year, models.powertrain,
                model_groups.name AS group_name, manufacturers.name AS manufacturer_name
         FROM trims
         JOIN models ON models.id = trims.model_id
         JOIN model_groups ON model_groups.id = models.model_group_id
         JOIN manufacturers ON manufacturers.id = model_groups.manufacturer_id
         WHERE trims.id = ?`
      )
      .get(car.trim_id);

    expect(trim.manufacturer_name).toBe('현대');
    expect(trim.group_name).toBe('아반떼');
    expect(trim.start_year).toBe(2019);
    expect(trim.powertrain).toBe('일반');
    expect(trim.fuel_type).toBe('가솔린');
  });

  it('reuses existing catalog rows instead of duplicating them', () => {
    const db = createDb(':memory:');
    db.prepare('INSERT INTO manufacturers (name) VALUES (?)').run('현대');

    db.prepare('INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)').run(
      'seller@test.com',
      'hash',
      '판매자'
    );
    db.prepare(
      `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, status)
       VALUES (1, '매물1', '현대', '아반떼', 2019, 1, 1, '가솔린', '자동', '서울', '판매중')`
    ).run();
    db.prepare(
      `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, status)
       VALUES (1, '매물2', '현대', '아반떼', 2019, 1, 1, '가솔린', '자동', '서울', '판매중')`
    ).run();

    migrateLegacyCarsToTrims(db);

    const manufacturerCount = db.prepare('SELECT COUNT(*) AS c FROM manufacturers').get().c;
    expect(manufacturerCount).toBe(1);

    const car1 = db.prepare('SELECT trim_id FROM cars WHERE id = 1').get();
    const car2 = db.prepare('SELECT trim_id FROM cars WHERE id = 2').get();
    expect(car1.trim_id).toBe(car2.trim_id);
  });

  it('does not re-run the legacy migration on rows that already have a trim_id', () => {
    const db = createDb(':memory:');
    db.prepare('INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)').run(
      'seller@test.com',
      'hash',
      '판매자'
    );
    db.prepare(
      `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, status)
       VALUES (1, '매물', '현대', '아반떼', 2019, 1, 1, '가솔린', '자동', '서울', '판매중')`
    ).run();
    migrateLegacyCarsToTrims(db);

    const before = db.prepare('SELECT trim_id, first_registered_year FROM cars WHERE id = 1').get();
    db.prepare('UPDATE cars SET first_registered_month = 5 WHERE id = 1').run();
    migrateLegacyCarsToTrims(db);
    const after = db.prepare('SELECT trim_id, first_registered_year, first_registered_month FROM cars WHERE id = 1').get();

    expect(after.trim_id).toBe(before.trim_id);
    expect(after.first_registered_year).toBe(before.first_registered_year);
    expect(after.first_registered_month).toBe(5); // 재실행이 수동으로 채운 값을 덮어쓰지 않음
  });

  it('widens the fallback "기본" model range instead of leaving it stale when a later legacy car falls outside it', () => {
    const db = createDb(':memory:');
    db.prepare('INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)').run(
      'seller@test.com',
      'hash',
      '판매자'
    );
    db.prepare(
      `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, status)
       VALUES (1, '매물1', '현대', '아반떼', 2019, 1, 1, '가솔린', '자동', '서울', '판매중')`
    ).run();
    db.prepare(
      `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, status)
       VALUES (1, '매물2', '현대', '아반떼', 2021, 1, 1, '가솔린', '자동', '서울', '판매중')`
    ).run();

    migrateLegacyCarsToTrims(db);

    const car1 = db.prepare('SELECT trim_id FROM cars WHERE id = 1').get();
    const car2 = db.prepare('SELECT trim_id FROM cars WHERE id = 2').get();
    const model1 = db
      .prepare('SELECT models.* FROM trims JOIN models ON models.id = trims.model_id WHERE trims.id = ?')
      .get(car1.trim_id);
    const model2 = db
      .prepare('SELECT models.* FROM trims JOIN models ON models.id = trims.model_id WHERE trims.id = ?')
      .get(car2.trim_id);

    expect(model1.id).toBe(model2.id);
    expect(model1.start_year).toBe(2019);
    expect(model1.end_year).toBe(2021);
  });
});

describe('post-seed reconciliation of legacy "기본" cars', () => {
  function insertLegacyCar(db, overrides = {}) {
    db.prepare('INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)').run(
      overrides.email || 'seller@test.com',
      'hash',
      '판매자'
    );
    db.prepare(
      `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, status)
       VALUES (1, ?, ?, ?, ?, 1, 1, ?, '자동', '서울', '판매중')`
    ).run(
      overrides.title || '레거시 매물',
      overrides.brand || '현대',
      overrides.model || '아반떼',
      overrides.year || 2021,
      overrides.fuelType || '가솔린'
    );
  }

  it('repoints a car stuck on the "기본" fallback to the real generation once seeded, and drops the empty fallback', () => {
    // createDb()가 항상 migrateLegacyCarsToTrims를 먼저 돌리므로, 시드가 없는 상태에서
    // legacy 차량을 넣으면 실제 CN7 세대가 아니라 폴백 '기본' 모델에 붙는다.
    const db = createDb(':memory:');
    insertLegacyCar(db, { brand: '현대', model: '아반떼', year: 2021, fuelType: '가솔린' });
    // createDb()의 자동 마이그레이션은 이 차량이 들어오기 전에 이미 끝났으므로, 실제 앱 재시작 시
    // 벌어지는 상황(카탈로그가 비어있는 채로 레거시 차량을 마이그레이션)을 재현하려면 직접 한 번 더 돌린다.
    migrateLegacyCarsToTrims(db);

    const beforeModel = db
      .prepare(
        `SELECT models.* FROM cars
         JOIN trims ON trims.id = cars.trim_id
         JOIN models ON models.id = trims.model_id
         WHERE cars.id = 1`
      )
      .get();
    expect(beforeModel.name).toBe('기본');

    // 시드 + 리컨실리에이션을 돌리면 실제 CN7 세대(2020~)로 옮겨져야 한다.
    seed(db);
    reconcileLegacyCars(db);

    const afterCar = db.prepare('SELECT trim_id FROM cars WHERE id = 1').get();
    const afterModel = db
      .prepare('SELECT models.* FROM trims JOIN models ON models.id = trims.model_id WHERE trims.id = ?')
      .get(afterCar.trim_id);
    expect(afterModel.name).toBe('아반떼 (CN7)');

    const fallbackModelCount = db.prepare("SELECT COUNT(*) AS c FROM models WHERE name = '기본'").get().c;
    expect(fallbackModelCount).toBe(0);
  });

  it('reuses an existing manufacturer by name_legacy instead of creating a duplicate', () => {
    const db = createDb(':memory:');
    // 먼저 시드를 돌려 KG모빌리티(name_legacy='쌍용')를 만들어둔다.
    seed(db);

    // 이제 구 사명 '쌍용'으로 된 legacy 차량을 새로 넣고 마이그레이션을 직접 재실행한다.
    db.prepare('INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)').run(
      'seller2@test.com',
      'hash',
      '판매자2'
    );
    db.prepare(
      `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, status)
       VALUES (1, '구형 매물', '쌍용', '토레스', 2022, 1, 1, '가솔린', '자동', '서울', '판매중')`
    ).run();

    migrateLegacyCarsToTrims(db);

    const manufacturers = db.prepare("SELECT * FROM manufacturers WHERE name = '쌍용' OR name_legacy = '쌍용'").all();
    expect(manufacturers).toHaveLength(1);
    expect(manufacturers[0].name).toBe('KG모빌리티');
  });

  it('reconciles a renamed-brand legacy car in the real production order (migrate on empty catalog, then seed)', () => {
    // 실제 앱은 항상 createDb() -> migrateLegacyCarsToTrims(빈 카탈로그) -> (별도로) seed() 순서다.
    // 구 사명으로 된 legacy 차량이 먼저 마이그레이션되면 '쌍용'이라는 stub 제조사가 만들어지고,
    // 그 다음 seed()가 'KG모빌리티'(name_legacy='쌍용')를 찾거나 만들려 한다 — 이 순서에서도
    // 제조사가 중복되지 않고, 리컨실리에이션이 진짜 토레스 세대를 찾아내야 한다.
    const db = createDb(':memory:');
    db.prepare('INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)').run(
      'seller3@test.com',
      'hash',
      '판매자3'
    );
    db.prepare(
      `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, status)
       VALUES (1, '구형 쌍용 매물', '쌍용', '토레스', 2022, 1, 1, '가솔린', '자동', '서울', '판매중')`
    ).run();
    migrateLegacyCarsToTrims(db); // 빈 카탈로그 상태에서 '쌍용' stub 제조사 생성

    seed(db);
    reconcileLegacyCars(db);

    const manufacturers = db.prepare("SELECT * FROM manufacturers WHERE name = '쌍용' OR name_legacy = '쌍용'").all();
    expect(manufacturers).toHaveLength(1);
    expect(manufacturers[0].name).toBe('KG모빌리티');
    expect(manufacturers[0].name_legacy).toBe('쌍용');

    const car = db.prepare('SELECT trim_id FROM cars WHERE id = 1').get();
    const model = db
      .prepare('SELECT models.* FROM trims JOIN models ON models.id = trims.model_id WHERE trims.id = ?')
      .get(car.trim_id);
    expect(model.name).toBe('토레스 (J100)'); // 실제 시드된 토레스 세대로 옮겨졌는지 확인

    const fallbackCount = db.prepare("SELECT COUNT(*) AS c FROM models WHERE name = '기본'").get().c;
    expect(fallbackCount).toBe(0);
  });

  it('running seed + reconcile twice does not error or create duplicates', () => {
    const db = createDb(':memory:');
    insertLegacyCar(db, { brand: '현대', model: '아반떼', year: 2021, fuelType: '가솔린' });
    migrateLegacyCarsToTrims(db);

    seed(db);
    reconcileLegacyCars(db);
    expect(() => {
      seed(db);
      reconcileLegacyCars(db);
    }).not.toThrow();

    const manufacturerCount = db.prepare("SELECT COUNT(*) AS c FROM manufacturers WHERE name = '현대'").get().c;
    expect(manufacturerCount).toBe(1);

    const modelGroupCount = db
      .prepare(
        `SELECT COUNT(*) AS c FROM model_groups
         JOIN manufacturers ON manufacturers.id = model_groups.manufacturer_id
         WHERE manufacturers.name = '현대' AND model_groups.name = '아반떼'`
      )
      .get().c;
    expect(modelGroupCount).toBe(1);

    const car = db.prepare('SELECT trim_id FROM cars WHERE id = 1').get();
    const model = db
      .prepare('SELECT models.name AS name FROM trims JOIN models ON models.id = trims.model_id WHERE trims.id = ?')
      .get(car.trim_id);
    expect(model.name).toBe('아반떼 (CN7)');
  });
});

describe('region_detail 백필', () => {
  it('세부 지역을 region_detail에 보존한 뒤 region을 시도만 남긴다', () => {
    const db = createDb(':memory:');
    db.prepare('INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)').run(
      'seller4@test.com',
      'hash',
      '판매자4'
    );
    // createDb()가 이미 한 번 backfillRegionDetail을 돌린 뒤이므로, 이 매물은 그 시점 이후에
    // 새로 들어온 것처럼 region_detail이 비어있는 상태에서 직접 다시 돌려본다.
    db.prepare(
      `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, status)
       VALUES (1, '', '현대', '아반떼', 2021, 1, 1, '가솔린', '자동', '서울 강남구', '판매중')`
    ).run();

    backfillRegionDetail(db);

    const car = db.prepare('SELECT region, region_detail FROM cars WHERE id = 1').get();
    expect(car.region).toBe('서울');
    expect(car.region_detail).toBe('서울 강남구');
  });

  it('이미 region_detail이 채워진 행은 다시 건드리지 않는다(멱등)', () => {
    const db = createDb(':memory:');
    db.prepare('INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)').run(
      'seller5@test.com',
      'hash',
      '판매자5'
    );
    db.prepare(
      `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, status)
       VALUES (1, '', '현대', '아반떼', 2021, 1, 1, '가솔린', '자동', '서울 강남구', '판매중')`
    ).run();
    backfillRegionDetail(db);

    // region을 수동으로 다시 세분화했다고 가정 — 재실행이 region_detail을 이미 있는 값으로 덮어써서
    // 사용자가 나중에 고친 region까지 잃어버리면 안 된다.
    db.prepare("UPDATE cars SET region = '서울 서초구' WHERE id = 1").run();
    backfillRegionDetail(db);

    const car = db.prepare('SELECT region, region_detail FROM cars WHERE id = 1').get();
    expect(car.region).toBe('서울 서초구'); // 재실행이 다시 자르지 않았다
    expect(car.region_detail).toBe('서울 강남구'); // 원래 보존된 값 그대로
  });
});

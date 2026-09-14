const { createDb, migrateLegacyCarsToTrims } = require('../db/schema');

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
});

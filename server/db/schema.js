const Database = require('better-sqlite3');

function createDb(path = `${__dirname}/carmarket.sqlite`) {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      mileage INTEGER NOT NULL,
      price INTEGER NOT NULL,
      fuel_type TEXT NOT NULL,
      transmission TEXT NOT NULL DEFAULT '자동',
      region TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT '판매중',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      car_id INTEGER NOT NULL REFERENCES cars(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, car_id)
    );

    CREATE TABLE IF NOT EXISTS chat_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      car_id INTEGER NOT NULL REFERENCES cars(id),
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      seller_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(car_id, buyer_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES chat_rooms(id),
      sender_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS manufacturers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      name_legacy TEXT,
      is_domestic INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS model_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manufacturer_id INTEGER NOT NULL REFERENCES manufacturers(id),
      name TEXT NOT NULL,
      UNIQUE(manufacturer_id, name)
    );

    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_group_id INTEGER NOT NULL REFERENCES model_groups(id),
      name TEXT NOT NULL,
      powertrain TEXT NOT NULL DEFAULT '일반',
      start_year INTEGER NOT NULL,
      end_year INTEGER,
      UNIQUE(model_group_id, name)
    );

    CREATE TABLE IF NOT EXISTS trims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER NOT NULL REFERENCES models(id),
      name TEXT NOT NULL,
      fuel_type TEXT NOT NULL,
      transmission TEXT NOT NULL DEFAULT '자동',
      displacement INTEGER,
      base_price INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_model_groups_manufacturer_id ON model_groups(manufacturer_id);
    CREATE INDEX IF NOT EXISTS idx_models_model_group_id ON models(model_group_id);
    CREATE INDEX IF NOT EXISTS idx_trims_model_id ON trims(model_id);
    CREATE INDEX IF NOT EXISTS idx_cars_price ON cars(price);
    CREATE INDEX IF NOT EXISTS idx_cars_mileage ON cars(mileage);
    CREATE INDEX IF NOT EXISTS idx_cars_status_created_at ON cars(status, created_at);
  `);

  const carColumns = db.prepare('PRAGMA table_info(cars)').all().map((col) => col.name);
  if (!carColumns.includes('transmission')) {
    db.exec("ALTER TABLE cars ADD COLUMN transmission TEXT NOT NULL DEFAULT '자동'");
  }
  if (!carColumns.includes('trim_id')) {
    db.exec('ALTER TABLE cars ADD COLUMN trim_id INTEGER REFERENCES trims(id)');
  }
  if (!carColumns.includes('first_registered_year')) {
    db.exec('ALTER TABLE cars ADD COLUMN first_registered_year INTEGER');
  }
  if (!carColumns.includes('first_registered_month')) {
    db.exec('ALTER TABLE cars ADD COLUMN first_registered_month INTEGER');
  }
  if (!carColumns.includes('model_year')) {
    db.exec('ALTER TABLE cars ADD COLUMN model_year INTEGER');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_cars_trim_id ON cars(trim_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_cars_first_registered_year ON cars(first_registered_year)');

  const manufacturerColumns = db.prepare('PRAGMA table_info(manufacturers)').all().map((col) => col.name);
  if (!manufacturerColumns.includes('name_legacy')) {
    db.exec('ALTER TABLE manufacturers ADD COLUMN name_legacy TEXT');
  }

  const modelColumns = db.prepare('PRAGMA table_info(models)').all().map((col) => col.name);
  if (!modelColumns.includes('powertrain')) {
    db.exec("ALTER TABLE models ADD COLUMN powertrain TEXT NOT NULL DEFAULT '일반'");
  }

  migrateLegacyCarsToTrims(db);

  return db;
}

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

function migrateLegacyCarsToTrims(db) {
  const legacyCars = db.prepare('SELECT * FROM cars WHERE trim_id IS NULL').all();

  for (const car of legacyCars) {
    const manufacturer = findOrCreate(db, 'manufacturers', { name: car.brand }, { name: car.brand });
    const modelGroup = findOrCreate(
      db,
      'model_groups',
      { manufacturer_id: manufacturer.id, name: car.model },
      { manufacturer_id: manufacturer.id, name: car.model }
    );

    let model = db
      .prepare(
        `SELECT * FROM models
         WHERE model_group_id = ? AND start_year <= ? AND (end_year IS NULL OR end_year >= ?)`
      )
      .get(modelGroup.id, car.year, car.year);
    if (!model) {
      // 범위에 안 맞으면 폴백 '기본' 모델을 쓴다. 이름만으로 찾아 범위를 넓혀야 한다 —
      // findOrCreate로 바로 만들면 두 번째 이후 차량의 연식이 기존 '기본' 범위를 벗어나도
      // 조용히 같은 row에 재사용되어 start_year/end_year가 실제보다 좁게 굳어버린다.
      const existing = db
        .prepare(`SELECT * FROM models WHERE model_group_id = ? AND name = ?`)
        .get(modelGroup.id, '기본');
      if (!existing) {
        model = findOrCreate(
          db,
          'models',
          { model_group_id: modelGroup.id, name: '기본' },
          { model_group_id: modelGroup.id, name: '기본', powertrain: '일반', start_year: car.year, end_year: car.year }
        );
      } else {
        const newStart = Math.min(existing.start_year, car.year);
        const newEnd = existing.end_year === null ? null : Math.max(existing.end_year, car.year);
        if (newStart !== existing.start_year || newEnd !== existing.end_year) {
          db.prepare('UPDATE models SET start_year = ?, end_year = ? WHERE id = ?').run(newStart, newEnd, existing.id);
        }
        model = db.prepare('SELECT * FROM models WHERE id = ?').get(existing.id);
      }
    }

    const trim = findOrCreate(
      db,
      'trims',
      { model_id: model.id, fuel_type: car.fuel_type, transmission: car.transmission },
      {
        model_id: model.id,
        name: `${car.fuel_type} 기본형`,
        fuel_type: car.fuel_type,
        transmission: car.transmission,
      }
    );

    db.prepare('UPDATE cars SET trim_id = ? WHERE id = ?').run(trim.id, car.id);
  }

  db.prepare('UPDATE cars SET first_registered_year = year WHERE first_registered_year IS NULL').run();
}

module.exports = { createDb, migrateLegacyCarsToTrims };

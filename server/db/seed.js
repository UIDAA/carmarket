const { createDb } = require('./schema');

const CATALOG = [
  {
    manufacturer: '현대',
    modelGroups: [
      {
        name: '아반떼',
        models: [
          {
            name: 'CN7',
            powertrain: '일반',
            startYear: 2020,
            endYear: null,
            trims: [
              { name: '가솔린 1.6 스마트', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 1.6 인스퍼레이션', fuelType: '가솔린', transmission: '자동' },
            ],
          },
          {
            name: 'AD',
            powertrain: '일반',
            startYear: 2015,
            endYear: 2020,
            trims: [{ name: '가솔린 1.6 스타일', fuelType: '가솔린', transmission: '자동' }],
          },
        ],
      },
      {
        name: '그랜저',
        models: [
          {
            name: '그랜저 (GN7)',
            powertrain: '일반',
            startYear: 2022,
            endYear: null,
            trims: [{ name: '가솔린 3.5 캘리그래피', fuelType: '가솔린', transmission: '자동' }],
          },
          {
            name: '그랜저 하이브리드 (GN7)',
            powertrain: '하이브리드',
            startYear: 2022,
            endYear: null,
            trims: [{ name: '하이브리드 1.6 캘리그래피', fuelType: '하이브리드', transmission: '자동' }],
          },
          {
            name: '그랜저 IG',
            powertrain: '일반',
            startYear: 2016,
            endYear: 2022,
            trims: [{ name: '가솔린 3.0 익스클루시브', fuelType: '가솔린', transmission: '자동' }],
          },
        ],
      },
      {
        name: '쏘나타',
        models: [
          {
            name: 'DN8',
            powertrain: '일반',
            startYear: 2019,
            endYear: null,
            trims: [{ name: '가솔린 2.0 스마트', fuelType: '가솔린', transmission: '자동' }],
          },
          {
            name: 'DN8 하이브리드',
            powertrain: '하이브리드',
            startYear: 2019,
            endYear: null,
            trims: [{ name: '하이브리드 스마트', fuelType: '하이브리드', transmission: '자동' }],
          },
        ],
      },
    ],
  },
  {
    manufacturer: '기아',
    modelGroups: [
      {
        name: 'K5',
        models: [
          {
            name: 'DL3',
            powertrain: '일반',
            startYear: 2019,
            endYear: null,
            trims: [
              { name: '가솔린 2.0 노블레스', fuelType: '가솔린', transmission: '자동' },
              { name: '가솔린 1.6 터보 노블레스', fuelType: '가솔린', transmission: '자동' },
            ],
          },
        ],
      },
      {
        name: '스포티지',
        models: [
          {
            name: 'NQ5',
            powertrain: '일반',
            startYear: 2021,
            endYear: null,
            trims: [{ name: '디젤 1.6 시그니처', fuelType: '디젤', transmission: '자동' }],
          },
        ],
      },
    ],
  },
  {
    manufacturer: '제네시스',
    modelGroups: [
      {
        name: 'G80',
        models: [
          {
            name: 'RG3',
            powertrain: '일반',
            startYear: 2020,
            endYear: null,
            trims: [{ name: '가솔린 3.5 터보', fuelType: '가솔린', transmission: '자동' }],
          },
        ],
      },
    ],
  },
  {
    manufacturer: 'KG모빌리티',
    nameLegacy: '쌍용',
    modelGroups: [
      {
        name: '토레스',
        models: [
          {
            name: '1세대',
            powertrain: '일반',
            startYear: 2022,
            endYear: null,
            trims: [{ name: '가솔린 1.5 터보 T7', fuelType: '가솔린', transmission: '자동' }],
          },
        ],
      },
    ],
  },
  {
    manufacturer: '르노코리아',
    modelGroups: [
      {
        name: 'SM6',
        models: [
          {
            name: '1세대',
            powertrain: '일반',
            startYear: 2016,
            endYear: 2023,
            trims: [{ name: '가솔린 2.0 SE', fuelType: '가솔린', transmission: '자동' }],
          },
        ],
      },
    ],
  },
];

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

function seed(db) {
  CATALOG.forEach((manufacturerSeed, index) => {
    const manufacturer = findOrCreate(
      db,
      'manufacturers',
      { name: manufacturerSeed.manufacturer },
      {
        name: manufacturerSeed.manufacturer,
        name_legacy: manufacturerSeed.nameLegacy || null,
        is_domestic: 1,
        sort_order: index,
      }
    );

    manufacturerSeed.modelGroups.forEach((groupSeed) => {
      const modelGroup = findOrCreate(
        db,
        'model_groups',
        { manufacturer_id: manufacturer.id, name: groupSeed.name },
        { manufacturer_id: manufacturer.id, name: groupSeed.name }
      );

      groupSeed.models.forEach((modelSeed) => {
        const model = findOrCreate(
          db,
          'models',
          { model_group_id: modelGroup.id, name: modelSeed.name },
          {
            model_group_id: modelGroup.id,
            name: modelSeed.name,
            powertrain: modelSeed.powertrain,
            start_year: modelSeed.startYear,
            end_year: modelSeed.endYear,
          }
        );

        modelSeed.trims.forEach((trimSeed) => {
          findOrCreate(
            db,
            'trims',
            { model_id: model.id, name: trimSeed.name },
            {
              model_id: model.id,
              name: trimSeed.name,
              fuel_type: trimSeed.fuelType,
              transmission: trimSeed.transmission,
            }
          );
        });
      });
    });
  });
}

if (require.main === module) {
  const db = createDb();
  seed(db);
  console.log('카탈로그 시드 데이터 적용 완료');
}

module.exports = { seed, CATALOG };

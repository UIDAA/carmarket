const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const ACTIVE_STATUSES = "('판매중', '예약중')";

const FROM_CLAUSE = `
  FROM cars
  JOIN trims ON trims.id = cars.trim_id
  JOIN models ON models.id = trims.model_id
  JOIN model_groups ON model_groups.id = models.model_group_id
  JOIN manufacturers ON manufacturers.id = model_groups.manufacturer_id
`;

const PRICE_BUCKETS = [
  { label: '~1000만원', min: 0, max: 10000000 },
  { label: '1000~2000만원', min: 10000000, max: 20000000 },
  { label: '2000~3000만원', min: 20000000, max: 30000000 },
  { label: '3000~5000만원', min: 30000000, max: 50000000 },
  { label: '5000만원~', min: 50000000, max: null },
];

const MILEAGE_BUCKETS = [
  { label: '2만km 미만', min: 0, max: 20000 },
  { label: '2만~4만km', min: 20000, max: 40000 },
  { label: '4만~6만km', min: 40000, max: 60000 },
  { label: '6만~8만km', min: 60000, max: 80000 },
  { label: '8만~10만km', min: 80000, max: 100000 },
  { label: '10만km 이상', min: 100000, max: null },
];

function buildSearchConditions(filters, excludeKeys = []) {
  const exclude = new Set(excludeKeys);
  const conditions = [`cars.status IN ${ACTIVE_STATUSES}`];
  const params = [];

  if (filters.manufacturerId && !exclude.has('manufacturerId')) {
    conditions.push('model_groups.manufacturer_id = ?');
    params.push(Number(filters.manufacturerId));
  }
  if (filters.modelGroupId && !exclude.has('modelGroupId')) {
    conditions.push('models.model_group_id = ?');
    params.push(Number(filters.modelGroupId));
  }
  if (filters.modelId && !exclude.has('modelId')) {
    conditions.push('trims.model_id = ?');
    params.push(Number(filters.modelId));
  }
  if (filters.trimId && !exclude.has('trimId')) {
    conditions.push('cars.trim_id = ?');
    params.push(Number(filters.trimId));
  }
  if (filters.yearFrom && !exclude.has('year')) {
    conditions.push('cars.first_registered_year >= ?');
    params.push(Number(filters.yearFrom));
  }
  if (filters.yearTo && !exclude.has('year')) {
    conditions.push('cars.first_registered_year <= ?');
    params.push(Number(filters.yearTo));
  }
  if (filters.fuel && !exclude.has('fuel')) {
    conditions.push('cars.fuel_type = ?');
    params.push(filters.fuel);
  }
  if (filters.priceMin && !exclude.has('price')) {
    conditions.push('cars.price >= ?');
    params.push(Number(filters.priceMin));
  }
  if (filters.priceMax && !exclude.has('price')) {
    conditions.push('cars.price <= ?');
    params.push(Number(filters.priceMax));
  }
  if (filters.mileageMin && !exclude.has('mileage')) {
    conditions.push('cars.mileage >= ?');
    params.push(Number(filters.mileageMin));
  }
  if (filters.mileageMax && !exclude.has('mileage')) {
    conditions.push('cars.mileage <= ?');
    params.push(Number(filters.mileageMax));
  }
  if (filters.region && !exclude.has('region')) {
    conditions.push('cars.region = ?');
    params.push(filters.region);
  }

  return { conditions, params };
}

function countBucket(db, baseConditions, baseParams, column, bucket) {
  const conditions = [...baseConditions, `cars.${column} >= ?`];
  const params = [...baseParams, bucket.min];
  if (bucket.max !== null) {
    conditions.push(`cars.${column} < ?`);
    params.push(bucket.max);
  }
  return db.prepare(`SELECT COUNT(*) AS c ${FROM_CLAUSE} WHERE ${conditions.join(' AND ')}`).get(...params).c;
}

function buildFacets(db, filters) {
  const withoutCatalog = buildSearchConditions(filters, ['manufacturerId', 'modelGroupId', 'modelId', 'trimId']);
  const manufacturers = db
    .prepare(
      `SELECT manufacturers.id, manufacturers.name, manufacturers.name_legacy AS nameLegacy, COUNT(cars.id) AS count
       FROM manufacturers
       LEFT JOIN model_groups ON model_groups.manufacturer_id = manufacturers.id
       LEFT JOIN models ON models.model_group_id = model_groups.id
       LEFT JOIN trims ON trims.model_id = models.id
       LEFT JOIN cars ON cars.trim_id = trims.id AND ${withoutCatalog.conditions.join(' AND ')}
       GROUP BY manufacturers.id
       ORDER BY manufacturers.sort_order, manufacturers.id`
    )
    .all(...withoutCatalog.params);

  let modelGroups = null;
  if (filters.manufacturerId) {
    const cond = buildSearchConditions(filters, ['modelGroupId', 'modelId', 'trimId']);
    modelGroups = db
      .prepare(
        `SELECT model_groups.id, model_groups.name, COUNT(cars.id) AS count
         FROM model_groups
         LEFT JOIN models ON models.model_group_id = model_groups.id
         LEFT JOIN trims ON trims.model_id = models.id
         LEFT JOIN cars ON cars.trim_id = trims.id AND ${cond.conditions.join(' AND ')}
         WHERE model_groups.manufacturer_id = ?
         GROUP BY model_groups.id
         ORDER BY model_groups.name`
      )
      .all(...cond.params, Number(filters.manufacturerId));
  }

  let models = null;
  if (filters.modelGroupId) {
    const cond = buildSearchConditions(filters, ['modelId', 'trimId']);
    models = db
      .prepare(
        `SELECT models.id, models.name, models.powertrain, models.start_year AS startYear, models.end_year AS endYear,
                COUNT(cars.id) AS count
         FROM models
         LEFT JOIN model_groups ON model_groups.id = models.model_group_id
         LEFT JOIN trims ON trims.model_id = models.id
         LEFT JOIN cars ON cars.trim_id = trims.id AND ${cond.conditions.join(' AND ')}
         WHERE models.model_group_id = ?
         GROUP BY models.id
         ORDER BY models.start_year DESC`
      )
      .all(...cond.params, Number(filters.modelGroupId));
  }

  let trims = null;
  if (filters.modelId) {
    const cond = buildSearchConditions(filters, ['trimId']);
    trims = db
      .prepare(
        `SELECT trims.id, trims.name, trims.fuel_type AS fuelType, trims.transmission, COUNT(cars.id) AS count
         FROM trims
         LEFT JOIN models ON models.id = trims.model_id
         LEFT JOIN model_groups ON model_groups.id = models.model_group_id
         LEFT JOIN cars ON cars.trim_id = trims.id AND ${cond.conditions.join(' AND ')}
         WHERE trims.model_id = ?
         GROUP BY trims.id
         ORDER BY trims.id`
      )
      .all(...cond.params, Number(filters.modelId));
  }

  const withoutFuel = buildSearchConditions(filters, ['fuel']);
  const fuel = db
    .prepare(
      `SELECT distinct_fuel.fuel_type AS value, COUNT(cars.id) AS count
       FROM (SELECT DISTINCT fuel_type FROM trims) AS distinct_fuel
       LEFT JOIN trims ON trims.fuel_type = distinct_fuel.fuel_type
       LEFT JOIN models ON models.id = trims.model_id
       LEFT JOIN model_groups ON model_groups.id = models.model_group_id
       LEFT JOIN cars ON cars.trim_id = trims.id AND ${withoutFuel.conditions.join(' AND ')}
       GROUP BY distinct_fuel.fuel_type`
    )
    .all(...withoutFuel.params);

  const withoutRegion = buildSearchConditions(filters, ['region']);
  const region = db
    .prepare(
      `SELECT distinct_region.region AS value, COUNT(matched.id) AS count
       FROM (SELECT DISTINCT region FROM cars WHERE region IS NOT NULL) AS distinct_region
       LEFT JOIN (
         SELECT cars.id AS id, cars.region AS region
         FROM cars
         JOIN trims ON trims.id = cars.trim_id
         JOIN models ON models.id = trims.model_id
         JOIN model_groups ON model_groups.id = models.model_group_id
         WHERE ${withoutRegion.conditions.join(' AND ')}
       ) AS matched ON matched.region = distinct_region.region
       GROUP BY distinct_region.region`
    )
    .all(...withoutRegion.params);

  const withoutPrice = buildSearchConditions(filters, ['price']);
  const priceBuckets = PRICE_BUCKETS.map((bucket) => ({
    ...bucket,
    count: countBucket(db, withoutPrice.conditions, withoutPrice.params, 'price', bucket),
  }));

  const withoutMileage = buildSearchConditions(filters, ['mileage']);
  const mileageBuckets = MILEAGE_BUCKETS.map((bucket) => ({
    ...bucket,
    count: countBucket(db, withoutMileage.conditions, withoutMileage.params, 'mileage', bucket),
  }));

  return { manufacturers, modelGroups, models, trims, fuel, region, priceBuckets, mileageBuckets };
}

function getTrimWithLineage(db, trimId) {
  return db
    .prepare(
      `SELECT trims.id, trims.fuel_type, trims.transmission,
              models.id AS model_id, models.start_year, models.end_year,
              model_groups.name AS model_group_name,
              manufacturers.name AS manufacturer_name
       FROM trims
       JOIN models ON models.id = trims.model_id
       JOIN model_groups ON model_groups.id = models.model_group_id
       JOIN manufacturers ON manufacturers.id = model_groups.manufacturer_id
       WHERE trims.id = ?`
    )
    .get(trimId);
}

function carsRouter(db) {
  const router = express.Router();

  router.get('/mine', requireAuth, (req, res) => {
    const cars = db.prepare('SELECT * FROM cars WHERE seller_id = ? ORDER BY created_at DESC').all(req.userId);
    res.json(cars);
  });

  router.get('/search', (req, res) => {
    const filters = req.query;
    const { conditions, params } = buildSearchConditions(filters);
    const where = `WHERE ${conditions.join(' AND ')}`;

    const sortMap = {
      latest: 'cars.created_at DESC',
      price_asc: 'cars.price ASC',
      mileage_asc: 'cars.mileage ASC',
      year_desc: 'cars.first_registered_year DESC',
    };
    const orderBy = sortMap[filters.sort] || sortMap.latest;

    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const total = db.prepare(`SELECT COUNT(*) AS c ${FROM_CLAUSE} ${where}`).get(...params).c;
    const items = db
      .prepare(`SELECT cars.* ${FROM_CLAUSE} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset);
    const facets = buildFacets(db, filters);

    res.json({ items, total, page, pageSize, facets });
  });

  router.get('/', (req, res) => {
    const { brand, minPrice, maxPrice, region, fuelType, keyword } = req.query;

    const conditions = [];
    const params = [];

    if (brand) {
      conditions.push('brand = ?');
      params.push(brand);
    }
    if (minPrice) {
      conditions.push('price >= ?');
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      conditions.push('price <= ?');
      params.push(Number(maxPrice));
    }
    if (region) {
      conditions.push('region = ?');
      params.push(region);
    }
    if (fuelType) {
      conditions.push('fuel_type = ?');
      params.push(fuelType);
    }
    if (keyword) {
      conditions.push('(title LIKE ? OR model LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const cars = db.prepare(`SELECT * FROM cars ${where} ORDER BY created_at DESC`).all(...params);

    res.json(cars);
  });

  router.get('/:id', (req, res) => {
    const car = db
      .prepare(
        `SELECT cars.*, users.nickname AS seller_nickname
         FROM cars JOIN users ON users.id = cars.seller_id
         WHERE cars.id = ?`
      )
      .get(req.params.id);
    if (!car) return res.status(404).json({ error: '매물을 찾을 수 없습니다.' });
    res.json(car);
  });

  router.post('/', requireAuth, upload.single('photo'), (req, res) => {
    const { title, region, description } = req.body;
    const trimId = Number(req.body.trimId);
    const firstRegisteredYear = Number(req.body.firstRegisteredYear);
    const firstRegisteredMonth = req.body.firstRegisteredMonth ? Number(req.body.firstRegisteredMonth) : null;
    const modelYear = req.body.modelYear ? Number(req.body.modelYear) : null;
    const mileage = Number(req.body.mileage);
    const price = Number(req.body.price);

    if (!title || !trimId || !firstRegisteredYear || !mileage || !price || !region) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }

    const trim = getTrimWithLineage(db, trimId);
    if (!trim) return res.status(400).json({ error: '존재하지 않는 트림입니다.' });

    const maxYear = trim.end_year ?? new Date().getFullYear();
    if (firstRegisteredYear < trim.start_year || firstRegisteredYear > maxYear) {
      return res.status(400).json({ error: `최초등록연도는 ${trim.start_year}년부터 ${maxYear}년 사이여야 합니다.` });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const result = db
      .prepare(
        `INSERT INTO cars (
           seller_id, trim_id, title, brand, model, year,
           first_registered_year, first_registered_month, model_year,
           mileage, price, fuel_type, transmission, region, description, image_url, status
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '판매중')`
      )
      .run(
        req.userId,
        trimId,
        title,
        trim.manufacturer_name,
        trim.model_group_name,
        firstRegisteredYear, // 레거시 year 컬럼도 채워둔다(NOT NULL이라 필요, 신규 코드는 읽지 않음)
        firstRegisteredYear,
        firstRegisteredMonth,
        modelYear,
        mileage,
        price,
        trim.fuel_type,
        trim.transmission,
        region,
        description || null,
        imageUrl
      );

    const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(car);
  });

  router.put('/:id', requireAuth, upload.single('photo'), (req, res) => {
    const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
    if (!car) return res.status(404).json({ error: '매물을 찾을 수 없습니다.' });
    if (car.seller_id !== req.userId) return res.status(403).json({ error: '본인 매물만 수정할 수 있습니다.' });

    const { title, region, description, status } = req.body;
    const trimId = req.body.trimId !== undefined ? Number(req.body.trimId) : car.trim_id;
    const firstRegisteredYear =
      req.body.firstRegisteredYear !== undefined ? Number(req.body.firstRegisteredYear) : car.first_registered_year;
    const firstRegisteredMonth =
      req.body.firstRegisteredMonth !== undefined ? Number(req.body.firstRegisteredMonth) : car.first_registered_month;
    const modelYear = req.body.modelYear !== undefined ? Number(req.body.modelYear) : car.model_year;
    const mileage = req.body.mileage !== undefined ? Number(req.body.mileage) : undefined;
    const price = req.body.price !== undefined ? Number(req.body.price) : undefined;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : car.image_url;

    const trim = getTrimWithLineage(db, trimId);
    if (!trim) return res.status(400).json({ error: '존재하지 않는 트림입니다.' });

    const maxYear = trim.end_year ?? new Date().getFullYear();
    if (firstRegisteredYear < trim.start_year || firstRegisteredYear > maxYear) {
      return res.status(400).json({ error: `최초등록연도는 ${trim.start_year}년부터 ${maxYear}년 사이여야 합니다.` });
    }

    db.prepare(
      `UPDATE cars SET title = ?, trim_id = ?, brand = ?, model = ?,
       first_registered_year = ?, first_registered_month = ?, model_year = ?,
       mileage = ?, price = ?, fuel_type = ?, transmission = ?, region = ?, description = ?, image_url = ?, status = ?
       WHERE id = ?`
    ).run(
      title ?? car.title,
      trimId,
      trim.manufacturer_name,
      trim.model_group_name,
      firstRegisteredYear,
      firstRegisteredMonth,
      modelYear,
      mileage ?? car.mileage,
      price ?? car.price,
      trim.fuel_type,
      trim.transmission,
      region ?? car.region,
      description ?? car.description,
      imageUrl,
      status ?? car.status,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
    res.json(updated);
  });

  router.delete('/:id', requireAuth, (req, res) => {
    const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
    if (!car) return res.status(404).json({ error: '매물을 찾을 수 없습니다.' });
    if (car.seller_id !== req.userId) return res.status(403).json({ error: '본인 매물만 삭제할 수 있습니다.' });

    db.prepare('DELETE FROM cars WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
}

module.exports = { carsRouter };

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

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

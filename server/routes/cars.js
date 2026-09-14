const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

function carsRouter(db) {
  const router = express.Router();

  router.get('/mine', requireAuth, (req, res) => {
    const cars = db.prepare('SELECT * FROM cars WHERE seller_id = ? ORDER BY created_at DESC').all(req.userId);
    res.json(cars);
  });

  router.get('/', (req, res) => {
    const { brand, minPrice, maxPrice, minYear, maxYear, region, fuelType, keyword } = req.query;

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
    if (minYear) {
      conditions.push('year >= ?');
      params.push(Number(minYear));
    }
    if (maxYear) {
      conditions.push('year <= ?');
      params.push(Number(maxYear));
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
    const { title, brand, model, fuelType, transmission, region, description } = req.body;
    const year = Number(req.body.year);
    const mileage = Number(req.body.mileage);
    const price = Number(req.body.price);

    if (!title || !brand || !model || !year || !mileage || !price || !fuelType || !region) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const result = db
      .prepare(
        `INSERT INTO cars (seller_id, title, brand, model, year, mileage, price, fuel_type, transmission, region, description, image_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '판매중')`
      )
      .run(
        req.userId,
        title,
        brand,
        model,
        year,
        mileage,
        price,
        fuelType,
        transmission || '자동',
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

    const { title, brand, model, fuelType, transmission, region, description, status } = req.body;
    const year = req.body.year !== undefined ? Number(req.body.year) : undefined;
    const mileage = req.body.mileage !== undefined ? Number(req.body.mileage) : undefined;
    const price = req.body.price !== undefined ? Number(req.body.price) : undefined;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : car.image_url;

    db.prepare(
      `UPDATE cars SET title = ?, brand = ?, model = ?, year = ?, mileage = ?, price = ?,
       fuel_type = ?, transmission = ?, region = ?, description = ?, image_url = ?, status = ? WHERE id = ?`
    ).run(
      title ?? car.title,
      brand ?? car.brand,
      model ?? car.model,
      year ?? car.year,
      mileage ?? car.mileage,
      price ?? car.price,
      fuelType ?? car.fuel_type,
      transmission ?? car.transmission,
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

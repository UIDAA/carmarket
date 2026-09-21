const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { withDisplayTitle } = require('../utils/displayTitle');

function favoritesRouter(db) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const favorites = db
      .prepare(
        `SELECT cars.*, trims.name AS trim_name FROM favorites
         JOIN cars ON cars.id = favorites.car_id
         JOIN trims ON trims.id = cars.trim_id
         WHERE favorites.user_id = ?
         ORDER BY favorites.created_at DESC`
      )
      .all(req.userId);
    res.json(favorites.map(withDisplayTitle));
  });

  router.post('/:carId', (req, res) => {
    const car = db.prepare('SELECT id FROM cars WHERE id = ?').get(req.params.carId);
    if (!car) return res.status(404).json({ error: '매물을 찾을 수 없습니다.' });

    const existing = db
      .prepare('SELECT id FROM favorites WHERE user_id = ? AND car_id = ?')
      .get(req.userId, req.params.carId);
    if (existing) return res.status(200).json({ favorited: true });

    db.prepare('INSERT INTO favorites (user_id, car_id) VALUES (?, ?)').run(req.userId, req.params.carId);
    res.status(201).json({ favorited: true });
  });

  router.delete('/:carId', (req, res) => {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND car_id = ?').run(req.userId, req.params.carId);
    res.status(200).json({ favorited: false });
  });

  return router;
}

module.exports = { favoritesRouter };

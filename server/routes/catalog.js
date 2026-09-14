const express = require('express');

const ACTIVE_STATUSES = "('판매중', '예약중')";

function catalogRouter(db) {
  const router = express.Router();

  router.get('/manufacturers', (req, res) => {
    const rows = db
      .prepare(
        `SELECT manufacturers.id, manufacturers.name, manufacturers.name_legacy AS nameLegacy,
                manufacturers.is_domestic AS isDomestic, COUNT(cars.id) AS count
         FROM manufacturers
         LEFT JOIN model_groups ON model_groups.manufacturer_id = manufacturers.id
         LEFT JOIN models ON models.model_group_id = model_groups.id
         LEFT JOIN trims ON trims.model_id = models.id
         LEFT JOIN cars ON cars.trim_id = trims.id AND cars.status IN ${ACTIVE_STATUSES}
         GROUP BY manufacturers.id
         ORDER BY manufacturers.sort_order, manufacturers.id`
      )
      .all();
    res.json(rows);
  });

  router.get('/manufacturers/:id/model-groups', (req, res) => {
    const rows = db
      .prepare(
        `SELECT model_groups.id, model_groups.name, COUNT(cars.id) AS count
         FROM model_groups
         LEFT JOIN models ON models.model_group_id = model_groups.id
         LEFT JOIN trims ON trims.model_id = models.id
         LEFT JOIN cars ON cars.trim_id = trims.id AND cars.status IN ${ACTIVE_STATUSES}
         WHERE model_groups.manufacturer_id = ?
         GROUP BY model_groups.id
         ORDER BY model_groups.name`
      )
      .all(req.params.id);
    res.json(rows);
  });

  router.get('/model-groups/:id/models', (req, res) => {
    const rows = db
      .prepare(
        `SELECT models.id, models.name, models.powertrain, models.start_year AS startYear, models.end_year AS endYear,
                COUNT(cars.id) AS count
         FROM models
         LEFT JOIN trims ON trims.model_id = models.id
         LEFT JOIN cars ON cars.trim_id = trims.id AND cars.status IN ${ACTIVE_STATUSES}
         WHERE models.model_group_id = ?
         GROUP BY models.id
         ORDER BY models.start_year DESC`
      )
      .all(req.params.id);
    res.json(rows);
  });

  router.get('/models/:id/years', (req, res) => {
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(req.params.id);
    if (!model) return res.status(404).json({ error: '모델을 찾을 수 없습니다.' });

    const endYear = model.end_year ?? new Date().getFullYear();
    const counts = db
      .prepare(
        `SELECT cars.first_registered_year AS year, COUNT(cars.id) AS count
         FROM cars
         JOIN trims ON trims.id = cars.trim_id
         WHERE trims.model_id = ? AND cars.status IN ${ACTIVE_STATUSES}
         GROUP BY cars.first_registered_year`
      )
      .all(req.params.id);
    const countByYear = new Map(counts.map((row) => [row.year, row.count]));

    const years = [];
    for (let year = model.start_year; year <= endYear; year++) {
      years.push({ year, count: countByYear.get(year) || 0 });
    }
    res.json(years.reverse());
  });

  router.get('/models/:id/trims', (req, res) => {
    const { year } = req.query;
    const params = [];
    let yearCondition = '';
    if (year) {
      yearCondition = 'AND cars.first_registered_year = ?';
      params.push(Number(year));
    }
    params.push(req.params.id);

    const rows = db
      .prepare(
        `SELECT trims.id, trims.name, trims.fuel_type AS fuelType, trims.transmission,
                COUNT(cars.id) AS count
         FROM trims
         LEFT JOIN cars ON cars.trim_id = trims.id AND cars.status IN ${ACTIVE_STATUSES} ${yearCondition}
         WHERE trims.model_id = ?
         GROUP BY trims.id
         ORDER BY trims.id`
      )
      .all(...params);
    res.json(rows);
  });

  return router;
}

module.exports = { catalogRouter };

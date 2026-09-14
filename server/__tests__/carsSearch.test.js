const request = require('supertest');
const { buildTestApp, registerAndLogin } = require('./helpers/testApp');
const { seedTrim } = require('./helpers/catalogFixtures');

async function postCar(app, token, trimId, overrides = {}) {
  const req = request(app).post('/api/cars').set('Authorization', `Bearer ${token}`);
  req.field('title', overrides.title || '매물');
  req.field('trimId', String(trimId));
  req.field('firstRegisteredYear', String(overrides.firstRegisteredYear ?? 2021));
  req.field('mileage', String(overrides.mileage ?? 10000));
  req.field('price', String(overrides.price ?? 10000000));
  req.field('region', overrides.region || '서울');
  return req;
}

describe('GET /api/cars/search', () => {
  it('paginates all cars when no conditions are given, and includes a facets object', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app);
    await postCar(app, token, trimId);

    const res = await request(app).get('/api/cars/search');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.facets).toBeDefined();
  });

  it('filters by manufacturerId/modelGroupId/modelId/trimId', async () => {
    const { app, db } = buildTestApp();
    const hyundai = seedTrim(db);
    const kia = seedTrim(db, { manufacturerName: '기아', modelGroupName: 'K5', modelName: 'DL3', startYear: 2020 });
    const token = await registerAndLogin(app);
    await postCar(app, token, hyundai.trimId);
    await postCar(app, token, kia.trimId, { firstRegisteredYear: 2021 });

    const byManufacturer = await request(app).get('/api/cars/search').query({ manufacturerId: kia.manufacturerId });
    expect(byManufacturer.body.total).toBe(1);
    expect(byManufacturer.body.items[0].brand).toBe('기아');

    const byTrim = await request(app).get('/api/cars/search').query({ trimId: hyundai.trimId });
    expect(byTrim.body.total).toBe(1);
    expect(byTrim.body.items[0].brand).toBe('현대');
  });

  it('filters by first_registered_year range, price range and mileage range', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db, { startYear: 2018, endYear: 2023 });
    const token = await registerAndLogin(app);
    await postCar(app, token, trimId, { firstRegisteredYear: 2019, price: 5000000, mileage: 90000 });
    await postCar(app, token, trimId, { firstRegisteredYear: 2022, price: 20000000, mileage: 5000 });

    const res = await request(app)
      .get('/api/cars/search')
      .query({ yearFrom: 2021, priceMax: 25000000, mileageMax: 10000 });
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].first_registered_year).toBe(2022);
  });

  it('sorts by price_asc', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app);
    await postCar(app, token, trimId, { price: 20000000 });
    await postCar(app, token, trimId, { price: 5000000 });

    const res = await request(app).get('/api/cars/search').query({ sort: 'price_asc' });
    expect(res.body.items.map((c) => c.price)).toEqual([5000000, 20000000]);
  });

  it('paginates results', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app);
    for (let i = 0; i < 3; i++) {
      await postCar(app, token, trimId, { title: `매물${i}` });
    }

    const res = await request(app).get('/api/cars/search').query({ pageSize: 2, page: 2 });
    expect(res.body.total).toBe(3);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.page).toBe(2);
  });
});

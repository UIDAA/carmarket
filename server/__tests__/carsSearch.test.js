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

describe('GET /api/cars/search malformed query params', () => {
  it('falls back to the default sort instead of 500ing on a prototype-shaped ?sort value', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app);
    await postCar(app, token, trimId);

    const res = await request(app).get('/api/cars/search?sort=constructor');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('does not crash on a repeated query param (?fuel=a&fuel=b) — treats the array as absent', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db, { fuelType: '가솔린' });
    const token = await registerAndLogin(app);
    await postCar(app, token, trimId);

    // supertest/superagent 자체가 배열 쿼리를 리터럴 문자열로 인코딩해 보내므로,
    // 실제 리퀘스트 문자열을 직접 구성해 Express의 기본 파서가 배열로 파싱하게 만든다.
    const res = await request(app).get('/api/cars/search?fuel=가솔린&fuel=디젤');
    expect(res.status).toBe(200);
    // 배열은 스칼라가 아니므로 필터가 없는 것으로 취급되어야 한다 — 크래시하지 않고,
    // 두 연료 모두 필터링 없이 결과에 포함된다(여기서는 가솔린 매물 1건).
    expect(res.body.total).toBe(1);
  });

  it('ignores a bracket-nested malformed param (?priceMin[x]=1) instead of silently mis-filtering', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app);
    await postCar(app, token, trimId, { price: 5000000 });

    const res = await request(app).get('/api/cars/search?priceMin[x]=1');
    expect(res.status).toBe(200);
    // priceMin이 객체로 파싱되어도 필터가 없는 것처럼 무시되어야 한다 — 잘못 바인딩되어
    // 빈 결과가 나오면 안 된다.
    expect(res.body.total).toBe(1);
  });
});

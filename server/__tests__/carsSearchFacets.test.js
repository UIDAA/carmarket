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

describe('GET /api/cars/search facets', () => {
  it('excludes the fuel dimension itself when counting facets.fuel (self-exclusion)', async () => {
    const { app, db } = buildTestApp();
    const gasoline = seedTrim(db, { fuelType: '가솔린' });
    const diesel = seedTrim(db, { manufacturerName: '현대', modelGroupName: '싼타페', fuelType: '디젤' });
    const token = await registerAndLogin(app);
    await postCar(app, token, gasoline.trimId);
    await postCar(app, token, diesel.trimId);

    const res = await request(app).get('/api/cars/search').query({ fuel: '가솔린' });
    expect(res.body.total).toBe(1); // 결과 자체는 가솔린만
    const fuelFacet = res.body.facets.fuel;
    const dieselCount = fuelFacet.find((f) => f.value === '디젤').count;
    expect(dieselCount).toBe(1); // 파셋은 fuel 조건을 빼고 계산하므로 디젤도 보인다
  });

  it('keeps facets.total in sync with items/total for the same filter combination', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db, { fuelType: '가솔린' });
    const token = await registerAndLogin(app);
    await postCar(app, token, trimId);
    await postCar(app, token, trimId);

    const res = await request(app).get('/api/cars/search').query({ fuel: '가솔린' });
    const fuelFacet = res.body.facets.fuel.find((f) => f.value === '가솔린');
    expect(fuelFacet.count).toBe(res.body.total); // 가솔린 자체를 빼고 계산해도, 결과가 전부 가솔린이면 총량과 같아야 함
  });

  it('returns manufacturers facet at the root, and modelGroups only once a manufacturer is chosen', async () => {
    const { app, db } = buildTestApp();
    const { manufacturerId, trimId } = seedTrim(db);
    const token = await registerAndLogin(app);
    await postCar(app, token, trimId);

    const root = await request(app).get('/api/cars/search');
    expect(root.body.facets.manufacturers.length).toBeGreaterThan(0);
    expect(root.body.facets.modelGroups).toBeNull();

    const drilled = await request(app).get('/api/cars/search').query({ manufacturerId });
    expect(drilled.body.facets.modelGroups).not.toBeNull();
    expect(drilled.body.facets.models).toBeNull();
  });

  it('provides price and mileage bucket facets', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app);
    await postCar(app, token, trimId, { price: 5000000, mileage: 10000 });

    const res = await request(app).get('/api/cars/search');
    expect(res.body.facets.priceBuckets.length).toBeGreaterThan(0);
    expect(res.body.facets.mileageBuckets.length).toBeGreaterThan(0);
    const matchingBucket = res.body.facets.priceBuckets.find((b) => b.min <= 5000000 && (b.max === null || b.max > 5000000));
    expect(matchingBucket.count).toBeGreaterThanOrEqual(1);
  });
});

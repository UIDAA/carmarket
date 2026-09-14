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

  it('returns a non-null models facet with correct counts when manufacturerId and modelGroupId are both set', async () => {
    const { app, db } = buildTestApp();
    const cn7 = seedTrim(db); // 현대/아반떼/CN7
    const ad = seedTrim(db, { modelName: 'AD', startYear: 2015, endYear: 2019 }); // 같은 제조사/차종그룹, 다른 모델
    const token = await registerAndLogin(app);
    await postCar(app, token, cn7.trimId, { firstRegisteredYear: 2021 });
    await postCar(app, token, ad.trimId, { firstRegisteredYear: 2016 });

    const res = await request(app)
      .get('/api/cars/search')
      .query({ manufacturerId: cn7.manufacturerId, modelGroupId: cn7.modelGroupId });

    expect(res.status).toBe(200); // 이전에는 model_groups 조인 누락으로 500(SqliteError)이 났다
    expect(res.body.facets.models).not.toBeNull();
    const cn7Count = res.body.facets.models.find((m) => m.id === cn7.modelId).count;
    const adCount = res.body.facets.models.find((m) => m.id === ad.modelId).count;
    expect(cn7Count).toBe(1);
    expect(adCount).toBe(1);
  });

  it('returns a non-null trims facet with correct counts when manufacturerId, modelGroupId and modelId are all set', async () => {
    const { app, db } = buildTestApp();
    const gasolineTrim = seedTrim(db, { trimName: '가솔린 1.6 스마트' });
    const dieselTrim = seedTrim(db, { trimName: '디젤 1.6 프리미엄', fuelType: '디젤' }); // 같은 모델, 다른 트림
    const token = await registerAndLogin(app);
    await postCar(app, token, gasolineTrim.trimId);
    await postCar(app, token, dieselTrim.trimId);

    const res = await request(app).get('/api/cars/search').query({
      manufacturerId: gasolineTrim.manufacturerId,
      modelGroupId: gasolineTrim.modelGroupId,
      modelId: gasolineTrim.modelId,
    });

    expect(res.status).toBe(200); // 이전에는 models/model_groups 조인 누락으로 500(SqliteError)이 났다
    expect(res.body.facets.trims).not.toBeNull();
    const gasolineCount = res.body.facets.trims.find((t) => t.id === gasolineTrim.trimId).count;
    const dieselCount = res.body.facets.trims.find((t) => t.id === dieselTrim.trimId).count;
    expect(gasolineCount).toBe(1);
    expect(dieselCount).toBe(1);
  });

  it('keeps the region facet correct when combined with a catalog filter (manufacturerId)', async () => {
    const { app, db } = buildTestApp();
    const { manufacturerId, trimId } = seedTrim(db);
    const token = await registerAndLogin(app);
    await postCar(app, token, trimId, { region: '서울' });
    await postCar(app, token, trimId, { region: '부산' });

    const res = await request(app).get('/api/cars/search').query({ manufacturerId });

    expect(res.status).toBe(200); // 이전에는 region 파셋의 ON절이 model_groups를 오른쪽에서 참조해 500(SqliteError)이 났다
    const seoulCount = res.body.facets.region.find((r) => r.value === '서울').count;
    const busanCount = res.body.facets.region.find((r) => r.value === '부산').count;
    expect(seoulCount).toBe(1);
    expect(busanCount).toBe(1);
  });
});

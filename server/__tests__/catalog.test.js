const request = require('supertest');
const { buildTestApp, registerAndLogin } = require('./helpers/testApp');
const { seedTrim } = require('./helpers/catalogFixtures');

function postCarForm(app, token, fields) {
  const req = request(app).post('/api/cars').set('Authorization', `Bearer ${token}`);
  Object.entries(fields).forEach(([key, value]) => req.field(key, String(value)));
  return req;
}

describe('GET /api/catalog/manufacturers', () => {
  it('lists manufacturers with nameLegacy and a count of active listings', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db, { manufacturerName: 'KG모빌리티', nameLegacy: '쌍용' });
    const token = await registerAndLogin(app);
    await postCarForm(app, token, { title: '매물', trimId, firstRegisteredYear: 2021, mileage: 10000, price: 10000000, region: '서울' });

    const res = await request(app).get('/api/catalog/manufacturers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('KG모빌리티');
    expect(res.body[0].nameLegacy).toBe('쌍용');
    expect(res.body[0].count).toBe(1);
  });

  it('does not count 거래완료 listings', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app);
    const created = await postCarForm(app, token, { title: '매물', trimId, firstRegisteredYear: 2021, mileage: 10000, price: 10000000, region: '서울' });
    await request(app)
      .put(`/api/cars/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('status', '거래완료');

    const res = await request(app).get('/api/catalog/manufacturers');
    expect(res.body[0].count).toBe(0);
  });
});

describe('카탈로그 계단식 조회', () => {
  it('walks manufacturer -> model-groups -> models(+powertrain) -> years -> trims', async () => {
    const { app, db } = buildTestApp();
    const { manufacturerId, modelGroupId, modelId, trimId } = seedTrim(db, { startYear: 2020, endYear: 2023 });
    const token = await registerAndLogin(app);
    await postCarForm(app, token, { title: '매물', trimId, firstRegisteredYear: 2021, mileage: 10000, price: 10000000, region: '서울' });

    const groups = await request(app).get(`/api/catalog/manufacturers/${manufacturerId}/model-groups`);
    expect(groups.body).toEqual([expect.objectContaining({ id: modelGroupId, name: '아반떼', count: 1 })]);

    const models = await request(app).get(`/api/catalog/model-groups/${modelGroupId}/models`);
    expect(models.body).toEqual([
      expect.objectContaining({ id: modelId, name: 'CN7', powertrain: '일반', startYear: 2020, endYear: 2023, count: 1 }),
    ]);

    const years = await request(app).get(`/api/catalog/models/${modelId}/years`);
    expect(years.body).toHaveLength(4); // 2020~2023
    expect(years.body).toEqual(expect.arrayContaining([{ year: 2021, count: 1 }, { year: 2022, count: 0 }]));

    const trims = await request(app).get(`/api/catalog/models/${modelId}/trims`);
    expect(trims.body).toEqual([expect.objectContaining({ id: trimId, count: 1 })]);

    const trimsFilteredByYear = await request(app).get(`/api/catalog/models/${modelId}/trims`).query({ year: 2022 });
    expect(trimsFilteredByYear.body).toEqual([expect.objectContaining({ id: trimId, count: 0 })]);
  });

  it('separates a hybrid generation into its own model row', async () => {
    const { app, db } = buildTestApp();
    const gasoline = seedTrim(db, { modelGroupName: '그랜저', modelName: '그랜저 (GN7)', powertrain: '일반', startYear: 2022 });
    const hybrid = seedTrim(db, {
      manufacturerName: '현대',
      modelGroupName: '그랜저',
      modelName: '그랜저 하이브리드 (GN7)',
      powertrain: '하이브리드',
      startYear: 2022,
      trimName: '하이브리드 1.6 프리미엄',
      fuelType: '하이브리드',
    });

    const models = await request(app).get(`/api/catalog/model-groups/${gasoline.modelGroupId}/models`);
    const names = models.body.map((m) => ({ name: m.name, powertrain: m.powertrain }));
    expect(names).toEqual(
      expect.arrayContaining([
        { name: '그랜저 (GN7)', powertrain: '일반' },
        { name: '그랜저 하이브리드 (GN7)', powertrain: '하이브리드' },
      ])
    );
    expect(hybrid.modelGroupId).toBe(gasoline.modelGroupId); // 같은 모델그룹 아래 별도 세대로 존재
  });

  it('returns 404 for an unknown model when listing years', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/catalog/models/999/years');
    expect(res.status).toBe(404);
  });
});

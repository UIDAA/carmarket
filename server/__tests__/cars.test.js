const request = require('supertest');
const { buildTestApp, registerAndLogin } = require('./helpers/testApp');
const { seedTrim } = require('./helpers/catalogFixtures');

function carPayload(trimId, overrides = {}) {
  return {
    title: overrides.title || '2021 아반떼 CN7 스마트',
    trimId,
    firstRegisteredYear: overrides.firstRegisteredYear ?? 2021,
    ...(overrides.firstRegisteredMonth !== undefined ? { firstRegisteredMonth: overrides.firstRegisteredMonth } : {}),
    ...(overrides.modelYear !== undefined ? { modelYear: overrides.modelYear } : {}),
    mileage: overrides.mileage ?? 32000,
    price: overrides.price ?? 16800000,
    region: overrides.region || '서울 강남구',
    description: overrides.description || '무사고 차량입니다.',
  };
}

function postCar(app, token, payload) {
  const req = request(app).post('/api/cars').set('Authorization', `Bearer ${token}`);
  Object.entries(payload).forEach(([key, value]) => req.field(key, String(value)));
  return req;
}

describe('POST /api/cars', () => {
  it('creates a car from a trim for the logged-in seller', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app);

    const res = await postCar(app, token, carPayload(trimId, { firstRegisteredMonth: 7, modelYear: 2022 }));

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('판매중');
    // title은 판매자가 나중에 코멘트용으로 채울 자유 텍스트 칼럼이라 서버가 값을 지어내거나
    // 덮어쓰지 않는다 — 클라이언트가 보낸 값을 그대로 저장한다(여기서는 carPayload가 보낸 값).
    // 화면 표시용 제목은 별도의 display_title.
    expect(res.body.title).toBe('2021 아반떼 CN7 스마트');
    expect(res.body.display_title).toBe('현대 아반떼 가솔린 1.6 스마트 (2021년식)');
    expect(res.body.brand).toBe('현대');
    expect(res.body.model).toBe('아반떼');
    expect(res.body.fuel_type).toBe('가솔린');
    expect(res.body.trim_id).toBe(trimId);
    expect(res.body.first_registered_year).toBe(2021);
    expect(res.body.first_registered_month).toBe(7);
    expect(res.body.model_year).toBe(2022);
  });

  it('creates a car without a client-provided title (kept empty, reserved for a future seller comment)', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app);

    const req = request(app).post('/api/cars').set('Authorization', `Bearer ${token}`);
    Object.entries(carPayload(trimId)).forEach(([key, value]) => {
      if (key === 'title') return; // 일부러 title을 안 보낸다
      req.field(key, String(value));
    });
    const res = await req;

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('');
    expect(res.body.display_title).toBe('현대 아반떼 가솔린 1.6 스마트 (2021년식)');
  });

  it('creates a car without optional firstRegisteredMonth/modelYear (nullable)', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app);

    const res = await postCar(app, token, carPayload(trimId));

    expect(res.status).toBe(201);
    expect(res.body.first_registered_month).toBeNull();
    expect(res.body.model_year).toBeNull();
  });

  it('rejects a request without a token', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const res = await request(app)
      .post('/api/cars')
      .field('title', '제목')
      .field('trimId', String(trimId))
      .field('firstRegisteredYear', '2021')
      .field('mileage', '1')
      .field('price', '1')
      .field('region', '서울');
    expect(res.status).toBe(401);
  });

  it('rejects a request missing required fields', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);
    const res = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .field('title', '제목만 있음');
    expect(res.status).toBe(400);
  });

  it('rejects an unknown trimId', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);
    const res = await postCar(app, token, carPayload(999999));
    expect(res.status).toBe(400);
  });

  it('rejects a firstRegisteredYear outside the generation production range', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db, { startYear: 2020, endYear: 2022 });
    const token = await registerAndLogin(app);

    const res = await postCar(app, token, carPayload(trimId, { firstRegisteredYear: 2019 }));
    expect(res.status).toBe(400);
  });

  it('does not validate modelYear against the production range', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db, { startYear: 2020, endYear: 2022 });
    const token = await registerAndLogin(app);

    const res = await postCar(app, token, carPayload(trimId, { firstRegisteredYear: 2021, modelYear: 2035 }));
    expect(res.status).toBe(201);
    expect(res.body.model_year).toBe(2035);
  });
});

describe('GET /api/cars', () => {
  it('lists all cars', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app);
    await postCar(app, token, carPayload(trimId));

    const res = await request(app).get('/api/cars');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /api/cars/:id', () => {
  it('returns 404 for a missing car', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/cars/999');
    expect(res.status).toBe(404);
  });

  it('includes the seller nickname and derived catalog fields', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db, { transmission: '수동' });
    const token = await registerAndLogin(app, { nickname: '이든자동차' });
    const created = await postCar(app, token, carPayload(trimId));

    const res = await request(app).get(`/api/cars/${created.body.id}`);
    expect(res.body.seller_nickname).toBe('이든자동차');
    expect(res.body.transmission).toBe('수동');
    expect(res.body.display_title).toBe('현대 아반떼 가솔린 1.6 스마트 (2021년식)');
    expect(res.body.trim_name).toBeUndefined(); // 응답에서 trim_name은 제거되고 display_title만 남는다
  });
});

describe('GET /api/cars/mine', () => {
  it("returns only the logged-in seller's cars", async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const ownerToken = await registerAndLogin(app, { email: 'owner@test.com' });
    const otherToken = await registerAndLogin(app, { email: 'other@test.com', nickname: '다른유저' });

    await postCar(app, ownerToken, carPayload(trimId));
    await postCar(app, otherToken, carPayload(trimId));

    const res = await request(app).get('/api/cars/mine').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('PUT/DELETE /api/cars/:id ownership', () => {
  it('allows the owner to update their car', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app, { email: 'owner@test.com' });
    const created = await postCar(app, token, carPayload(trimId));

    const res = await request(app)
      .put(`/api/cars/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('price', '15000000');

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(15000000);
  });

  it('re-derives brand/model/fuel_type when trimId changes on update', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const { trimId: otherTrimId } = seedTrim(db, {
      manufacturerName: '기아',
      modelGroupName: 'K5',
      modelName: 'DL3',
      trimName: '가솔린 2.0',
      startYear: 2020,
    });
    const token = await registerAndLogin(app, { email: 'owner@test.com' });
    const created = await postCar(app, token, carPayload(trimId));

    const res = await request(app)
      .put(`/api/cars/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('trimId', String(otherTrimId))
      .field('firstRegisteredYear', '2021');

    expect(res.status).toBe(200);
    expect(res.body.brand).toBe('기아');
    expect(res.body.model).toBe('K5');
  });

  it("forbids editing another seller's car", async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const ownerToken = await registerAndLogin(app, { email: 'owner@test.com' });
    const otherToken = await registerAndLogin(app, { email: 'other@test.com', nickname: '다른유저' });
    const created = await postCar(app, ownerToken, carPayload(trimId));

    const res = await request(app)
      .put(`/api/cars/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .field('price', '1');

    expect(res.status).toBe(403);
  });

  it("forbids deleting another seller's car", async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const ownerToken = await registerAndLogin(app, { email: 'owner@test.com' });
    const otherToken = await registerAndLogin(app, { email: 'other@test.com', nickname: '다른유저' });
    const created = await postCar(app, ownerToken, carPayload(trimId));

    const res = await request(app)
      .delete(`/api/cars/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('allows the owner to delete their car', async () => {
    const { app, db } = buildTestApp();
    const { trimId } = seedTrim(db);
    const token = await registerAndLogin(app, { email: 'owner@test.com' });
    const created = await postCar(app, token, carPayload(trimId));

    const res = await request(app).delete(`/api/cars/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});

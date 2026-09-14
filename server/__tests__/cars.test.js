const request = require('supertest');
const { buildTestApp, registerAndLogin } = require('./helpers/testApp');

const carPayload = {
  title: '2021 아반떼 스마트',
  brand: '현대',
  model: '아반떼',
  year: 2021,
  mileage: 32000,
  price: 16800000,
  fuelType: '가솔린',
  region: '서울 강남구',
  description: '무사고 차량입니다.',
};

describe('POST /api/cars', () => {
  it('creates a car for the logged-in seller', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);

    const res = await request(app).post('/api/cars').set('Authorization', `Bearer ${token}`).send(carPayload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('판매중');
    expect(res.body.title).toBe(carPayload.title);
  });

  it('rejects a request without a token', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/cars').send(carPayload);
    expect(res.status).toBe(401);
  });

  it('rejects a request missing required fields', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);
    const res = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '제목만 있음' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/cars', () => {
  it('lists all cars', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);
    await request(app).post('/api/cars').set('Authorization', `Bearer ${token}`).send(carPayload);

    const res = await request(app).get('/api/cars');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('filters by brand', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);
    await request(app).post('/api/cars').set('Authorization', `Bearer ${token}`).send(carPayload);
    await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...carPayload, brand: '기아', title: '2022 K5' });

    const res = await request(app).get('/api/cars').query({ brand: '기아' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].brand).toBe('기아');
  });

  it('filters by keyword matching title or model', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);
    await request(app).post('/api/cars').set('Authorization', `Bearer ${token}`).send(carPayload);

    const res = await request(app).get('/api/cars').query({ keyword: '아반떼' });
    expect(res.body).toHaveLength(1);
  });

  it('filters by year range', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);
    await request(app).post('/api/cars').set('Authorization', `Bearer ${token}`).send(carPayload);
    await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...carPayload, year: 2017, title: '2017 오래된 차' });

    const res = await request(app).get('/api/cars').query({ minYear: 2020 });
    expect(res.body).toHaveLength(1);
    expect(res.body[0].year).toBe(2021);
  });
});

describe('GET /api/cars/:id', () => {
  it('returns 404 for a missing car', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/cars/999');
    expect(res.status).toBe(404);
  });

  it('includes the seller nickname and transmission', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app, { nickname: '이든자동차' });
    const created = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...carPayload, transmission: '수동' });

    const res = await request(app).get(`/api/cars/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.seller_nickname).toBe('이든자동차');
    expect(res.body.transmission).toBe('수동');
  });

  it('defaults transmission to 자동 when not provided', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);
    const created = await request(app).post('/api/cars').set('Authorization', `Bearer ${token}`).send(carPayload);

    expect(created.body.transmission).toBe('자동');
  });
});

describe('GET /api/cars/mine', () => {
  it("returns only the logged-in seller's cars", async () => {
    const { app } = buildTestApp();
    const ownerToken = await registerAndLogin(app, { email: 'owner@test.com' });
    const otherToken = await registerAndLogin(app, { email: 'other@test.com', nickname: '다른유저' });

    await request(app).post('/api/cars').set('Authorization', `Bearer ${ownerToken}`).send(carPayload);
    await request(app).post('/api/cars').set('Authorization', `Bearer ${otherToken}`).send(carPayload);

    const res = await request(app).get('/api/cars/mine').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('PUT/DELETE /api/cars/:id ownership', () => {
  it('allows the owner to update their car', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app, { email: 'owner@test.com' });
    const created = await request(app).post('/api/cars').set('Authorization', `Bearer ${token}`).send(carPayload);

    const res = await request(app)
      .put(`/api/cars/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 15000000 });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(15000000);
  });

  it("forbids editing another seller's car", async () => {
    const { app } = buildTestApp();
    const ownerToken = await registerAndLogin(app, { email: 'owner@test.com' });
    const otherToken = await registerAndLogin(app, { email: 'other@test.com', nickname: '다른유저' });
    const created = await request(app).post('/api/cars').set('Authorization', `Bearer ${ownerToken}`).send(carPayload);

    const res = await request(app)
      .put(`/api/cars/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ price: 1 });

    expect(res.status).toBe(403);
  });

  it("forbids deleting another seller's car", async () => {
    const { app } = buildTestApp();
    const ownerToken = await registerAndLogin(app, { email: 'owner@test.com' });
    const otherToken = await registerAndLogin(app, { email: 'other@test.com', nickname: '다른유저' });
    const created = await request(app).post('/api/cars').set('Authorization', `Bearer ${ownerToken}`).send(carPayload);

    const res = await request(app)
      .delete(`/api/cars/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('allows the owner to delete their car', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app, { email: 'owner@test.com' });
    const created = await request(app).post('/api/cars').set('Authorization', `Bearer ${token}`).send(carPayload);

    const res = await request(app).delete(`/api/cars/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});

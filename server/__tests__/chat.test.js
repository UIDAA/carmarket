const request = require('supertest');
const { buildTestApp, registerAndLogin } = require('./helpers/testApp');
const { seedTrim } = require('./helpers/catalogFixtures');

async function createCar(app, token, db) {
  const { trimId } = seedTrim(db);
  const res = await request(app)
    .post('/api/cars')
    .set('Authorization', `Bearer ${token}`)
    .field('title', '2021 아반떼')
    .field('trimId', String(trimId))
    .field('firstRegisteredYear', '2021')
    .field('mileage', '32000')
    .field('price', '16800000')
    .field('region', '서울');
  return res.body.id;
}

describe('POST /api/chat/rooms', () => {
  it('creates a room for a buyer inquiring about a car', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const carId = await createCar(app, sellerToken, db);

    const res = await request(app).post('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`).send({ carId });

    expect(res.status).toBe(201);
    expect(res.body.car_id).toBe(carId);
  });

  it('reuses an existing room for the same car and buyer', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const carId = await createCar(app, sellerToken, db);

    const first = await request(app).post('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`).send({ carId });
    const second = await request(app).post('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`).send({ carId });

    expect(first.body.id).toBe(second.body.id);
  });

  it('rejects a seller inquiring about their own car', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const carId = await createCar(app, sellerToken, db);

    const res = await request(app).post('/api/chat/rooms').set('Authorization', `Bearer ${sellerToken}`).send({ carId });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/chat/rooms', () => {
  it('lists rooms for both buyer and seller', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const carId = await createCar(app, sellerToken, db);
    await request(app).post('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`).send({ carId });

    const buyerList = await request(app).get('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`);
    const sellerList = await request(app).get('/api/chat/rooms').set('Authorization', `Bearer ${sellerToken}`);

    expect(buyerList.body).toHaveLength(1);
    expect(sellerList.body).toHaveLength(1);
  });

  it('includes the seller nickname and last message preview', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com', nickname: '이든자동차' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const carId = await createCar(app, sellerToken, db);
    const room = await request(app).post('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`).send({ carId });
    await request(app)
      .post(`/api/chat/rooms/${room.body.id}/messages`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ content: '아직 판매중인가요?' });

    const res = await request(app).get('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`);
    expect(res.body[0].seller_nickname).toBe('이든자동차');
    expect(res.body[0].last_message).toBe('아직 판매중인가요?');
  });
});

describe('GET /api/chat/rooms/:id', () => {
  it('returns room detail with seller nickname for a participant', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com', nickname: '이든자동차' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const carId = await createCar(app, sellerToken, db);
    const room = await request(app).post('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`).send({ carId });

    const res = await request(app).get(`/api/chat/rooms/${room.body.id}`).set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.seller_nickname).toBe('이든자동차');
    expect(res.body.car_title).toBe('2021 아반떼');
  });

  it('forbids a non-participant from viewing room detail', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const strangerToken = await registerAndLogin(app, { email: 'stranger@test.com', nickname: '제3자' });
    const carId = await createCar(app, sellerToken, db);
    const room = await request(app).post('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`).send({ carId });

    const res = await request(app).get(`/api/chat/rooms/${room.body.id}`).set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('chat messages', () => {
  it('sends a message and lists it', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const carId = await createCar(app, sellerToken, db);
    const room = await request(app).post('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`).send({ carId });

    const sendRes = await request(app)
      .post(`/api/chat/rooms/${room.body.id}/messages`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ content: '안녕하세요, 아직 판매중인가요?' });
    expect(sendRes.status).toBe(201);

    const listRes = await request(app)
      .get(`/api/chat/rooms/${room.body.id}/messages`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].content).toContain('판매중');
  });

  it('filters messages by since timestamp for polling', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const carId = await createCar(app, sellerToken, db);
    const room = await request(app).post('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`).send({ carId });

    await request(app)
      .post(`/api/chat/rooms/${room.body.id}/messages`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ content: '첫 메시지' });

    const futureSince = '2999-01-01 00:00:00';
    const res = await request(app)
      .get(`/api/chat/rooms/${room.body.id}/messages`)
      .query({ since: futureSince })
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.body).toHaveLength(0);
  });

  it('forbids access from a user outside the room', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const strangerToken = await registerAndLogin(app, { email: 'stranger@test.com', nickname: '제3자' });
    const carId = await createCar(app, sellerToken, db);
    const room = await request(app).post('/api/chat/rooms').set('Authorization', `Bearer ${buyerToken}`).send({ carId });

    const res = await request(app)
      .get(`/api/chat/rooms/${room.body.id}/messages`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(403);
  });
});

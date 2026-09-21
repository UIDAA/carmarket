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

describe('favorites', () => {
  it('adds and lists a favorite', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const carId = await createCar(app, sellerToken, db);

    const addRes = await request(app).post(`/api/favorites/${carId}`).set('Authorization', `Bearer ${buyerToken}`);
    expect(addRes.status).toBe(201);

    const listRes = await request(app).get('/api/favorites').set('Authorization', `Bearer ${buyerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(carId);
    // 마이페이지 찜 목록이 CarThumb/display_title을 쓰므로 이 필드가 빠지면 사진·제목이 안 뜬다.
    expect(listRes.body[0].display_title).toMatch(/\(2021년식\)$/);
  });

  it('removes a favorite', async () => {
    const { app, db } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const carId = await createCar(app, sellerToken, db);

    await request(app).post(`/api/favorites/${carId}`).set('Authorization', `Bearer ${buyerToken}`);
    const delRes = await request(app).delete(`/api/favorites/${carId}`).set('Authorization', `Bearer ${buyerToken}`);
    expect(delRes.status).toBe(200);

    const listRes = await request(app).get('/api/favorites').set('Authorization', `Bearer ${buyerToken}`);
    expect(listRes.body).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const { app, db } = buildTestApp();
    const res = await request(app).get('/api/favorites');
    expect(res.status).toBe(401);
  });
});

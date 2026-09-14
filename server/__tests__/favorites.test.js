const request = require('supertest');
const { buildTestApp, registerAndLogin } = require('./helpers/testApp');

async function createCar(app, token) {
  const res = await request(app)
    .post('/api/cars')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: '2021 아반떼', brand: '현대', model: '아반떼', year: 2021,
      mileage: 32000, price: 16800000, fuelType: '가솔린', region: '서울',
    });
  return res.body.id;
}

describe('favorites', () => {
  it('adds and lists a favorite', async () => {
    const { app } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const carId = await createCar(app, sellerToken);

    const addRes = await request(app).post(`/api/favorites/${carId}`).set('Authorization', `Bearer ${buyerToken}`);
    expect(addRes.status).toBe(201);

    const listRes = await request(app).get('/api/favorites').set('Authorization', `Bearer ${buyerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(carId);
  });

  it('removes a favorite', async () => {
    const { app } = buildTestApp();
    const sellerToken = await registerAndLogin(app, { email: 'seller@test.com' });
    const buyerToken = await registerAndLogin(app, { email: 'buyer@test.com', nickname: '구매자' });
    const carId = await createCar(app, sellerToken);

    await request(app).post(`/api/favorites/${carId}`).set('Authorization', `Bearer ${buyerToken}`);
    const delRes = await request(app).delete(`/api/favorites/${carId}`).set('Authorization', `Bearer ${buyerToken}`);
    expect(delRes.status).toBe(200);

    const listRes = await request(app).get('/api/favorites').set('Authorization', `Bearer ${buyerToken}`);
    expect(listRes.body).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/favorites');
    expect(res.status).toBe(401);
  });
});

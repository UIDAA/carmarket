const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');

describe('POST /api/auth/register', () => {
  it('creates a new user', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@test.com', password: 'pw1234', nickname: '테스터' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('a@test.com');
  });

  it('rejects a duplicate email', async () => {
    const { app } = buildTestApp();
    await request(app).post('/api/auth/register').send({ email: 'a@test.com', password: 'pw1234', nickname: '테스터' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@test.com', password: 'pw1234', nickname: '테스터2' });

    expect(res.status).toBe(400);
  });

  it('rejects a missing field', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/auth/register').send({ email: 'a@test.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and returns a token', async () => {
    const { app } = buildTestApp();
    await request(app).post('/api/auth/register').send({ email: 'a@test.com', password: 'pw1234', nickname: '테스터' });

    const res = await request(app).post('/api/auth/login').send({ email: 'a@test.com', password: 'pw1234' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe('a@test.com');
  });

  it('rejects a wrong password', async () => {
    const { app } = buildTestApp();
    await request(app).post('/api/auth/register').send({ email: 'a@test.com', password: 'pw1234', nickname: '테스터' });

    const res = await request(app).post('/api/auth/login').send({ email: 'a@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });
});

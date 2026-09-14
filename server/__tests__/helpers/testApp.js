const request = require('supertest');
const { createDb } = require('../../db/schema');
const { createApp } = require('../../app');

function buildTestApp() {
  const db = createDb(':memory:');
  const app = createApp(db);
  return { app, db };
}

async function registerAndLogin(app, overrides = {}) {
  const email = overrides.email || 'seller@test.com';
  const nickname = overrides.nickname || '판매자';
  await request(app).post('/api/auth/register').send({ email, password: 'pw1234', nickname });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'pw1234' });
  return res.body.token;
}

module.exports = { buildTestApp, registerAndLogin };

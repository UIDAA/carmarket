const request = require('supertest');
const { buildTestApp } = require('./helpers/testApp');

describe('GET /api/health', () => {
  it('returns ok: true', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

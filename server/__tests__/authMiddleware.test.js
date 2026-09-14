const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const { JWT_SECRET } = require('../config');

function buildProtectedApp() {
  const app = express();
  app.get('/protected', requireAuth, (req, res) => res.json({ userId: req.userId }));
  return app;
}

describe('requireAuth', () => {
  it('rejects a request with no token', async () => {
    const app = buildProtectedApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const app = buildProtectedApp();
    const res = await request(app).get('/protected').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('allows a valid token and sets req.userId', async () => {
    const app = buildProtectedApp();
    const token = jwt.sign({ userId: 42 }, JWT_SECRET);
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(42);
  });
});

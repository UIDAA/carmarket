const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../middleware/errorHandler');

describe('errorHandler', () => {
  it('converts a thrown error into a JSON error response', async () => {
    const app = express();
    app.get('/boom', () => {
      throw new Error('테스트 에러');
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('테스트 에러');
  });

  it('uses a custom status when provided on the error', async () => {
    const app = express();
    app.get('/boom', () => {
      const err = new Error('커스텀 에러');
      err.status = 418;
      throw err;
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(418);
  });
});

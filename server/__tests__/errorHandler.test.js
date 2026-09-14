const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../middleware/errorHandler');

describe('errorHandler', () => {
  it('converts an unexpected thrown error (no explicit status) into a generic Korean message', async () => {
    const app = express();
    app.get('/boom', () => {
      throw new Error('테스트 에러');
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    // status가 없는 에러는 내부 에러 취급 — 원문 메시지(드라이버 에러 등일 수 있음)를
    // 그대로 노출하지 않고 일반화된 한국어 메시지로 대체한다.
    expect(res.body.error).toBe('서버 오류가 발생했습니다.');
  });

  it('uses a custom status and passes through its message when provided on the error', async () => {
    const app = express();
    app.get('/boom', () => {
      const err = new Error('커스텀 에러');
      err.status = 418;
      throw err;
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(418);
    // 라우트 핸들러가 의도적으로 던진 에러(err.status 있음)는 이미 사용자용 한국어 메시지를
    // 담고 있으므로 그대로 전달되어야 한다.
    expect(res.body.error).toBe('커스텀 에러');
  });
});

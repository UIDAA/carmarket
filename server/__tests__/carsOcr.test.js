const request = require('supertest');
const { buildTestApp, registerAndLogin } = require('./helpers/testApp');
const { seedTrim } = require('./helpers/catalogFixtures');

// GeminiError는 실제 구현을 그대로 쓰고(자동 모킹하면 클래스 생성자 로직이 사라져
// err.reason이 안 채워진다 — 실제로 겪은 문제), recognizeRegistration만 목으로 바꾼다.
jest.mock('../services/gemini', () => ({
  ...jest.requireActual('../services/gemini'),
  recognizeRegistration: jest.fn(),
}));
const { recognizeRegistration, GeminiError } = require('../services/gemini');

describe('POST /api/cars/ocr', () => {
  it('인증 없이 호출하면 401', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/cars/ocr').attach('photo', Buffer.from('fake'), 'reg.png');
    expect(res.status).toBe(401);
  });

  it('강한 매칭이면 catalogMatch.confidence가 strong이고 modelId까지 온다', async () => {
    const { app, db } = buildTestApp();
    const token = await registerAndLogin(app);
    const { manufacturerId, modelGroupId, modelId } = seedTrim(db, { modelName: 'CN7', modelGroupName: '아반떼' });
    recognizeRegistration.mockResolvedValue({
      firstRegisteredDate: '2021-03-10',
      modelName: '아반떼(CN7)',
      displacementCc: 1598,
      fuelType: '가솔린',
    });

    const res = await request(app)
      .post('/api/cars/ocr')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('fake'), 'reg.png');

    expect(res.status).toBe(200);
    expect(res.body.ocrStatus).toBe('ok');
    expect(res.body.firstRegisteredYear).toBe(2021);
    expect(res.body.firstRegisteredMonth).toBe(3);
    expect(res.body.catalogMatch).toMatchObject({ confidence: 'strong', manufacturerId, modelGroupId, modelId });
  });

  it('Gemini 호출이 실패하면 200 + ocrStatus:failed로 응답한다(HTTP 에러 아님)', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);
    recognizeRegistration.mockRejectedValue(new GeminiError('rate_limited'));

    const res = await request(app)
      .post('/api/cars/ocr')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('fake'), 'reg.png');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ocrStatus: 'failed', reason: 'rate_limited' });
  });

  it('모델그룹을 못 찾으면 catalogMatch.confidence가 not_found다', async () => {
    const { app, db } = buildTestApp();
    const token = await registerAndLogin(app);
    seedTrim(db);
    recognizeRegistration.mockResolvedValue({
      firstRegisteredDate: '2021-01-01',
      modelName: '없는모델(XX9)',
      displacementCc: null,
      fuelType: null,
    });

    const res = await request(app)
      .post('/api/cars/ocr')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('fake'), 'reg.png');

    expect(res.body.catalogMatch).toEqual({ confidence: 'not_found' });
    expect(res.body.firstRegisteredYear).toBe(2021); // 카탈로그 매칭 실패해도 날짜는 채워짐
  });
});

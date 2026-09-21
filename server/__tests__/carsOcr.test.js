const path = require('path');
const { execFileSync } = require('child_process');
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

  it('첨부 파일이 15MB를 넘으면 500이 아니라 200 + ocrStatus:failed(file_too_large)로 응답한다', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);
    const oversized = Buffer.alloc(16 * 1024 * 1024, 1);
    recognizeRegistration.mockClear();

    const res = await request(app)
      .post('/api/cars/ocr')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', oversized, { filename: 'reg.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ocrStatus: 'failed', reason: 'file_too_large' });
    expect(recognizeRegistration).not.toHaveBeenCalled();
  });

  it('readabilityIssue가 blurry/wrong_document면 catalogMatch 없이 ocrStatus:failed로 응답한다', async () => {
    const { app } = buildTestApp();
    const token = await registerAndLogin(app);
    recognizeRegistration.mockResolvedValue({
      readabilityIssue: 'blurry',
      firstRegisteredDate: null,
      modelName: null,
      displacementCc: null,
      fuelType: null,
    });

    const res = await request(app)
      .post('/api/cars/ocr')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('fake'), 'reg.png');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ocrStatus: 'failed', reason: 'blurry' });
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

  // 날짜만 있는 ISO 문자열("2021-01-01")은 UTC 자정으로 파싱되므로, 로컬 타임존
  // getter(getFullYear/getMonth)를 쓰면 서버 TZ가 음수 오프셋일 때 하루 밀려 읽힌다
  // (예: America/New_York에서 2020년 12월로 잘못 읽힘). 이미 떠 있는 Jest 프로세스
  // 안에서 `process.env.TZ`를 바꿔도 Node가 프로세스 시작 시 캐시해둔 로컬 타임존에는
  // 반영되지 않아 재현이 안 되므로(직접 확인함), TZ를 프로세스 생성 시점에 넘겨
  // 완전히 새 자식 프로세스를 띄우는 방식으로 재현한다.
  it('월/연 경계 날짜는 서버 TZ가 음수 오프셋이어도 밀리지 않는다(UTC 파싱 회귀 테스트)', () => {
    const scriptPath = path.join(__dirname, 'helpers', 'ocrTimezoneCheck.js');
    const output = execFileSync('node', [scriptPath], {
      env: { ...process.env, TZ: 'America/New_York' }, // UTC-5
      encoding: 'utf8',
    });
    const { status, body } = JSON.parse(output);

    expect(status).toBe(200);
    expect(body.ocrStatus).toBe('ok');
    expect(body.firstRegisteredYear).toBe(2021);
    expect(body.firstRegisteredMonth).toBe(1);
  });
});

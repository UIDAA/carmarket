const { GEMINI_API_KEY } = require('../../config');

describe('gemini 서비스', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalKey;
    jest.resetModules();
  });

  function loadService() {
    // config.js가 모듈 로드 시점에 GEMINI_API_KEY를 읽으므로, env를 바꾼 뒤엔 모듈을 다시 로드해야 한다.
    return require('../../services/gemini');
  }

  it('GEMINI_API_KEY가 없으면 not_configured로 실패한다(fetch를 호출하지 않음)', async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    const { recognizeRegistration, GeminiError } = loadService();

    await expect(recognizeRegistration(Buffer.from('x'), 'image/png')).rejects.toMatchObject(
      new GeminiError('not_configured')
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Gemini가 429를 반환하면 rate_limited로 실패하고 콘솔에 경고를 남긴다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({ status: 429, ok: false });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { recognizeRegistration, GeminiError } = loadService();

    await expect(recognizeRegistration(Buffer.from('x'), 'image/png')).rejects.toMatchObject(
      new GeminiError('rate_limited')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[gemini-ocr] failed',
      expect.objectContaining({ reason: 'rate_limited', at: expect.any(String) })
    );
    warnSpy.mockRestore();
  });

  it('네트워크 오류가 나면 network로 실패한다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockRejectedValue(new Error('boom'));
    const { recognizeRegistration, GeminiError } = loadService();

    await expect(recognizeRegistration(Buffer.from('x'), 'image/png')).rejects.toMatchObject(
      new GeminiError('network')
    );
  });

  it('응답 JSON을 파싱할 수 없으면 unparseable로 실패한다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '이건 JSON이 아님' }] } }] }),
    });
    const { recognizeRegistration, GeminiError } = loadService();

    await expect(recognizeRegistration(Buffer.from('x'), 'image/png')).rejects.toMatchObject(
      new GeminiError('unparseable')
    );
  });

  it('정상 응답을 파싱해서 5개 필드를 돌려준다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const payload = {
      readabilityIssue: null,
      firstRegisteredDate: '2022-03-15',
      modelName: '아반떼(CN7)',
      displacementCc: 1598,
      fuelType: '가솔린',
    };
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    });
    const { recognizeRegistration } = loadService();

    const result = await recognizeRegistration(Buffer.from('x'), 'image/png');
    expect(result).toEqual(payload);
  });

  it('readabilityIssue가 blurry/wrong_document면 그대로 반환하고, 그 외 값은 null로 정규화한다', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const { recognizeRegistration } = loadService();

    async function withIssue(issue) {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ readabilityIssue: issue, firstRegisteredDate: null, modelName: null, displacementCc: null, fuelType: null }) }],
              },
            },
          ],
        }),
      });
      return recognizeRegistration(Buffer.from('x'), 'image/png');
    }

    expect((await withIssue('blurry')).readabilityIssue).toBe('blurry');
    expect((await withIssue('wrong_document')).readabilityIssue).toBe('wrong_document');
    expect((await withIssue('nonsense')).readabilityIssue).toBeNull();
  });
});

const { GEMINI_API_KEY } = require('../config');

// gemini-2.5-flash-lite는 신규 사용자에게 더 이상 제공되지 않아(2026-09 기준, Google API가
// 404 NOT_FOUND로 응답하며 gemini-3.5-flash-lite로 이전하라고 안내함) 3.5로 교체함. 모델
// 세대 교체가 잦으니 이후에도 404가 나면 https://ai.google.dev/gemini-api/docs 에서 현재
// 사용 가능한 모델명을 다시 확인할 것.
const MODEL = 'gemini-3.5-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    readabilityIssue: { type: 'STRING', nullable: true },
    firstRegisteredDate: { type: 'STRING', nullable: true },
    modelName: { type: 'STRING', nullable: true },
    displacementCc: { type: 'NUMBER', nullable: true },
    fuelType: { type: 'STRING', nullable: true },
  },
};

const PROMPT = `이 이미지는 한국 자동차등록증이어야 한다.

먼저 readabilityIssue를 판단해라:
- 이미지가 한국 자동차등록증이 아니거나 등록증 양식과 명백히 다르면 "wrong_document"
- 등록증은 맞는 것 같지만 글씨가 흐리거나 잘리거나 가려서 아래 항목을 읽을 수 없으면 "blurry"
- 정상적으로 읽을 수 있으면 null

readabilityIssue가 "wrong_document" 또는 "blurry"면 나머지 필드는 모두 null로 두고, 그렇지
않으면 다음 정보만 JSON으로 추출해줘:
- firstRegisteredDate: 최초등록일 (YYYY-MM-DD 형식, 확실하지 않으면 null)
- modelName: 차명 (등록증에 적힌 그대로, 예: "아반떼(CN7)")
- displacementCc: 배기량(cc, 숫자만)
- fuelType: 연료의 종류 ("가솔린"/"디젤"/"하이브리드"/"전기"/"LPG" 중 하나로 정규화, 불확실하면 null)

절대 지키세요: 소유자 성명, 주소, 차대번호, 차량등록번호(번호판)는 절대 추출하거나 언급하지
마세요. 위 5개 항목(readabilityIssue 포함) 외에는 아무것도 출력하지 마세요.`;

const READABILITY_ISSUES = ['blurry', 'wrong_document'];

class GeminiError extends Error {
  constructor(reason) {
    super(`gemini error: ${reason}`);
    this.reason = reason;
  }
}

function fail(reason) {
  console.warn('[gemini-ocr] failed', { reason, at: new Date().toISOString() });
  throw new GeminiError(reason);
}

async function recognizeRegistration(imageBuffer, mimeType) {
  if (!GEMINI_API_KEY) fail('not_configured');

  const body = {
    contents: [
      {
        parts: [{ text: PROMPT }, { inlineData: { mimeType, data: imageBuffer.toString('base64') } }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  let res;
  try {
    res = await fetch(`${API_BASE}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    fail('network');
  }

  if (res.status === 429) fail('rate_limited');
  if (!res.ok) fail('network');

  let data;
  try {
    data = await res.json();
  } catch (err) {
    fail('unparseable');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) fail('unparseable');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    fail('unparseable');
  }

  return {
    readabilityIssue: READABILITY_ISSUES.includes(parsed.readabilityIssue) ? parsed.readabilityIssue : null,
    firstRegisteredDate: typeof parsed.firstRegisteredDate === 'string' ? parsed.firstRegisteredDate : null,
    modelName: typeof parsed.modelName === 'string' ? parsed.modelName : null,
    displacementCc: typeof parsed.displacementCc === 'number' ? parsed.displacementCc : null,
    fuelType: typeof parsed.fuelType === 'string' ? parsed.fuelType : null,
  };
}

module.exports = { recognizeRegistration, GeminiError };

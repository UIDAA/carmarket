const { GEMINI_API_KEY } = require('../config');

const MODEL = 'gemini-2.5-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// 실제 필드명/파라미터 형식은 구현 시점에 https://ai.google.dev/gemini-api/docs 로
// 한 번 더 확인할 것(모델 세대 교체가 잦음) — 아래는 설계 시점 기준.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    firstRegisteredDate: { type: 'STRING', nullable: true },
    modelName: { type: 'STRING', nullable: true },
    displacementCc: { type: 'NUMBER', nullable: true },
    fuelType: { type: 'STRING', nullable: true },
  },
};

const PROMPT = `이 이미지는 한국 자동차등록증이다. 다음 정보만 JSON으로 추출해줘:
- firstRegisteredDate: 최초등록일 (YYYY-MM-DD 형식, 확실하지 않으면 null)
- modelName: 차명 (등록증에 적힌 그대로, 예: "아반떼(CN7)")
- displacementCc: 배기량(cc, 숫자만)
- fuelType: 연료의 종류 ("가솔린"/"디젤"/"하이브리드"/"전기"/"LPG" 중 하나로 정규화, 불확실하면 null)

절대 지키세요: 소유자 성명, 주소, 차대번호, 차량등록번호(번호판)는 절대 추출하거나 언급하지
마세요. 위 4개 항목 외에는 아무것도 출력하지 마세요.`;

class GeminiError extends Error {
  constructor(reason) {
    super(`gemini error: ${reason}`);
    this.reason = reason;
  }
}

async function recognizeRegistration(imageBuffer, mimeType) {
  if (!GEMINI_API_KEY) {
    throw new GeminiError('not_configured');
  }

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
    throw new GeminiError('network');
  }

  if (res.status === 429) {
    console.warn('[gemini-ocr] rate limited', { at: new Date().toISOString() });
    throw new GeminiError('rate_limited');
  }
  if (!res.ok) {
    throw new GeminiError('network');
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new GeminiError('unparseable');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiError('unparseable');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new GeminiError('unparseable');
  }

  return {
    firstRegisteredDate: typeof parsed.firstRegisteredDate === 'string' ? parsed.firstRegisteredDate : null,
    modelName: typeof parsed.modelName === 'string' ? parsed.modelName : null,
    displacementCc: typeof parsed.displacementCc === 'number' ? parsed.displacementCc : null,
    fuelType: typeof parsed.fuelType === 'string' ? parsed.fuelType : null,
  };
}

module.exports = { recognizeRegistration, GeminiError };

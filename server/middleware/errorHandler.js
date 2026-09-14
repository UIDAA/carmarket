const GENERIC_ERROR_MESSAGE = '서버 오류가 발생했습니다.';

function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  // err.status가 명시적으로 설정된 에러는 라우트 핸들러가 의도적으로 던진 것으로,
  // 이미 사용자에게 보여줄 한국어 메시지를 담고 있다 — 그대로 전달한다.
  // status가 없는 에러는 예기치 못한 내부 에러(예: 잘못된 쿼리로 인한 SQLite 드라이버 에러)이므로,
  // 원문(영문/드라이버 문구일 수 있음)을 그대로 노출하지 않고 일반화된 한국어 메시지로 대체한다.
  const message = err.status ? err.message || GENERIC_ERROR_MESSAGE : GENERIC_ERROR_MESSAGE;
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };

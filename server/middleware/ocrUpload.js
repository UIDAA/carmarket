const multer = require('multer');

// 등록증 이미지는 디스크에 절대 쓰지 않는다 — 메모리에서 받아 Gemini로 보낸 뒤 버린다.
// 실제 휴대폰 카메라로 찍은 등록증 사진은(특히 PNG로 찍으면) 수 MB를 쉽게 넘기므로
// 15MB로 여유를 둔다 — 5MB였을 때 실사용 사진이 잘려 들어와 원인 불명의 500 에러가 났었음.
const ocrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
    }
    cb(null, true);
  },
});

// ocrUpload.single('photo')이 던지는 에러(파일 용량 초과 등)를 라우트의 200 + ocrStatus:'failed'
// 계약 안으로 흡수한다 — 그대로 두면 전역 errorHandler가 500을 반환해 클라이언트가 이유를
// 구분 못 하고 "서버 오류" 메시지만 보게 된다.
function ocrUploadOrFail(req, res, next) {
  ocrUpload.single('photo')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.json({ ocrStatus: 'failed', reason: 'file_too_large' });
    }
    next(err);
  });
}

module.exports = { ocrUpload, ocrUploadOrFail };

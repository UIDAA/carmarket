const multer = require('multer');

// 등록증 이미지는 디스크에 절대 쓰지 않는다 — 메모리에서 받아 Gemini로 보낸 뒤 버린다.
const ocrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
    }
    cb(null, true);
  },
});

module.exports = { ocrUpload };

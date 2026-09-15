import { useState } from 'react';
import { recognizeRegistration, type OcrResult } from '../api/ocr';

interface Props {
  onResult: (result: OcrResult) => void;
}

export default function RegistrationOcrUpload({ onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 골라도 onChange가 다시 뜨도록
    if (!file) return;

    setLoading(true);
    setMessage(null);
    try {
      const result = await recognizeRegistration(file);
      if (result.ocrStatus === 'failed') {
        setMessage('자동 인식을 할 수 없어요. 직접 입력해주세요.');
      } else if (result.catalogMatch?.confidence === 'not_found') {
        setMessage('이 차는 목록에 없을 수 있어요. 차종은 직접 선택해주세요.');
      } else {
        setMessage('등록증 내용을 인식했어요. 아래에서 확인해주세요.');
      }
      onResult(result);
    } catch {
      setMessage('자동 인식을 할 수 없어요. 직접 입력해주세요.');
      onResult({ ocrStatus: 'failed', reason: 'network' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ocr-upload">
      <div className="ocr-upload-header">
        <strong>등록증으로 자동 입력 (선택)</strong>
        <span className="ocr-upload-notice">
          등록증 이미지는 자동 인식을 위해 Google Gemini API로 전송되며, 서버에는 저장되지 않습니다.
        </span>
      </div>
      <input type="file" accept="image/*" onChange={handleChange} disabled={loading} />
      {loading && <p style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 6 }}>인식 중...</p>}
      {message && !loading && <p style={{ fontSize: 13, marginTop: 6 }}>{message}</p>}
    </div>
  );
}

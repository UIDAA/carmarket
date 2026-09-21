import { useState } from 'react';
import { recognizeRegistration, type OcrResult } from '../api/ocr';

interface Props {
  onResult: (result: OcrResult) => void;
}

function failureMessage(reason: OcrResult['reason']): string {
  if (reason === 'blurry') return '사진이 흐려서 읽지 못했어요. 글씨가 잘 보이도록 더 선명하게 다시 찍어주세요.';
  if (reason === 'wrong_document') return '자동차등록증 사진이 맞는지 확인해주세요. 등록증 전체가 나오게 다시 찍어주세요.';
  if (reason === 'file_too_large') return '사진 용량이 너무 커요(15MB 이하). 더 작은 사진으로 다시 시도해주세요.';
  return '서버 오류로 자동 인식에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해주세요.';
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
        setMessage(failureMessage(result.reason));
      } else if (result.catalogMatch?.confidence === 'not_found') {
        setMessage('이 차는 목록에 없을 수 있어요. 차종은 직접 선택해주세요.');
      } else {
        setMessage('등록증 내용을 인식했어요. 아래에서 확인해주세요.');
      }
      onResult(result);
    } catch {
      setMessage(failureMessage('network'));
      onResult({ ocrStatus: 'failed', reason: 'network' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ocr-upload">
      <div className="ocr-upload-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" />
        </svg>
      </div>
      <div className="ocr-upload-body">
        <div className="ocr-upload-title">등록증으로 자동 입력</div>
        <div className="ocr-upload-sub">자동차등록증 사진을 올려주세요 (선택)</div>
        {loading && <p className="ocr-upload-status">인식 중...</p>}
        {message && !loading && <p className="ocr-upload-status">{message}</p>}
      </div>
      <label htmlFor="ocr-photo-input" className={`upload-btn${loading ? ' upload-btn--disabled' : ''}`}>
        사진 선택
      </label>
      <input
        id="ocr-photo-input"
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={loading}
        className="visually-hidden-input"
      />
    </div>
  );
}

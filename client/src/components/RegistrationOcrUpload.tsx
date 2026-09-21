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
      <div className="ocr-upload-header">
        <strong>등록증으로 자동 입력 (선택)</strong>
      </div>
      <input type="file" accept="image/*" onChange={handleChange} disabled={loading} />
      {loading && <p style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 6 }}>인식 중...</p>}
      {message && !loading && <p style={{ fontSize: 13, marginTop: 6 }}>{message}</p>}
    </div>
  );
}

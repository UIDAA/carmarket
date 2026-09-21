import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { type Car, type CarInput, createCar, getCar, resolveImageUrl, updateCar } from '../api/cars';
import { ApiError } from '../api/client';
import Header from '../components/Header';
import RegistrationOcrUpload from '../components/RegistrationOcrUpload';
import { type OcrCandidate, type OcrResult } from '../api/ocr';
import VehiclePicker, { type VehiclePickerValue } from '../components/VehiclePicker';

const CURRENT_YEAR = new Date().getFullYear();

// 숫자 입력란(연도/월/주행거리/가격 등)은 min을 지정해도 브라우저에 따라 음수 타이핑 자체는
// 막아주지 않는 경우가 있어, state에 반영하기 전에 직접 하한을 clamp한다.
function clampToMin(rawValue: string, min: number): number | '' {
  if (rawValue === '') return '';
  return Math.max(min, Number(rawValue));
}

const SIDO_LIST = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

export default function CarFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<VehiclePickerValue>({});
  const [vehicleAutoFilled, setVehicleAutoFilled] = useState(false);
  const [autoFilledYear, setAutoFilledYear] = useState(false);
  const [autoFilledMonth, setAutoFilledMonth] = useState(false);
  const [ocrCandidates, setOcrCandidates] = useState<NonNullable<OcrResult['catalogMatch']>['candidates']>(undefined);
  const [candidateTrimIds, setCandidateTrimIds] = useState<number[]>([]);
  const [loadedCar, setLoadedCar] = useState<Car | null>(null);
  const [firstRegisteredYear, setFirstRegisteredYear] = useState<number | ''>('');
  const [firstRegisteredMonth, setFirstRegisteredMonth] = useState<number | ''>('');
  const [modelYear, setModelYear] = useState<number | ''>('');
  const [mileage, setMileage] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [region, setRegion] = useState('');
  const [description, setDescription] = useState('');
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getCar(id).then((car) => {
      setLoadedCar(car);
      setMileage(car.mileage);
      setPrice(car.price);
      setRegion(car.region);
      setDescription(car.description ?? '');
      setVehicle({ trimId: car.trim_id, year: car.first_registered_year });
      setFirstRegisteredYear(car.first_registered_year);
      setFirstRegisteredMonth(car.first_registered_month ?? '');
      setModelYear(car.model_year ?? '');
      setExistingImageUrl(car.image_url);
    });
  }, [id]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function handleOcrResult(result: OcrResult) {
    // 새 업로드마다 이전 업로드의 후보/트림 힌트는 항상 무효화한다 — 그렇지 않으면 이전 결과의
    // 후보 칩이 화면에 남아 있다가 이번 업로드와 무관한 차종이 잘못 적용될 수 있다.
    setOcrCandidates(undefined);
    setCandidateTrimIds([]);

    if (result.ocrStatus !== 'ok') return;

    if (result.firstRegisteredYear) {
      setFirstRegisteredYear(result.firstRegisteredYear);
      setAutoFilledYear(true);
    }
    if (result.firstRegisteredMonth) {
      setFirstRegisteredMonth(result.firstRegisteredMonth);
      setAutoFilledMonth(true);
    }

    const match = result.catalogMatch;
    if (match?.confidence === 'strong') {
      setVehicle({
        manufacturerId: match.manufacturerId,
        modelGroupId: match.modelGroupId,
        modelId: match.modelId,
      });
      setVehicleAutoFilled(true);
      setOcrCandidates(undefined);
    } else if (match?.confidence === 'ambiguous') {
      setOcrCandidates(match.candidates);
    }

    setCandidateTrimIds(result.trimHint?.candidateTrimIds ?? []);
  }

  function applyOcrCandidate(candidate: OcrCandidate) {
    setVehicle({
      manufacturerId: candidate.manufacturerId,
      modelGroupId: candidate.modelGroupId,
      modelId: candidate.modelId,
    });
    setVehicleAutoFilled(true);
    setOcrCandidates(undefined);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!vehicle.trimId || !firstRegisteredYear || mileage === '' || price === '' || !region) {
      setError('필수 항목을 모두 선택/입력해주세요.');
      return;
    }
    const input: CarInput = {
      trimId: vehicle.trimId,
      firstRegisteredYear: Number(firstRegisteredYear),
      ...(firstRegisteredMonth ? { firstRegisteredMonth: Number(firstRegisteredMonth) } : {}),
      ...(modelYear ? { modelYear: Number(modelYear) } : {}),
      mileage: Number(mileage),
      price: Number(price),
      region,
      description,
      photo,
    };
    try {
      const car = isEdit && id ? await updateCar(id, input) : await createCar(input);
      navigate(`/cars/${car.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장에 실패했습니다.');
    }
  }

  const displayImageUrl = previewUrl ?? resolveImageUrl(existingImageUrl);

  return (
    <div>
      <Header />
      <form onSubmit={handleSubmit} className="page" style={{ maxWidth: 760, paddingTop: 40, paddingBottom: 100 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>{isEdit ? '매물 수정하기' : '매물 등록하기'}</h1>
        <p style={{ color: 'var(--text-soft)', fontSize: 14, margin: '0 0 28px' }}>
          등록증 사진 한 장이면 차종·연식이 자동으로 채워져요.
        </p>
        {error && (
          <p role="alert" style={{ marginBottom: 18 }}>
            {error}
          </p>
        )}

        <div className="section">
          <RegistrationOcrUpload onResult={handleOcrResult} />
        </div>

        <div className="section">
          <div className="section-head">
            <span className="section-num">1</span>
            <span className="section-title">차량 정보</span>
          </div>

          <div className="field">
            <label>
              차종 선택
              {vehicleAutoFilled && <span className="auto-badge">자동 인식됨</span>}
            </label>
            {isEdit && loadedCar && (
              <p style={{ marginBottom: 10, fontSize: 13, color: 'var(--text-soft)' }}>
                현재 선택: {loadedCar.brand} {loadedCar.model} · {loadedCar.fuel_type} · {loadedCar.transmission}
              </p>
            )}
            <VehiclePicker
              value={vehicle}
              onChange={(next) => {
                setVehicle(next);
                setVehicleAutoFilled(false);
              }}
              highlightTrimIds={candidateTrimIds}
            />
            {ocrCandidates && ocrCandidates.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 6 }}>이 중 하나인 것 같아요:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ocrCandidates.map((c) => (
                    <button key={c.modelId} type="button" className="chip" onClick={() => applyOcrCandidate(c)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="row2">
            <div className={`field${autoFilledYear ? ' field--auto-filled' : ''}`}>
              <label htmlFor="field-first-registered-year">
                최초등록연도
                {autoFilledYear && <span className="auto-badge">자동</span>}
              </label>
              <input
                id="field-first-registered-year"
                className="input"
                type="number"
                min={1990}
                max={CURRENT_YEAR}
                value={firstRegisteredYear}
                onChange={(e) => {
                  setFirstRegisteredYear(clampToMin(e.target.value, 1990));
                  setAutoFilledYear(false);
                }}
                required
              />
            </div>
            <div className={`field${autoFilledMonth ? ' field--auto-filled' : ''}`}>
              <label htmlFor="field-first-registered-month">
                최초등록월 (선택)
                {autoFilledMonth && <span className="auto-badge">자동</span>}
              </label>
              <input
                id="field-first-registered-month"
                className="input"
                type="number"
                min={1}
                max={12}
                value={firstRegisteredMonth}
                onChange={(e) => {
                  setFirstRegisteredMonth(clampToMin(e.target.value, 1));
                  setAutoFilledMonth(false);
                }}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="field-model-year">연형 (선택, 최초등록연도와 다를 때만)</label>
            <input
              id="field-model-year"
              className="input"
              type="number"
              min={1990}
              max={CURRENT_YEAR}
              value={modelYear}
              onChange={(e) => setModelYear(clampToMin(e.target.value, 1990))}
            />
          </div>
        </div>

        <div className="section">
          <div className="section-head">
            <span className="section-num">2</span>
            <span className="section-title">사진</span>
            <span className="section-desc">최대 5MB, JPG/PNG</span>
          </div>
          <div className="photo-row">
            <div className="photo-preview">
              {displayImageUrl && <img src={displayImageUrl} alt="매물 사진 미리보기" />}
            </div>
            <label htmlFor="photo" className="photo-upload-area">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5">
                <path
                  d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
              <span>클릭해서 사진 선택</span>
            </label>
            <input id="photo" type="file" accept="image/*" onChange={handlePhotoChange} className="visually-hidden-input" />
          </div>
        </div>

        <div className="section">
          <div className="section-head">
            <span className="section-num">3</span>
            <span className="section-title">가격 및 지역</span>
          </div>
          <div className="row2">
            <div className="field">
              <label htmlFor="field-mileage">주행거리(km)</label>
              <input
                id="field-mileage"
                className="input"
                type="number"
                min={0}
                value={mileage}
                onChange={(e) => setMileage(clampToMin(e.target.value, 0))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="field-price">가격(원)</label>
              <input
                id="field-price"
                className="input"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(clampToMin(e.target.value, 0))}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="field-region">지역</label>
            <select
              id="field-region"
              className="input"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
            >
              <option value="">지역 선택</option>
              {SIDO_LIST.map((sido) => (
                <option key={sido} value={sido}>
                  {sido}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="section">
          <div className="section-head">
            <span className="section-num">4</span>
            <span className="section-title">상세 설명</span>
            <span className="section-desc">선택</span>
          </div>
          <textarea
            id="field-description"
            aria-label="상세설명"
            className="input"
            rows={5}
            style={{ resize: 'vertical' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-bottom-bar">
          <div className="form-bottom-bar-inner">
            <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
              취소
            </button>
            <button type="submit" className="btn-primary">
              {isEdit ? '수정하기' : '등록하기'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

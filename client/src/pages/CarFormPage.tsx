import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { type Car, type CarInput, createCar, getCar, resolveImageUrl, updateCar } from '../api/cars';
import { ApiError } from '../api/client';
import Header from '../components/Header';
import VehiclePicker, { type VehiclePickerValue } from '../components/VehiclePicker';

const CURRENT_YEAR = new Date().getFullYear();

const SIDO_LIST = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

export default function CarFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<VehiclePickerValue>({});
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
      <form onSubmit={handleSubmit} className="page" style={{ maxWidth: 760, paddingTop: 40, paddingBottom: 60 }}>
        <h1 style={{ fontSize: 24, marginBottom: 28 }}>{isEdit ? '매물 수정하기' : '매물 등록하기'}</h1>
        {error && (
          <p role="alert" style={{ marginBottom: 18 }}>
            {error}
          </p>
        )}

        <div className="field">
          <label>차종 선택</label>
          {isEdit && loadedCar && (
            <p style={{ marginBottom: 10, fontSize: 13, color: 'var(--text-soft)' }}>
              현재 선택: {loadedCar.brand} {loadedCar.model} · {loadedCar.fuel_type} · {loadedCar.transmission}
            </p>
          )}
          <VehiclePicker value={vehicle} onChange={setVehicle} />
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="field-first-registered-year">최초등록연도</label>
            <input
              id="field-first-registered-year"
              className="input"
              type="number"
              min={1990}
              max={CURRENT_YEAR}
              value={firstRegisteredYear}
              onChange={(e) => setFirstRegisteredYear(e.target.value ? Number(e.target.value) : '')}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="field-first-registered-month">최초등록월 (선택)</label>
            <input
              id="field-first-registered-month"
              className="input"
              type="number"
              min={1}
              max={12}
              value={firstRegisteredMonth}
              onChange={(e) => setFirstRegisteredMonth(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="field-model-year">연형 (선택, 최초등록연도와 다를 때만)</label>
          <input
            id="field-model-year"
            className="input"
            type="number"
            value={modelYear}
            onChange={(e) => setModelYear(e.target.value ? Number(e.target.value) : '')}
          />
        </div>

        <div className="field">
          <label htmlFor="photo">매물 사진</label>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div
              style={{
                width: 180,
                height: 130,
                borderRadius: 'var(--radius)',
                background: 'var(--muted-soft)',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {displayImageUrl && (
                <img
                  src={displayImageUrl}
                  alt="매물 사진 미리보기"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>
            <div
              style={{
                border: '1.5px dashed var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '20px 24px',
                flex: 1,
                textAlign: 'center',
                color: 'var(--text-soft)',
                fontSize: 13,
              }}
            >
              <input id="photo" type="file" accept="image/*" onChange={handlePhotoChange} />
              <div style={{ marginTop: 8 }}>JPG, PNG (최대 5MB)</div>
            </div>
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="field-mileage">주행거리(km)</label>
            <input
              id="field-mileage"
              className="input"
              type="number"
              value={mileage}
              onChange={(e) => setMileage(e.target.value === '' ? '' : Number(e.target.value))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="field-price">가격(원)</label>
            <input
              id="field-price"
              className="input"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
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
        <div className="field">
          <label htmlFor="field-description">상세설명</label>
          <textarea
            id="field-description"
            className="input"
            rows={5}
            style={{ resize: 'vertical' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit" className="btn-primary">
            {isEdit ? '수정하기' : '등록하기'}
          </button>
        </div>
      </form>
    </div>
  );
}

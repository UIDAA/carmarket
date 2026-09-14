import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { type CarInput, createCar, getCar, resolveImageUrl, updateCar } from '../api/cars';
import { ApiError } from '../api/client';
import Header from '../components/Header';

const emptyForm: CarInput = {
  title: '',
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  mileage: 0,
  price: 0,
  fuelType: '가솔린',
  transmission: '자동',
  region: '',
  description: '',
};

export default function CarFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<CarInput>(emptyForm);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getCar(id).then((car) => {
      setForm({
        title: car.title,
        brand: car.brand,
        model: car.model,
        year: car.year,
        mileage: car.mileage,
        price: car.price,
        fuelType: car.fuel_type,
        transmission: car.transmission,
        region: car.region,
        description: car.description ?? '',
      });
      setExistingImageUrl(car.image_url);
    });
  }, [id]);

  function updateField<K extends keyof CarInput>(key: K, value: CarInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const input = { ...form, photo };
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
            <label htmlFor="field-title">제목</label>
            <input
              id="field-title"
              className="input"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="field-brand">브랜드</label>
            <input
              id="field-brand"
              className="input"
              value={form.brand}
              onChange={(e) => updateField('brand', e.target.value)}
              required
            />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="field-model">모델명</label>
            <input
              id="field-model"
              className="input"
              value={form.model}
              onChange={(e) => updateField('model', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="field-year">연식</label>
            <input
              id="field-year"
              className="input"
              type="number"
              value={form.year}
              onChange={(e) => updateField('year', Number(e.target.value))}
              required
            />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="field-mileage">주행거리(km)</label>
            <input
              id="field-mileage"
              className="input"
              type="number"
              value={form.mileage}
              onChange={(e) => updateField('mileage', Number(e.target.value))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="field-price">가격(원)</label>
            <input
              id="field-price"
              className="input"
              type="number"
              value={form.price}
              onChange={(e) => updateField('price', Number(e.target.value))}
              required
            />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="field-fuelType">연료</label>
            <select
              id="field-fuelType"
              className="input"
              value={form.fuelType}
              onChange={(e) => updateField('fuelType', e.target.value)}
            >
              <option value="가솔린">가솔린</option>
              <option value="디젤">디젤</option>
              <option value="하이브리드">하이브리드</option>
              <option value="전기">전기</option>
              <option value="LPG">LPG</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="field-transmission">변속기</label>
            <select
              id="field-transmission"
              className="input"
              value={form.transmission}
              onChange={(e) => updateField('transmission', e.target.value)}
            >
              <option value="자동">자동</option>
              <option value="수동">수동</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="field-region">지역</label>
          <input
            id="field-region"
            className="input"
            value={form.region}
            onChange={(e) => updateField('region', e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="field-description">상세설명</label>
          <textarea
            id="field-description"
            className="input"
            rows={5}
            style={{ resize: 'vertical' }}
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
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

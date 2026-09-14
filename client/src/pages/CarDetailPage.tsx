import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { type Car, getCar, resolveImageUrl } from '../api/cars';
import { addFavorite, listFavorites, removeFavorite } from '../api/favorites';
import { createOrGetRoom } from '../api/chat';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { formatRegistration } from '../utils/formatRegistration';

export default function CarDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [car, setCar] = useState<Car | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getCar(id)
      .then(setCar)
      .catch(() => setError('매물을 불러오지 못했습니다.'));
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    listFavorites().then((favorites) => setFavorited(favorites.some((car) => String(car.id) === String(id))));
  }, [id, user]);

  async function handleToggleFavorite() {
    if (!id) return;
    if (!user) return navigate('/login');
    if (favorited) {
      await removeFavorite(id);
      setFavorited(false);
    } else {
      await addFavorite(id);
      setFavorited(true);
    }
  }

  async function handleInquire() {
    if (!id) return;
    if (!user) return navigate('/login');
    const room = await createOrGetRoom(id);
    navigate(`/chat/${room.id}`);
  }

  if (error)
    return (
      <div>
        <Header />
        <p role="alert" className="page" style={{ marginTop: 24 }}>
          {error}
        </p>
      </div>
    );
  if (!car)
    return (
      <div>
        <Header />
        <p className="page" style={{ marginTop: 24, color: 'var(--text-soft)' }}>
          불러오는 중...
        </p>
      </div>
    );

  return (
    <div>
      <Header />

      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0', color: 'var(--text-soft)', fontSize: 14 }}>
          <Link to="/" className="nav-link" style={{ color: 'var(--text-soft)' }}>
            ← 목록으로
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 40, paddingBottom: 48, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 420px', maxWidth: '100%' }}>
            {resolveImageUrl(car.image_url) ? (
              <img
                src={resolveImageUrl(car.image_url)!}
                alt={car.title}
                style={{ width: '100%', height: 320, objectFit: 'cover', borderRadius: 'var(--radius)' }}
              />
            ) : (
              <div style={{ width: '100%', height: 320, borderRadius: 'var(--radius)', background: 'var(--muted-soft)' }} />
            )}

            <div style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: 18, marginBottom: 12 }}>상세설명</h2>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>{car.description}</p>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <div className={`status-badge ${car.status}`}>{car.status}</div>
            <h1 style={{ fontSize: 28, margin: '12px 0 6px' }}>{car.title}</h1>
            <div className="display" style={{ fontSize: 30, fontWeight: 700, marginBottom: 20 }}>
              {(car.price / 10000).toLocaleString()}만원
            </div>

            <div className="card" style={{ padding: '4px 20px' }}>
              <div className="spec-row">
                <span style={{ color: 'var(--text-soft)' }}>연식</span>
                <span>{formatRegistration(car)}</span>
              </div>
              <div className="spec-row">
                <span style={{ color: 'var(--text-soft)' }}>주행거리</span>
                <span>{(car.mileage / 10000).toFixed(1)}만km</span>
              </div>
              <div className="spec-row">
                <span style={{ color: 'var(--text-soft)' }}>연료</span>
                <span>{car.fuel_type}</span>
              </div>
              <div className="spec-row">
                <span style={{ color: 'var(--text-soft)' }}>변속기</span>
                <span>{car.transmission}</span>
              </div>
              <div className="spec-row">
                <span style={{ color: 'var(--text-soft)' }}>지역</span>
                <span>{car.region}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-ghost" onClick={handleToggleFavorite}>
                {favorited ? '♥ 찜 취소' : '♡ 찜하기'}
              </button>
              <button className="btn-primary" onClick={handleInquire}>
                문의하기
              </button>
            </div>

            {car.seller_nickname && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 24,
                  padding: 16,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                  {car.seller_nickname.slice(0, 1)}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{car.seller_nickname}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

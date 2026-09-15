import { Link } from 'react-router-dom';
import { resolveImageUrl, type Car } from '../api/cars';
import { formatRegistration } from '../utils/formatRegistration';

interface Props {
  car: Car;
  favorited?: boolean;
  onToggleFavorite?: () => void;
}

export default function CarCard({ car, favorited, onToggleFavorite }: Props) {
  return (
    <div className="card" style={{ position: 'relative' }}>
      <Link to={`/cars/${car.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div style={{ position: 'relative', width: '100%', height: 160, background: 'var(--muted-soft)' }}>
          {resolveImageUrl(car.image_url) && (
            <img
              src={resolveImageUrl(car.image_url)!}
              alt={car.display_title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
          <div className={`status-badge ${car.status}`} style={{ position: 'absolute', top: 12, left: 12 }}>
            {car.status}
          </div>
        </div>
        <div style={{ padding: '14px 16px 18px' }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{car.display_title}</div>
          <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 4 }}>
            {formatRegistration(car)} · {(car.mileage / 10000).toFixed(1)}만km · {car.fuel_type} · {car.region}
          </div>
          <div className="display" style={{ fontWeight: 700, fontSize: 19, marginTop: 8 }}>
            {(car.price / 10000).toLocaleString()}만원
          </div>
        </div>
      </Link>
      {onToggleFavorite && (
        <button className="fav-btn" onClick={onToggleFavorite} aria-label="찜하기">
          {favorited ? '♥' : '♡'}
        </button>
      )}
    </div>
  );
}

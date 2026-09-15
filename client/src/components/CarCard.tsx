import { Link } from 'react-router-dom';
import { resolveImageUrl, type Car } from '../api/cars';
import { formatRegistration } from '../utils/formatRegistration';

interface Props {
  car: Car;
  favorited?: boolean;
  onToggleFavorite?: () => void;
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

export default function CarCard({ car, favorited, onToggleFavorite }: Props) {
  const imageUrl = resolveImageUrl(car.image_url);

  return (
    <div className="card" style={{ position: 'relative' }}>
      <Link to={`/cars/${car.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div className="car-card-media">
          {imageUrl ? (
            <img src={imageUrl} alt={car.display_title} />
          ) : (
            <div className="car-card-media-placeholder">
              <CameraIcon />
              사진 없음
            </div>
          )}
          <div className="car-card-media-scrim" />
          <div className={`status-badge ${car.status}`} style={{ position: 'absolute', top: 12, left: 12 }}>
            {car.status}
          </div>
        </div>
        <div className="car-card-body">
          <div className="car-card-title">{car.display_title}</div>
          <div className="car-card-meta">
            {formatRegistration(car)} · {(car.mileage / 10000).toFixed(1)}만km · {car.fuel_type} · {car.region}
          </div>
          <span className="car-card-price display">{(car.price / 10000).toLocaleString()}만원</span>
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

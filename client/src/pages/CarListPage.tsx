import { type FormEvent, useEffect, useState } from 'react';
import { type Car, type CarFilters, listCars } from '../api/cars';
import { addFavorite, listFavorites, removeFavorite } from '../api/favorites';
import CarCard from '../components/CarCard';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';

export default function CarListPage() {
  const { user } = useAuth();
  const [cars, setCars] = useState<Car[]>([]);
  const [filters, setFilters] = useState<CarFilters>({});
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    listCars(filters)
      .then(setCars)
      .catch(() => setError('매물을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    listFavorites().then((favorites) => setFavoriteIds(new Set(favorites.map((car) => car.id))));
  }, [user]);

  async function handleToggleFavorite(carId: number) {
    if (favoriteIds.has(carId)) {
      await removeFavorite(carId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        next.delete(carId);
        return next;
      });
    } else {
      await addFavorite(carId);
      setFavoriteIds((prev) => new Set(prev).add(carId));
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, keyword }));
  }

  return (
    <div>
      <Header />

      <div className="page" style={{ paddingTop: 28 }}>
        <div
          className="card"
          style={{ padding: '20px 24px', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)' }}
        >
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="차종, 모델명으로 검색"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              검색
            </button>
          </form>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            <select
              className="input"
              style={{ width: 'auto' }}
              onChange={(e) => setFilters((prev) => ({ ...prev, brand: e.target.value || undefined }))}
            >
              <option value="">전체 브랜드</option>
              <option value="현대">현대</option>
              <option value="기아">기아</option>
              <option value="쉐보레">쉐보레</option>
              <option value="르노">르노</option>
            </select>
            <select
              className="input"
              style={{ width: 'auto' }}
              onChange={(e) => setFilters((prev) => ({ ...prev, fuelType: e.target.value || undefined }))}
            >
              <option value="">전체 연료</option>
              <option value="가솔린">가솔린</option>
              <option value="디젤">디젤</option>
              <option value="하이브리드">하이브리드</option>
              <option value="전기">전기</option>
            </select>
            <input
              className="input"
              type="number"
              placeholder="연식(이상)"
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, minYear: e.target.value ? Number(e.target.value) : undefined }))
              }
              style={{ width: 110 }}
            />
            <input
              className="input"
              type="number"
              placeholder="연식(이하)"
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, maxYear: e.target.value ? Number(e.target.value) : undefined }))
              }
              style={{ width: 110 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 4px' }}>
          <div style={{ color: 'var(--text-soft)', fontSize: 14 }}>
            전체 <strong style={{ color: 'var(--text)' }}>{cars.length}</strong>건
          </div>
        </div>

        {loading && <p style={{ color: 'var(--text-soft)' }}>불러오는 중...</p>}
        {error && <p role="alert">{error}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24, paddingBottom: 48 }}>
          {cars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              favorited={favoriteIds.has(car.id)}
              onToggleFavorite={user ? () => handleToggleFavorite(car.id) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

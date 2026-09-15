import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import VehiclePicker, { type VehiclePickerValue } from '../components/VehiclePicker';
import { type Manufacturer, listManufacturers, formatManufacturerLabel } from '../api/catalog';

const RECENT_SEARCHES_KEY = 'carmarket:recentSearches';

interface RecentSearch {
  label: string;
  query: string;
}

function buildQueryString(value: VehiclePickerValue) {
  const params = new URLSearchParams();
  if (value.manufacturerId) params.set('manufacturerId', String(value.manufacturerId));
  if (value.modelGroupId) params.set('modelGroupId', String(value.modelGroupId));
  if (value.modelId) params.set('modelId', String(value.modelId));
  if (value.trimId) params.set('trimId', String(value.trimId));
  if (value.year) {
    params.set('yearFrom', String(value.year));
    params.set('yearTo', String(value.year));
  }
  return params.toString();
}

export default function CarListPage() {
  const navigate = useNavigate();
  const [value, setValue] = useState<VehiclePickerValue>({});
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    listManufacturers().then(setManufacturers);
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed: unknown[] = raw ? JSON.parse(raw) : [];
    // 예전 버전은 라벨 없이 쿼리스트링만 저장했다 — 그 기록을 라벨로 되돌릴 방법이 없으므로
    // (아이디를 이름으로 되짚어줄 facets가 그 시점엔 없었다) raw 쿼리스트링을 그대로 보여주는 대신
    // 버린다. 기록 몇 개가 사라지는 게 사용자에게 원본 id를 보여주는 것보다 낫다.
    const normalized: RecentSearch[] = parsed.filter(
      (entry): entry is RecentSearch =>
        typeof entry === 'object' && entry !== null && 'label' in entry && 'query' in entry
    );
    setRecentSearches(normalized);
    if (normalized.length !== parsed.length) {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(normalized));
    }
  }, []);

  const popular = [...manufacturers].sort((a, b) => b.count - a.count).slice(0, 3);

  function handleSearch() {
    navigate(`/search?${buildQueryString(value)}`);
  }

  return (
    <div>
      <Header />
      <div className="page" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <h1 style={{ fontSize: 24, marginBottom: 24 }}>어떤 차를 찾으세요?</h1>
        <div className="card" style={{ padding: 24 }}>
          <VehiclePicker value={value} onChange={setValue} />
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={handleSearch}>
            검색
          </button>
        </div>

        {popular.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>인기 브랜드</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {popular.map((m) => (
                <button key={m.id} className="chip" onClick={() => navigate(`/search?manufacturerId=${m.id}`)}>
                  {formatManufacturerLabel(m)} ({m.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {recentSearches.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>최근 본 조건</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {recentSearches.map(({ label, query }) => (
                <button key={query} className="chip" onClick={() => navigate(`/search?${query}`)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

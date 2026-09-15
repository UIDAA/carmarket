import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import SearchFilterPanel, { type SearchFilterValue } from '../components/SearchFilterPanel';
import { type Manufacturer, listManufacturers, formatManufacturerLabel } from '../api/catalog';

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

const RECENT_SEARCHES_KEY = 'carmarket:recentSearches';

interface RecentSearch {
  label: string;
  query: string;
}

// SearchFilterValue의 필드명이 실제 검색 쿼리 파라미터명과 그대로 일치하므로 값을 옮겨 담기만 하면 된다.
function buildQueryString(value: SearchFilterValue) {
  const params = new URLSearchParams();
  Object.entries(value).forEach(([key, val]) => {
    if (val !== undefined) params.set(key, String(val));
  });
  return params.toString();
}

export default function CarListPage() {
  const navigate = useNavigate();
  const [value, setValue] = useState<SearchFilterValue>({});
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

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
    setFilterOpen(false);
    navigate(`/search?${buildQueryString(value)}`);
  }

  return (
    <div>
      <Header />
      <div className="page" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <button className="search-entry" onClick={() => setFilterOpen(true)}>
          <SearchIcon />
          <span>어떤 차를 찾고 있나요?</span>
        </button>

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

      {filterOpen && (
        <div className="filter-overlay">
          <div className="filter-overlay-header">
            <button className="filter-overlay-close" onClick={() => setFilterOpen(false)} aria-label="닫기">
              ✕
            </button>
            <strong>검색 조건</strong>
          </div>
          <div className="filter-overlay-body">
            <SearchFilterPanel value={value} onChange={setValue} onSearch={handleSearch} />
          </div>
        </div>
      )}
    </div>
  );
}

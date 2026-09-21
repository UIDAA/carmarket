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

function HeroCarIllustration() {
  return (
    <svg width="220" height="140" viewBox="0 0 220 140" fill="none" aria-hidden="true">
      <ellipse cx="110" cy="122" rx="90" ry="10" fill="rgba(0,0,0,0.15)" />
      <path d="M20 96 L34 60 Q42 46 60 46 L150 46 Q168 46 176 60 L190 96 Z" fill="#ffffff" />
      <path d="M58 50 L70 26 Q74 20 82 20 L128 20 Q136 20 140 26 L152 50 Z" fill="#ffffff" opacity="0.92" />
      <path d="M72 28 L82 26 L82 46 L64 46 Z" fill="#f0813f" opacity="0.5" />
      <path d="M148 28 L138 26 L138 46 L156 46 Z" fill="#f0813f" opacity="0.5" />
      <rect x="20" y="90" width="170" height="10" rx="5" fill="#e8e8e8" />
      <circle cx="58" cy="102" r="16" fill="#2b2b2b" />
      <circle cx="58" cy="102" r="6" fill="#cfcfcf" />
      <circle cx="156" cy="102" r="16" fill="#2b2b2b" />
      <circle cx="156" cy="102" r="6" fill="#cfcfcf" />
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

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <h1 className="hero-title">
              믿을 수 있는
              <br />
              중고차 직거래, 중고차마당
            </h1>
            <p className="hero-sub">
              등록증 자동 인식으로 매물 등록은 더 쉽게,
              <br />
              실시간 채팅으로 거래는 더 빠르게.
            </p>
          </div>
          <div className="hero-art">
            <HeroCarIllustration />
          </div>
        </div>
      </section>

      <div className="search-card">
        <button className="search-entry" onClick={() => setFilterOpen(true)}>
          <SearchIcon />
          <span>어떤 차를 찾고 있나요?</span>
        </button>
      </div>

      <div className="page" style={{ paddingTop: 0, paddingBottom: 60 }}>
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

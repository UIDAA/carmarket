import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import CarCard from '../components/CarCard';
import { type Car, type SearchResult, searchCars } from '../api/cars';
import { addFavorite, listFavorites, removeFavorite } from '../api/favorites';
import { useAuth } from '../context/AuthContext';

const RECENT_SEARCHES_KEY = 'carmarket:recentSearches';
const SORT_LABELS: Record<string, string> = {
  latest: '최신순',
  price_asc: '낮은가격순',
  mileage_asc: '짧은주행거리순',
  year_desc: '연식최신순',
};
const CHIP_LABELS: Record<string, string> = {
  manufacturerId: '브랜드',
  modelGroupId: '모델',
  modelId: '세대',
  trimId: '트림',
  yearFrom: '연식(이상)',
  yearTo: '연식(이하)',
  fuel: '연료',
  priceMin: '최소가격',
  priceMax: '최대가격',
  mileageMin: '최소주행거리',
  mileageMax: '최대주행거리',
  region: '지역',
};

interface RecentSearch {
  label: string;
  query: string;
}

// facets에 이미 이름이 들어있으니(id -> name 조회를 위해 별도 API를 부르지 않고) 그걸로
// 사람이 읽을 라벨을 만든다. 카탈로그 파셋이 없는 값(연료/가격 등)은 원래 필터 값을 그대로 쓴다.
function buildRecentSearchLabel(searchParams: URLSearchParams, facets: SearchResult['facets']): string {
  const parts: string[] = [];

  const manufacturerId = searchParams.get('manufacturerId');
  if (manufacturerId) {
    const found = facets.manufacturers.find((m) => m.id === Number(manufacturerId));
    parts.push(found ? found.name : `브랜드 ${manufacturerId}`);
  }
  const modelGroupId = searchParams.get('modelGroupId');
  if (modelGroupId) {
    const found = facets.modelGroups?.find((g) => g.id === Number(modelGroupId));
    parts.push(found ? found.name : `모델 ${modelGroupId}`);
  }
  const modelId = searchParams.get('modelId');
  if (modelId) {
    const found = facets.models?.find((m) => m.id === Number(modelId));
    parts.push(found ? found.name : `세대 ${modelId}`);
  }
  const trimId = searchParams.get('trimId');
  if (trimId) {
    const found = facets.trims?.find((t) => t.id === Number(trimId));
    parts.push(found ? found.name : `트림 ${trimId}`);
  }
  const fuel = searchParams.get('fuel');
  if (fuel) parts.push(fuel);
  const region = searchParams.get('region');
  if (region) parts.push(region);

  const yearFrom = searchParams.get('yearFrom');
  const yearTo = searchParams.get('yearTo');
  if (yearFrom || yearTo) parts.push(`${yearFrom ?? ''}~${yearTo ?? ''}년식`);

  const priceMin = searchParams.get('priceMin');
  const priceMax = searchParams.get('priceMax');
  if (priceMin || priceMax) {
    const min = priceMin ? `${Number(priceMin) / 10000}만원` : '';
    const max = priceMax ? `${Number(priceMax) / 10000}만원` : '';
    parts.push(`${min}~${max}`);
  }

  return parts.length > 0 ? parts.join(' · ') : '전체 조건';
}

function saveRecentSearch(searchParams: URLSearchParams, facets: SearchResult['facets']) {
  const query = searchParams.toString();
  const label = buildRecentSearchLabel(searchParams, facets);
  const existing: RecentSearch[] = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  const deduped = existing.filter((entry) => entry.query !== query);
  const next = [{ label, query }, ...deduped].slice(0, 5);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

interface Suggestion {
  keys: string[];
  label: string;
  count: number;
}

// 지금 걸려있는 필터 중 자기제외 파셋이 있는 차원(카탈로그 4단계 + 연료/지역/가격/주행거리)만
// 대상으로, "이 조건을 없애면 몇 건이 나오는지"를 이미 받아온 facets로 계산한다(추가 요청 없음).
// 파셋 배열의 각 항목은 이미 그 차원 자신만 제외하고 나머지 필터를 전부 반영한 카운트이므로,
// 배열 전체를 합하면 "그 차원의 필터를 없앴을 때"의 건수가 된다.
function buildFilterSuggestions(searchParams: URLSearchParams, facets: SearchResult['facets']): Suggestion[] {
  const groups: { keys: string[]; label: string; facetArray: { count: number }[] | null | undefined }[] = [
    { keys: ['manufacturerId'], label: '브랜드', facetArray: facets.manufacturers },
    { keys: ['modelGroupId'], label: '모델', facetArray: facets.modelGroups },
    { keys: ['modelId'], label: '세대', facetArray: facets.models },
    { keys: ['trimId'], label: '트림', facetArray: facets.trims },
    { keys: ['fuel'], label: '연료', facetArray: facets.fuel },
    { keys: ['region'], label: '지역', facetArray: facets.region },
    { keys: ['priceMin', 'priceMax'], label: '가격', facetArray: facets.priceBuckets },
    { keys: ['mileageMin', 'mileageMax'], label: '주행거리', facetArray: facets.mileageBuckets },
  ];

  const suggestions: Suggestion[] = [];
  for (const { keys, label, facetArray } of groups) {
    const isActive = keys.some((key) => searchParams.has(key));
    if (!isActive || !facetArray) continue;
    const count = facetArray.reduce((sum, item) => sum + item.count, 0);
    if (count > 0) suggestions.push({ keys, label, count });
  }

  return suggestions.sort((a, b) => b.count - a.count).slice(0, 3);
}

export default function SearchResultsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Car[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<SearchResult['facets'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  const hasConditions = Array.from(searchParams.keys()).some((key) => !['sort', 'page', 'pageSize'].includes(key));
  const page = Number(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'latest';
  const pageSize = 20;

  useEffect(() => {
    if (!hasConditions) {
      setItems([]);
      setTotal(0);
      setFacets(null);
      return;
    }
    setLoading(true);
    const query = Object.fromEntries(searchParams.entries());
    searchCars(query)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setFacets(res.facets);
        saveRecentSearch(searchParams, res.facets);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

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

  function removeKeys(keys: string[]) {
    const next = new URLSearchParams(searchParams);
    for (const key of keys) next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  function handleSortChange(nextSort: string) {
    const next = new URLSearchParams(searchParams);
    next.set('sort', nextSort);
    next.delete('page');
    setSearchParams(next);
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  }

  const chips = Array.from(searchParams.entries()).filter(([key]) => CHIP_LABELS[key]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const yearActive = searchParams.has('yearFrom') || searchParams.has('yearTo');
  const suggestions = !loading && total === 0 && facets ? buildFilterSuggestions(searchParams, facets) : [];

  return (
    <div>
      <Header />
      <div className="page" style={{ paddingTop: 28, paddingBottom: 48 }}>
        <Link to="/" className="nav-link" style={{ color: 'var(--text-soft)' }}>
          ← 조건 다시 선택
        </Link>

        {!hasConditions && <p style={{ marginTop: 40, color: 'var(--text-soft)' }}>검색 조건을 선택해주세요.</p>}

        {hasConditions && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '20px 0' }}>
              {chips.map(([key, val]) => (
                <button key={key} className="chip" onClick={() => removeKeys([key])}>
                  {CHIP_LABELS[key]}: {val} ✕
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: 'var(--text-soft)', fontSize: 14 }}>
                전체 <strong style={{ color: 'var(--text)' }}>{total}</strong>건
              </div>
              <select
                className="input"
                style={{ width: 'auto' }}
                value={sort}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                {Object.entries(SORT_LABELS).map(([sortValue, label]) => (
                  <option key={sortValue} value={sortValue}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {loading && <p style={{ color: 'var(--text-soft)' }}>불러오는 중...</p>}

            {!loading && total === 0 && (
              <div style={{ padding: '32px 0', color: 'var(--text-soft)' }}>
                <p style={{ marginBottom: 12 }}>조건에 맞는 매물이 없습니다.</p>
                {(suggestions.length > 0 || yearActive) && (
                  <>
                    <p style={{ marginBottom: 8, fontSize: 13 }}>이렇게 조건을 풀어보세요:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {suggestions.map((s) => (
                        <button key={s.keys.join(',')} className="chip" onClick={() => removeKeys(s.keys)}>
                          {s.label} 조건 해제 → {s.count}건
                        </button>
                      ))}
                      {yearActive && (
                        <button className="chip" onClick={() => removeKeys(['yearFrom', 'yearTo'])}>
                          연식 조건 해제
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 24,
                padding: '16px 0',
              }}
            >
              {items.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  favorited={favoriteIds.has(car.id)}
                  onToggleFavorite={user ? () => handleToggleFavorite(car.id) : undefined}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
                <button className="btn-ghost" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  이전
                </button>
                <span style={{ padding: '10px 0', color: 'var(--text-soft)' }}>
                  {page} / {totalPages}
                </span>
                <button className="btn-ghost" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

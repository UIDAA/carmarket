import { apiFetch, API_BASE_URL } from './client';

export interface Car {
  id: number;
  seller_id: number;
  seller_nickname?: string;
  trim_id: number;
  title: string;          // 판매자가 나중에 코멘트 등으로 채울 자유 텍스트. 지금은 입력칸이 없어 보통 빈 문자열.
  display_title: string;  // 화면에 보여줄 제목. 서버가 트림 계보 + 최초등록연도로 매번 계산해서 내려준다.
  brand: string;
  model: string;
  first_registered_year: number;
  first_registered_month: number | null;
  model_year: number | null;
  mileage: number;
  price: number;
  fuel_type: string;
  transmission: string;
  region: string;              // 시도 단위
  region_detail: string | null; // 시/군/구까지 있던 예전 값의 보존본(있으면). 새 등록은 항상 null.
  description: string | null;
  image_url: string | null;
  status: '판매중' | '예약중' | '거래완료';
  created_at: string;
}

export interface CarInput {
  title?: string; // 지금은 등록 폼에 입력칸이 없어 보내지 않는다 — 나중에 판매자 코멘트 기능이 쓸 자리
  trimId: number;
  firstRegisteredYear: number;
  firstRegisteredMonth?: number;
  modelYear?: number;
  mileage: number;
  price: number;
  region: string;
  description?: string;
  photo?: File | null;
}

export interface SearchQuery {
  manufacturerId?: number | string;
  modelGroupId?: number | string;
  modelId?: number | string;
  trimId?: number | string;
  yearFrom?: number | string;
  yearTo?: number | string;
  fuel?: string;
  priceMin?: number | string;
  priceMax?: number | string;
  mileageMin?: number | string;
  mileageMax?: number | string;
  region?: string;
  sort?: 'latest' | 'price_asc' | 'mileage_asc' | 'year_desc';
  page?: number | string;
  pageSize?: number | string;
}

export interface FacetBucket {
  label: string;
  min: number;
  max: number | null;
  count: number;
}
export interface FacetValueCount {
  value: string;
  count: number;
}
export interface Facets {
  manufacturers: { id: number; name: string; nameLegacy: string | null; count: number }[];
  modelGroups: { id: number; name: string; count: number }[] | null;
  models: { id: number; name: string; powertrain: string; startYear: number; endYear: number | null; count: number }[] | null;
  trims: { id: number; name: string; fuelType: string; transmission: string; count: number }[] | null;
  fuel: FacetValueCount[];
  region: FacetValueCount[];
  priceBuckets: FacetBucket[];
  mileageBuckets: FacetBucket[];
}

export interface SearchResult {
  items: Car[];
  total: number;
  page: number;
  pageSize: number;
  facets: Facets;
}

export function resolveImageUrl(imageUrl: string | null) {
  if (!imageUrl) return null;
  return `${API_BASE_URL}${imageUrl}`;
}

function buildCarFormData(input: Partial<CarInput & { status: Car['status'] }>) {
  const formData = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'photo') {
      if (value instanceof File) formData.append('photo', value);
      return;
    }
    formData.append(key, String(value));
  });
  return formData;
}

export function searchCars(query: SearchQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return apiFetch<SearchResult>(`/api/cars/search?${params.toString()}`);
}

export function getCar(id: number | string) {
  return apiFetch<Car>(`/api/cars/${id}`);
}

export function getMyCars() {
  return apiFetch<Car[]>('/api/cars/mine');
}

export function createCar(input: CarInput) {
  return apiFetch<Car>('/api/cars', { method: 'POST', body: buildCarFormData(input) });
}

export function updateCar(id: number | string, input: Partial<CarInput & { status: Car['status'] }>) {
  return apiFetch<Car>(`/api/cars/${id}`, { method: 'PUT', body: buildCarFormData(input) });
}

export function deleteCar(id: number | string) {
  return apiFetch<void>(`/api/cars/${id}`, { method: 'DELETE' });
}

import { apiFetch, API_BASE_URL } from './client';

export interface Car {
  id: number;
  seller_id: number;
  seller_nickname?: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  fuel_type: string;
  transmission: string;
  region: string;
  description: string | null;
  image_url: string | null;
  status: '판매중' | '예약중' | '거래완료';
  created_at: string;
}

export interface CarFilters {
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  region?: string;
  fuelType?: string;
  keyword?: string;
}

export interface CarInput {
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  fuelType: string;
  transmission: string;
  region: string;
  description?: string;
  photo?: File | null;
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

export function listCars(filters: CarFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<Car[]>(`/api/cars${query}`);
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

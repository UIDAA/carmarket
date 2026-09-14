import { apiFetch } from './client';
import type { Car } from './cars';

export function listFavorites() {
  return apiFetch<Car[]>('/api/favorites');
}

export function addFavorite(carId: number | string) {
  return apiFetch<{ favorited: boolean }>(`/api/favorites/${carId}`, { method: 'POST' });
}

export function removeFavorite(carId: number | string) {
  return apiFetch<{ favorited: boolean }>(`/api/favorites/${carId}`, { method: 'DELETE' });
}

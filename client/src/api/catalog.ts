import { apiFetch } from './client';

export interface Manufacturer {
  id: number;
  name: string;
  nameLegacy: string | null;
  isDomestic: number;
  count: number;
}
export interface ModelGroup {
  id: number;
  name: string;
  count: number;
}
export interface CatalogModel {
  id: number;
  name: string;
  powertrain: string;
  startYear: number;
  endYear: number | null;
  count: number;
}
export interface YearOption {
  year: number;
  count: number;
}
export interface Trim {
  id: number;
  name: string;
  fuelType: string;
  transmission: string;
  count: number;
}

export function listManufacturers() {
  return apiFetch<Manufacturer[]>('/api/catalog/manufacturers');
}

export function listModelGroups(manufacturerId: number | string) {
  return apiFetch<ModelGroup[]>(`/api/catalog/manufacturers/${manufacturerId}/model-groups`);
}

export function listModels(modelGroupId: number | string) {
  return apiFetch<CatalogModel[]>(`/api/catalog/model-groups/${modelGroupId}/models`);
}

export function listYears(modelId: number | string) {
  return apiFetch<YearOption[]>(`/api/catalog/models/${modelId}/years`);
}

export function listTrims(modelId: number | string, year?: number) {
  const query = year ? `?year=${year}` : '';
  return apiFetch<Trim[]>(`/api/catalog/models/${modelId}/trims${query}`);
}

export function formatManufacturerLabel(m: Pick<Manufacturer, 'name' | 'nameLegacy'>) {
  return m.nameLegacy ? `${m.name}(${m.nameLegacy})` : m.name;
}

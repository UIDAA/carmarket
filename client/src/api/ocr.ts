import { apiFetch } from './client';

export interface OcrCandidate {
  manufacturerId: number;
  modelGroupId: number;
  modelId: number;
  label: string;
}

export interface OcrCatalogMatch {
  confidence: 'strong' | 'ambiguous' | 'not_found';
  manufacturerId?: number;
  modelGroupId?: number;
  modelId?: number;
  candidates?: OcrCandidate[];
}

export interface OcrResult {
  ocrStatus: 'ok' | 'failed';
  reason?:
    | 'not_configured'
    | 'rate_limited'
    | 'network'
    | 'unparseable'
    | 'blurry'
    | 'wrong_document'
    | 'file_too_large';
  firstRegisteredYear?: number;
  firstRegisteredMonth?: number;
  catalogMatch?: OcrCatalogMatch;
  trimHint?: { candidateTrimIds: number[] };
}

export function recognizeRegistration(photo: File) {
  const formData = new FormData();
  formData.append('photo', photo);
  return apiFetch<OcrResult>('/api/cars/ocr', { method: 'POST', body: formData });
}

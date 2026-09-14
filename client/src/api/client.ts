export const UNAUTHORIZED_EVENT = 'carmarket:unauthorized';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const BASE_URL = API_BASE_URL;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(401, data.error || '인증이 만료되었습니다.');
  }
  if (!res.ok) {
    throw new ApiError(res.status, data.error || '요청에 실패했습니다.');
  }
  return data as T;
}

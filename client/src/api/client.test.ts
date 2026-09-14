import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiFetch, ApiError, UNAUTHORIZED_EVENT } from './client';

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('attaches the Authorization header when a token exists', async () => {
    localStorage.setItem('token', 'abc123');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ hello: string }>('/api/ping');

    expect(result.hello).toBe('world');
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer abc123');
  });

  it('throws ApiError with the server message on a non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: '잘못된 요청입니다.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/bad')).rejects.toThrow('잘못된 요청입니다.');
  });

  it('clears the token and dispatches UNAUTHORIZED_EVENT on 401', async () => {
    localStorage.setItem('token', 'expired-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: '유효하지 않은 토큰입니다.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const handler = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, handler);

    await expect(apiFetch('/api/protected')).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem('token')).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

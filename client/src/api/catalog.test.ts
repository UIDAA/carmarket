import { describe, expect, it, vi, beforeEach } from 'vitest';
import { listManufacturers, listTrims } from './catalog';

describe('catalog api client', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }))
    );
  });

  it('calls GET /api/catalog/manufacturers', async () => {
    await listManufacturers();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/catalog/manufacturers'), expect.anything());
  });

  it('appends the year query param when listing trims for a model', async () => {
    await listTrims(7, 2022);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/catalog/models/7/trims?year=2022'),
      expect.anything()
    );
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import CarFormPage from './CarFormPage';
import { AuthProvider } from '../context/AuthContext';
import type { OcrResult } from '../api/ocr';

// VehiclePicker's catalog data comes from real network calls in production; keep it
// harmless (and network-free) for this test by resolving everything to empty lists.
vi.mock('../api/catalog', () => ({
  listManufacturers: vi.fn().mockResolvedValue([]),
  listModelGroups: vi.fn().mockResolvedValue([]),
  listModels: vi.fn().mockResolvedValue([]),
  listYears: vi.fn().mockResolvedValue([]),
  listTrims: vi.fn().mockResolvedValue([]),
  formatManufacturerLabel: (m: { name: string }) => m.name,
}));

const AMBIGUOUS_RESULT: OcrResult = {
  ocrStatus: 'ok',
  catalogMatch: {
    confidence: 'ambiguous',
    candidates: [
      { manufacturerId: 1, modelGroupId: 10, modelId: 100, label: '아반떼 (CN7)' },
      { manufacturerId: 1, modelGroupId: 10, modelId: 101, label: '아반떼 (AD)' },
    ],
  },
};

const NOT_FOUND_RESULT: OcrResult = {
  ocrStatus: 'ok',
  catalogMatch: { confidence: 'not_found' },
};

const FAILED_RESULT: OcrResult = { ocrStatus: 'failed', reason: 'rate_limited' };

// Stub out the real upload widget: we only need to invoke its onResult callback with
// canned OcrResult payloads to reproduce the "second upload after an ambiguous first
// upload" sequence, without wiring up real file input / multipart / fetch plumbing.
vi.mock('../components/RegistrationOcrUpload', () => ({
  default: ({ onResult }: { onResult: (r: OcrResult) => void }) => (
    <div>
      <button type="button" data-testid="fire-ambiguous" onClick={() => onResult(AMBIGUOUS_RESULT)}>
        fire-ambiguous
      </button>
      <button type="button" data-testid="fire-not-found" onClick={() => onResult(NOT_FOUND_RESULT)}>
        fire-not-found
      </button>
      <button type="button" data-testid="fire-failed" onClick={() => onResult(FAILED_RESULT)}>
        fire-failed
      </button>
    </div>
  ),
}));

describe('CarFormPage OCR candidate chip reset (regression)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  function renderPage() {
    act(() => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={['/cars/new']}>
          <AuthProvider>
            <CarFormPage />
          </AuthProvider>
        </MemoryRouter>,
      );
    });
  }

  function click(testId: string) {
    const el = container.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement;
    act(() => {
      el.click();
    });
  }

  it('drops stale candidate chips once a later upload resolves to not_found', () => {
    renderPage();

    click('fire-ambiguous');
    expect(container.textContent).toContain('아반떼 (CN7)');
    expect(container.textContent).toContain('아반떼 (AD)');

    click('fire-not-found');
    expect(container.textContent).not.toContain('아반떼 (CN7)');
    expect(container.textContent).not.toContain('아반떼 (AD)');
    expect(container.textContent).not.toContain('이 중 하나인 것 같아요');
  });

  it('drops stale candidate chips once a later upload fails outright', () => {
    renderPage();

    click('fire-ambiguous');
    expect(container.textContent).toContain('아반떼 (CN7)');

    click('fire-failed');
    expect(container.textContent).not.toContain('아반떼 (CN7)');
    expect(container.textContent).not.toContain('아반떼 (AD)');
  });

  it('does not silently apply a stale candidate after it should have been cleared', () => {
    renderPage();

    click('fire-ambiguous');
    click('fire-not-found');

    // The stale chip must be gone from the DOM entirely (not just hidden) so it cannot
    // be tapped to silently apply photo A's vehicle onto photo B's not_found session.
    const staleChip = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === '아반떼 (CN7)',
    );
    expect(staleChip).toBeUndefined();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResourceEstimator } from '../src/estimator';
import type { BicepResource } from '../src/types';

const CONFIG = { region: 'canadacentral', currency: 'CAD', auditUrl: 'https://example.com' };

function vmResource(): BicepResource {
  return {
    symbolicName: 'vm',
    resourceType: 'Microsoft.Compute/virtualMachines',
    apiVersion: '2024-07-01',
    vmSize: 'Standard_D2s_v3',
    line: 1,
  };
}

function mockPrices(items: Record<string, unknown>[] | null, fail = false): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (fail) {
        throw new TypeError('fetch failed');
      }
      return { ok: true, json: async () => ({ Items: items, NextPageLink: null }) };
    }),
  );
}

const PRICE = {
  armSkuName: 'Standard_D2s_v3',
  serviceName: 'Virtual Machines',
  meterName: 'D2s v3',
  retailPrice: 0.1,
  unitOfMeasure: '1 Hour',
};

describe('ResourceEstimator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns unmapped for resource types with no pricing mapping', async () => {
    const estimator = new ResourceEstimator(CONFIG);
    const outcome = await estimator.estimate({
      ...vmResource(),
      resourceType: 'Microsoft.MadeUp/widgets',
    });
    expect(outcome.kind).toBe('unmapped');
  });

  it('returns unmapped when the resource declares no SKU', async () => {
    const estimator = new ResourceEstimator(CONFIG);
    // Omit vmSize entirely (exactOptionalPropertyTypes rejects explicit undefined).
    const { vmSize: _omitted, ...noSku } = vmResource();
    void _omitted;
    const outcome = await estimator.estimate(noSku);
    expect(outcome.kind).toBe('unmapped');
  });

  it('returns an estimate from live prices', async () => {
    mockPrices([PRICE]);
    const estimator = new ResourceEstimator(CONFIG);
    const outcome = await estimator.estimate(vmResource());
    expect(outcome.kind).toBe('estimate');
    if (outcome.kind === 'estimate') {
      expect(outcome.estimate.low).toBe(73);
      expect(outcome.cached).toBe(false);
      expect(outcome.stale).toBe(false);
    }
  });

  it('serves the second lookup from cache without a network call', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ Items: [PRICE], NextPageLink: null }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const estimator = new ResourceEstimator(CONFIG);
    await estimator.estimate(vmResource());
    const second = await estimator.estimate(vmResource());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.kind).toBe('estimate');
    if (second.kind === 'estimate') {
      expect(second.cached).toBe(true);
    }
  });

  it('returns noPrices when the API has no records for the SKU', async () => {
    mockPrices([]);
    const estimator = new ResourceEstimator(CONFIG);
    const outcome = await estimator.estimate(vmResource());
    expect(outcome.kind).toBe('noPrices');
  });

  it('falls back to stale cache with honest labeling when offline', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ Items: [PRICE], NextPageLink: null }),
        })),
      );
      const estimator = new ResourceEstimator(CONFIG);
      await estimator.estimate(vmResource()); // warms the cache at t=0

      vi.setSystemTime(25 * 60 * 60 * 1000); // 25h later — cache entry is stale
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('fetch failed');
        }),
      );
      const outcome = await estimator.estimate(vmResource());
      expect(outcome.kind).toBe('estimate');
      if (outcome.kind === 'estimate') {
        expect(outcome.cached).toBe(true);
        expect(outcome.stale).toBe(true);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns a plain-language error when offline with no cache', async () => {
    mockPrices(null, true);
    const estimator = new ResourceEstimator(CONFIG);
    const outcome = await estimator.estimate(vmResource());
    expect(outcome.kind).toBe('error');
    if (outcome.kind === 'error') {
      expect(outcome.reason).toContain("Couldn't reach Azure's price list");
    }
  });
});

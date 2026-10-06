import { afterEach, describe, expect, it, vi } from 'vitest';
import { PriceCache } from '../src/cache';
import type { PriceItem } from '../src/types';

const ITEM: PriceItem = {
  armSkuName: 'Standard_D2s_v3',
  serviceName: 'Virtual Machines',
  meterName: 'D2s v3',
  retailPrice: 0.1,
  unitOfMeasure: '1 Hour',
};

describe('PriceCache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns what was stored (fresh)', () => {
    const cache = new PriceCache();
    cache.set('Virtual Machines', 'Standard_D2s_v3', 'canadacentral', 'CAD', [ITEM]);
    const hit = cache.get('Virtual Machines', 'Standard_D2s_v3', 'canadacentral', 'CAD');
    expect(hit).toMatchObject({ stale: false });
    expect(hit?.items).toHaveLength(1);
  });

  it('marks entries stale after the TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const cache = new PriceCache(1000);
    cache.set('Virtual Machines', 'Standard_D2s_v3', 'canadacentral', 'CAD', [ITEM]);
    vi.setSystemTime(2000);
    const hit = cache.get('Virtual Machines', 'Standard_D2s_v3', 'canadacentral', 'CAD');
    expect(hit?.stale).toBe(true);
    expect(hit?.items).toHaveLength(1); // stale entries are still served
  });

  it('returns undefined on a miss', () => {
    const cache = new PriceCache();
    expect(cache.get('Virtual Machines', 'nope', 'canadacentral', 'CAD')).toBeUndefined();
  });

  it('keys are case-insensitive across service/sku/region/currency', () => {
    const cache = new PriceCache();
    cache.set('Virtual Machines', 'Standard_D2s_v3', 'CanadaCentral', 'cad', [ITEM]);
    expect(cache.get('virtual machines', 'standard_d2s_v3', 'canadacentral', 'CAD')).toBeDefined();
  });

  it('clear() empties the cache', () => {
    const cache = new PriceCache();
    cache.set('Virtual Machines', 'Standard_D2s_v3', 'canadacentral', 'CAD', [ITEM]);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

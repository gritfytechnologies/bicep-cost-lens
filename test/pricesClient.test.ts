import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPricesUrl,
  buildSkuPricesUrl,
  fetchPricesForSku,
  fetchRetailPrices,
  PricingError,
} from '../src/pricesClient';

describe('buildPricesUrl', () => {
  it('builds a filtered Retail Prices URL', () => {
    const url = buildPricesUrl('Virtual Machines', 'Standard_D2s_v3', 'canadacentral', 'CAD');
    expect(url.startsWith('https://prices.azure.com/api/retail/prices?')).toBe(true);
    // URLSearchParams encodes spaces as `+`; normalize before asserting.
    const decoded = decodeURIComponent(url).replace(/\+/g, ' ');
    expect(decoded).toContain("serviceName eq 'Virtual Machines'");
    expect(decoded).toContain("armSkuName eq 'Standard_D2s_v3'");
    expect(decoded).toContain("armRegionName eq 'canadacentral'");
    expect(decoded).toContain("priceType eq 'Consumption'");
    expect(decoded).toContain("currencyCode='CAD'");
  });
});

describe('fetchRetailPrices', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns trimmed price items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          Items: [
            {
              armSkuName: 'Standard_D2s_v3',
              serviceName: 'Virtual Machines',
              meterName: 'D2s v3',
              retailPrice: 0.0966,
              unitOfMeasure: '1 Hour',
              extraField: 'ignored',
            },
          ],
          NextPageLink: null,
        }),
      })),
    );
    const items = await fetchRetailPrices('Virtual Machines', 'Standard_D2s_v3', 'canadacentral', 'CAD');
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      armSkuName: 'Standard_D2s_v3',
      serviceName: 'Virtual Machines',
      meterName: 'D2s v3',
      retailPrice: 0.0966,
      unitOfMeasure: '1 Hour',
    });
  });

  it('follows pagination links', async () => {
    const page = (meters: string[], next: string | null) => ({
      ok: true,
      json: async () => ({
        Items: meters.map((meterName) => ({
          armSkuName: 'Standard_D2s_v3',
          serviceName: 'Virtual Machines',
          meterName,
          retailPrice: 0.1,
          unitOfMeasure: '1 Hour',
        })),
        NextPageLink: next,
      }),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(['a'], 'https://prices.azure.com/page2'))
      .mockResolvedValueOnce(page(['b'], null));
    vi.stubGlobal('fetch', fetchMock);
    const items = await fetchRetailPrices('Virtual Machines', 'Standard_D2s_v3', 'canadacentral', 'CAD');
    expect(items.map((i) => i.meterName)).toEqual(['a', 'b']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops malformed records instead of crashing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ Items: [{ nope: true }, null], NextPageLink: null }),
      })),
    );
    const items = await fetchRetailPrices('Virtual Machines', 'Standard_D2s_v3', 'canadacentral', 'CAD');
    expect(items).toEqual([]);
  });

  it('throws a plain-language PricingError on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    await expect(
      fetchRetailPrices('Virtual Machines', 'Standard_D2s_v3', 'canadacentral', 'CAD'),
    ).rejects.toThrow(PricingError);
  });

  it('throws a plain-language PricingError on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    const error = await fetchRetailPrices(
      'Virtual Machines',
      'Standard_D2s_v3',
      'canadacentral',
      'CAD',
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PricingError);
    expect((error as Error).message).toContain("Couldn't reach Azure's price list");
  });
});

describe('buildSkuPricesUrl', () => {
  it('can filter on the catalog skuName field', () => {
    const url = buildSkuPricesUrl('Storage', 'skuName', 'Standard LRS', 'canadacentral', 'CAD');
    const decoded = decodeURIComponent(url).replace(/\+/g, ' ');
    expect(decoded).toContain("serviceName eq 'Storage'");
    expect(decoded).toContain("skuName eq 'Standard LRS'");
    expect(decoded).toContain("armRegionName eq 'canadacentral'");
  });
});

/** Fetch mock that answers from the decoded `$filter` of each request URL. */
function filterDrivenFetch(
  handler: (filter: string) => Record<string, unknown>[],
): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string) => {
    const filter = decodeURIComponent(new URL(url).searchParams.get('$filter') ?? '').replace(
      /\+/g,
      ' ',
    );
    return { ok: true, json: async () => ({ Items: handler(filter), NextPageLink: null }) };
  });
}

describe('fetchPricesForSku', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the armSkuName path when it resolves (virtual machines)', async () => {
    const fetchMock = filterDrivenFetch((filter) =>
      filter.includes("armSkuName eq 'Standard_D2s_v3'")
        ? [
            {
              armSkuName: 'Standard_D2s_v3',
              serviceName: 'Virtual Machines',
              meterName: 'D2s v3',
              retailPrice: 0.25,
              unitOfMeasure: '1 Hour',
            },
          ]
        : [],
    );
    vi.stubGlobal('fetch', fetchMock);
    const items = await fetchPricesForSku(
      'Virtual Machines',
      'Standard_D2s_v3',
      'canadacentral',
      'CAD',
    );
    expect(items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the spaced catalog skuName (storage Standard_LRS)', async () => {
    // Shape recorded from the live catalog: storage records carry an empty
    // armSkuName; the SKU lives in skuName with spaces, not underscores.
    const fetchMock = filterDrivenFetch((filter) =>
      filter.includes("skuName eq 'Standard LRS'")
        ? [
            {
              armSkuName: '',
              skuName: 'Standard LRS',
              serviceName: 'Storage',
              meterName: 'LRS Data Stored',
              retailPrice: 0.05,
              unitOfMeasure: '1 GB/Month',
            },
          ]
        : [],
    );
    vi.stubGlobal('fetch', fetchMock);
    const items = await fetchPricesForSku('Storage', 'Standard_LRS', 'canadacentral', 'CAD');
    expect(items).toHaveLength(1);
    expect(items[0]?.meterName).toBe('LRS Data Stored');
    // armSkuName attempts (both variants) and skuName underscore came first.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('returns empty when no variant resolves anywhere', async () => {
    const fetchMock = filterDrivenFetch(() => []);
    vi.stubGlobal('fetch', fetchMock);
    const items = await fetchPricesForSku('Azure App Service', 'P1v3', 'canadacentral', 'CAD');
    expect(items).toEqual([]);
  });

  it('aborts on network failure instead of trying every variant', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      fetchPricesForSku('Storage', 'Standard_LRS', 'canadacentral', 'CAD'),
    ).rejects.toThrow(PricingError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

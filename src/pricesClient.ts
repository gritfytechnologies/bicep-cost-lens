/**
 * Thin client for the Azure Retail Prices API (https://prices.azure.com).
 * No API key needed — the API is public and anonymous.
 */
import { skuCandidates } from './priceMap';
import type { PriceItem } from './types';

const API_BASE = 'https://prices.azure.com/api/retail/prices';
const MAX_PAGES = 5;
const REQUEST_TIMEOUT_MS = 15000;

/** Plain-language error for anything that goes wrong talking to the API. */
export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

interface RetailPriceRecord {
  armSkuName?: string;
  serviceName?: string;
  meterName?: string;
  retailPrice?: number;
  unitOfMeasure?: string;
}

interface RetailPricePage {
  Items?: RetailPriceRecord[];
  NextPageLink?: string | null;
}

/** Which catalog name field a lookup filters on. */
export type SkuNameField = 'armSkuName' | 'skuName';

/** Build the request URL for one name-field lookup. Exported for unit tests. */
export function buildSkuPricesUrl(
  serviceName: string,
  field: SkuNameField,
  skuValue: string,
  region: string,
  currency: string,
): string {
  const filter = [
    `serviceName eq '${serviceName}'`,
    `${field} eq '${skuValue}'`,
    `armRegionName eq '${region}'`,
    `priceType eq 'Consumption'`,
  ].join(' and ');
  const params = new URLSearchParams({
    $filter: filter,
    currencyCode: `'${currency}'`,
  });
  return `${API_BASE}?${params.toString()}`;
}

/** Build the request URL for one SKU lookup. Exported for unit tests. */
export function buildPricesUrl(
  serviceName: string,
  armSkuName: string,
  region: string,
  currency: string,
): string {
  return buildSkuPricesUrl(serviceName, 'armSkuName', armSkuName, region, currency);
}

function toPriceItem(record: RetailPriceRecord): PriceItem | undefined {
  if (!record || typeof record !== 'object') {
    return undefined;
  }
  if (
    typeof record.retailPrice !== 'number' ||
    typeof record.unitOfMeasure !== 'string' ||
    typeof record.armSkuName !== 'string' ||
    typeof record.serviceName !== 'string' ||
    typeof record.meterName !== 'string'
  ) {
    return undefined;
  }
  return {
    armSkuName: record.armSkuName,
    serviceName: record.serviceName,
    meterName: record.meterName,
    retailPrice: record.retailPrice,
    unitOfMeasure: record.unitOfMeasure,
  };
}

async function fetchPage(url: string): Promise<RetailPricePage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new PricingError(
        `Azure's price list answered with HTTP ${response.status}. ` +
          'The estimate cannot be computed right now — try again in a bit.',
      );
    }
    return (await response.json()) as RetailPricePage;
  } catch (error) {
    if (error instanceof PricingError) {
      throw error;
    }
    throw new PricingError(
      "Couldn't reach Azure's price list — check your connection and try again. " +
        'Cached prices (if any) are still used where available.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Follow pagination (bounded) from a start URL and collect trimmed items. */
async function fetchAllPages(startUrl: string): Promise<PriceItem[]> {
  const items: PriceItem[] = [];
  let url: string | null | undefined = startUrl;

  for (let page = 0; page < MAX_PAGES && url; page++) {
    const data = await fetchPage(url);
    for (const record of data.Items ?? []) {
      const item = toPriceItem(record);
      if (item) {
        items.push(item);
      }
    }
    url = data.NextPageLink;
  }
  return items;
}

/**
 * Fetch retail price records for one ARM SKU name. Follows pagination
 * (bounded). Throws PricingError with a plain-language message on failure.
 */
export async function fetchRetailPrices(
  serviceName: string,
  armSkuName: string,
  region: string,
  currency: string,
): Promise<PriceItem[]> {
  return fetchAllPages(buildPricesUrl(serviceName, armSkuName, region, currency));
}

/**
 * Fetch retail prices for a SKU as declared in Bicep, trying the name
 * variants (`skuCandidates`) against both catalog name fields.
 *
 * The catalog is inconsistent: VM sizes key on `armSkuName`
 * (`Standard_D2s_v3`), while storage accounts carry an empty `armSkuName`
 * and the SKU only in `skuName` (`Standard LRS` — verified against the live
 * catalog in `canadacentral`, where the ARM-style underscore form matches
 * nothing). So try each variant on `armSkuName` first (the exact, proven
 * path), then on `skuName`; the first attempt with records wins. A network
 * or HTTP failure aborts immediately — variants don't mask an outage.
 */
export async function fetchPricesForSku(
  serviceName: string,
  declaredSku: string,
  region: string,
  currency: string,
): Promise<PriceItem[]> {
  const variants = skuCandidates(declaredSku);
  const attempts: [SkuNameField, string][] = [];
  for (const field of ['armSkuName', 'skuName'] as const) {
    for (const value of variants) {
      attempts.push([field, value]);
    }
  }

  for (const [field, value] of attempts) {
    const items = await fetchAllPages(
      buildSkuPricesUrl(serviceName, field, value, region, currency),
    );
    if (items.length > 0) {
      return items;
    }
  }
  return [];
}

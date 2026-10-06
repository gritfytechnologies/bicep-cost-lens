/**
 * Thin client for the Azure Retail Prices API (https://prices.azure.com).
 * No API key needed — the API is public and anonymous.
 */
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

/** Build the request URL for one SKU lookup. Exported for unit tests. */
export function buildPricesUrl(
  serviceName: string,
  armSkuName: string,
  region: string,
  currency: string,
): string {
  const filter = [
    `serviceName eq '${serviceName}'`,
    `armSkuName eq '${armSkuName}'`,
    `armRegionName eq '${region}'`,
    `priceType eq 'Consumption'`,
  ].join(' and ');
  const params = new URLSearchParams({
    $filter: filter,
    currencyCode: `'${currency}'`,
  });
  return `${API_BASE}?${params.toString()}`;
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

/**
 * Fetch retail price records for one SKU. Follows pagination (bounded).
 * Throws PricingError with a plain-language message on any failure.
 */
export async function fetchRetailPrices(
  serviceName: string,
  armSkuName: string,
  region: string,
  currency: string,
): Promise<PriceItem[]> {
  const items: PriceItem[] = [];
  let url: string | null | undefined = buildPricesUrl(serviceName, armSkuName, region, currency);

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

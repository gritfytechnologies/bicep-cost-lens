/**
 * Orchestrates one resource → cost estimate lookup:
 * mapping → SKU resolution → cache → Retail Prices API → monthly range.
 *
 * All failures degrade to a human-readable outcome — never a throw.
 */
import { PriceCache } from './cache';
import { estimateMonthly } from './costEstimator';
import { fetchRetailPrices, PricingError } from './pricesClient';
import { findPricingMapping, resolveSkuName } from './priceMap';
import type { BicepResource, CostEstimate, CostLensConfig } from './types';

export type EstimateOutcome =
  | { kind: 'estimate'; estimate: CostEstimate; cached: boolean; stale: boolean }
  | { kind: 'unmapped'; reason: string }
  | { kind: 'noPrices'; reason: string }
  | { kind: 'error'; reason: string };

const ISSUE_LINK =
  'https://github.com/gritfytechnologies/bicep-cost-lens/issues';

export class ResourceEstimator {
  private readonly cache = new PriceCache();

  constructor(private readonly config: CostLensConfig) {}

  async estimate(resource: BicepResource): Promise<EstimateOutcome> {
    const mapping = findPricingMapping(resource.resourceType);
    if (!mapping) {
      return {
        kind: 'unmapped',
        reason:
          `No pricing data is mapped for \`${resource.resourceType}\` yet. ` +
          `If you'd like it covered, [open an issue](${ISSUE_LINK}).`,
      };
    }

    const skuName = resolveSkuName(resource, mapping);
    if (!skuName) {
      return {
        kind: 'unmapped',
        reason:
          `The \`${resource.symbolicName}\` resource doesn't declare a SKU or VM size, ` +
          'so there is nothing to look up. Add a `sku` or `vmSize` to get an estimate.',
      };
    }

    const { serviceName } = mapping;
    const { region, currency } = this.config;

    const cached = this.cache.get(serviceName, skuName, region, currency);
    if (cached && !cached.stale) {
      const estimate = estimateMonthly(cached.items, currency);
      if (estimate) {
        return { kind: 'estimate', estimate, cached: true, stale: false };
      }
    }

    try {
      const items = await fetchRetailPrices(serviceName, skuName, region, currency);
      this.cache.set(serviceName, skuName, region, currency, items);
      const estimate = estimateMonthly(items, currency);
      if (!estimate) {
        return {
          kind: 'noPrices',
          reason:
            `Azure's price list has no \`${skuName}\` entries for ${region}. ` +
            'The SKU name may differ from the Retail Prices catalog — check the SKU spelling.',
        };
      }
      return { kind: 'estimate', estimate, cached: false, stale: false };
    } catch (error) {
      if (cached) {
        // Offline but we have something: serve it honestly labeled.
        const estimate = estimateMonthly(cached.items, currency);
        if (estimate) {
          return { kind: 'estimate', estimate, cached: true, stale: true };
        }
      }
      const reason =
        error instanceof PricingError
          ? error.message
          : 'Something went wrong looking up the price — please try again.';
      return { kind: 'error', reason };
    }
  }
}

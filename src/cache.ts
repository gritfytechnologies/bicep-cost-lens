/**
 * Tiny in-memory TTL cache for price lookups.
 *
 * Offline-first: when the network is unavailable, stale entries are served
 * with a flag so the UI can label them honestly ("last checked …").
 */
import type { PriceItem } from './types';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  items: PriceItem[];
  fetchedAt: number;
}

export interface CachedPrices {
  items: PriceItem[];
  /** True when the entry is past TTL but is the best we have (offline). */
  stale: boolean;
}

export class PriceCache {
  private entries = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  static key(serviceName: string, armSkuName: string, region: string, currency: string): string {
    return [serviceName, armSkuName, region, currency].join('|').toLowerCase();
  }

  get(
    serviceName: string,
    armSkuName: string,
    region: string,
    currency: string,
  ): CachedPrices | undefined {
    const entry = this.entries.get(PriceCache.key(serviceName, armSkuName, region, currency));
    if (!entry) {
      return undefined;
    }
    const stale = Date.now() - entry.fetchedAt > this.ttlMs;
    return { items: entry.items, stale };
  }

  set(
    serviceName: string,
    armSkuName: string,
    region: string,
    currency: string,
    items: PriceItem[],
  ): void {
    this.entries.set(PriceCache.key(serviceName, armSkuName, region, currency), {
      items,
      fetchedAt: Date.now(),
    });
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

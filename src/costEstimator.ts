/**
 * Turns raw retail price records into a monthly cost range.
 * Pure functions — no VS Code dependency, fully unit-tested.
 */
import type { CostEstimate, PriceItem } from './types';

const HOURS_PER_MONTH = 730;

function isHourlyMeter(item: PriceItem): boolean {
  return /hour/i.test(item.unitOfMeasure);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Build a directional monthly estimate from price records.
 * Hourly meters are scaled to a full month (730 h); non-hourly meters
 * (per-GB, per-transaction, …) can't be scaled without usage data, so they
 * produce an "usage-based" estimate with the unit price as the low end.
 */
export function estimateMonthly(items: PriceItem[], currency: string): CostEstimate | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const hourly = items.filter(isHourlyMeter);
  if (hourly.length > 0) {
    const monthly = hourly.map((item) => item.retailPrice * HOURS_PER_MONTH);
    return {
      low: round2(Math.min(...monthly)),
      high: round2(Math.max(...monthly)),
      currency,
      basis: '730 hrs/month × unit price',
      meterCount: hourly.length,
    };
  }

  // No hourly meter: report the unit-price spread and label it usage-based.
  const unitPrices = items.map((item) => item.retailPrice);
  const unit = items[0]?.unitOfMeasure ?? 'unit';
  return {
    low: round2(Math.min(...unitPrices)),
    high: round2(Math.max(...unitPrices)),
    currency,
    basis: `per ${unit} — usage-based, can't be scaled without usage data`,
    meterCount: items.length,
  };
}

/** Format a money value with its currency code, e.g. `CAD 123.45`. */
export function formatMoney(value: number, currency: string): string {
  return `${currency} ${value.toFixed(2)}`;
}

/** Format an estimate range, collapsing when low == high. */
export function formatRange(estimate: CostEstimate): string {
  if (estimate.low === estimate.high) {
    return formatMoney(estimate.low, estimate.currency);
  }
  return `${formatMoney(estimate.low, estimate.currency)} – ${formatMoney(estimate.high, estimate.currency)}`;
}

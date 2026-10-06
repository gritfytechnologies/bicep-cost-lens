import { describe, expect, it } from 'vitest';
import { estimateMonthly, formatMoney, formatRange } from '../src/costEstimator';
import type { PriceItem } from '../src/types';

function hourly(price: number, meter = 'D2s v3'): PriceItem {
  return {
    armSkuName: 'Standard_D2s_v3',
    serviceName: 'Virtual Machines',
    meterName: meter,
    retailPrice: price,
    unitOfMeasure: '1 Hour',
  };
}

describe('estimateMonthly', () => {
  it('scales hourly meters to a 730-hour month', () => {
    const estimate = estimateMonthly([hourly(0.1)], 'CAD');
    expect(estimate).toMatchObject({ low: 73, high: 73, currency: 'CAD', meterCount: 1 });
    expect(estimate?.basis).toContain('730 hrs/month');
  });

  it('builds a range across multiple hourly meters', () => {
    const estimate = estimateMonthly([hourly(0.1, 'a'), hourly(0.2, 'b'), hourly(0.15, 'c')], 'USD');
    expect(estimate?.low).toBe(73);
    expect(estimate?.high).toBe(146);
  });

  it('rounds to cents', () => {
    const estimate = estimateMonthly([hourly(0.0966)], 'CAD');
    expect(estimate?.low).toBe(70.52);
  });

  it('labels non-hourly meters as usage-based without scaling', () => {
    const items: PriceItem[] = [
      {
        armSkuName: 'Standard_LRS',
        serviceName: 'Storage',
        meterName: 'Hot LRS Data Stored',
        retailPrice: 0.022,
        unitOfMeasure: '1 GB/Month',
      },
    ];
    const estimate = estimateMonthly(items, 'CAD');
    expect(estimate?.low).toBe(0.02);
    expect(estimate?.high).toBe(0.02);
    expect(estimate?.basis).toContain("can't be scaled without usage data");
  });

  it('returns undefined for empty input', () => {
    expect(estimateMonthly([], 'CAD')).toBeUndefined();
  });
});

describe('formatMoney / formatRange', () => {
  it('formats with currency code and two decimals', () => {
    expect(formatMoney(73, 'CAD')).toBe('CAD 73.00');
  });

  it('collapses equal low/high into a single value', () => {
    expect(formatRange({ low: 73, high: 73, currency: 'CAD', basis: '', meterCount: 1 })).toBe(
      'CAD 73.00',
    );
  });

  it('renders a range with an en dash', () => {
    expect(formatRange({ low: 73, high: 146, currency: 'CAD', basis: '', meterCount: 2 })).toBe(
      'CAD 73.00 – CAD 146.00',
    );
  });
});

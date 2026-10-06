import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseArgs,
  buildReport,
  renderMarkdown,
  renderJson,
  shortNote,
  type CostReport,
} from '../src/cli';
import type { CostLensConfig } from '../src/types';

const CONFIG: CostLensConfig = { region: 'canadacentral', currency: 'CAD', auditUrl: '' };

function mockPrices(items: Record<string, unknown>[] | null): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ Items: items, NextPageLink: null }) })),
  );
}

const PRICE = {
  armSkuName: 'Standard_D2s_v3',
  serviceName: 'Virtual Machines',
  meterName: 'D2s v3',
  retailPrice: 0.1,
  unitOfMeasure: '1 Hour',
};

const BICEP = `resource vm 'Microsoft.Compute/virtualMachines@2024-07-01' = {
  name: 'demo-vm'
  location: 'canadacentral'
  properties: {
    hardwareProfile: { vmSize: 'Standard_D2s_v3' }
  }
}
`;

describe('parseArgs', () => {
  it('applies defaults', () => {
    expect(parseArgs(['main.bicep'])).toEqual({
      file: 'main.bicep',
      currency: 'CAD',
      region: 'canadacentral',
      format: 'markdown',
    });
  });

  it('parses all options', () => {
    const opts = parseArgs([
      '--budget',
      '500',
      '--currency',
      'usd',
      '--region',
      'eastus',
      '--format',
      'json',
      'infra/main.bicep',
    ]);
    expect(opts).toEqual({
      file: 'infra/main.bicep',
      budget: 500,
      currency: 'USD',
      region: 'eastus',
      format: 'json',
    });
  });

  it('rejects unknown options, bad budget, bad format, missing file', () => {
    expect(() => parseArgs(['--nope', 'f.bicep'])).toThrow("Unknown option '--nope'");
    expect(() => parseArgs(['--budget', 'abc', 'f.bicep'])).toThrow('--budget');
    expect(() => parseArgs(['--budget', '-5', 'f.bicep'])).toThrow('--budget');
    expect(() => parseArgs(['--format', 'yaml', 'f.bicep'])).toThrow('--format');
    expect(() => parseArgs([])).toThrow('exactly one');
    expect(() => parseArgs(['a.bicep', 'b.bicep'])).toThrow('exactly one');
  });
});

describe('buildReport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prices resources and totals the range', async () => {
    mockPrices([PRICE]);
    const report = await buildReport('main.bicep', BICEP, CONFIG);
    expect(report.resources).toHaveLength(1);
    expect(report.resources[0]?.priced).toBe(true);
    // 0.10/hr × 730h = $73.00
    expect(report.totalLow).toBe(73);
    expect(report.totalHigh).toBe(73);
    expect(report.overBudget).toBe(false);
  });

  it('flags over-budget when the high end exceeds the budget', async () => {
    mockPrices([PRICE]);
    const report = await buildReport('main.bicep', BICEP, CONFIG, 50);
    expect(report.overBudget).toBe(true);
    expect(report.budget).toBe(50);
  });

  it('stays under budget when the high end fits', async () => {
    mockPrices([PRICE]);
    const report = await buildReport('main.bicep', BICEP, CONFIG, 500);
    expect(report.overBudget).toBe(false);
  });

  it('marks unmapped resources without failing the report', async () => {
    mockPrices([PRICE]);
    const report = await buildReport('x.bicep', `resource w 'Microsoft.MadeUp/widgets@2024-01-01' = {}`, CONFIG);
    expect(report.resources[0]?.priced).toBe(false);
    expect(report.unpricedCount).toBe(1);
    expect(report.totalHigh).toBe(0);
  });

  it('handles a file with no resources', async () => {
    mockPrices([PRICE]);
    const report = await buildReport('empty.bicep', '// nothing here', CONFIG);
    expect(report.resources).toHaveLength(0);
    expect(report.overBudget).toBe(false);
  });
});

function sampleReport(): CostReport {
  return {
    file: 'main.bicep',
    currency: 'CAD',
    region: 'canadacentral',
    resources: [
      {
        symbolicName: 'vm',
        resourceType: 'Microsoft.Compute/virtualMachines',
        cost: '$73.00 – $81.50 CAD',
        low: 73,
        high: 81.5,
        priced: true,
        note: '',
      },
    ],
    totalLow: 73,
    totalHigh: 81.5,
    budget: 500,
    overBudget: false,
    unpricedCount: 0,
  };
}

describe('shortNote', () => {
  it('maps each outcome kind to a table-safe note', () => {
    expect(shortNote({ kind: 'unmapped', reason: 'No pricing data is mapped for `x` yet.' })).toBe(
      'type not mapped yet',
    );
    expect(shortNote({ kind: 'unmapped', reason: "The `vm` resource doesn't declare a SKU." })).toBe(
      'no SKU/size declared',
    );
    expect(shortNote({ kind: 'noPrices', reason: 'nothing' })).toBe('no prices for SKU in region');
    expect(shortNote({ kind: 'error', reason: 'boom' })).toBe('price lookup failed');
  });
});

describe('renderers', () => {
  it('renders markdown with table, total, and budget verdict', () => {
    const md = renderMarkdown(sampleReport());
    expect(md).toContain('## 💰 Bicep Cost Lens');
    expect(md).toContain('| `vm` | `Microsoft.Compute/virtualMachines` |');
    expect(md).toContain('**$73.00 – $81.50 CAD**');
    expect(md).toContain('✅ under budget');
    expect(md).toContain('Directional estimate');
  });

  it('renders the over-budget verdict', () => {
    const md = renderMarkdown({ ...sampleReport(), budget: 50, overBudget: true });
    expect(md).toContain('❌ OVER budget');
  });

  it('notes unpriced resources', () => {
    const md = renderMarkdown({ ...sampleReport(), unpricedCount: 2 });
    expect(md).toContain('2 resource(s) could not be priced');
  });

  it('renders valid JSON', () => {
    const parsed = JSON.parse(renderJson(sampleReport()));
    expect(parsed.totalHigh).toBe(81.5);
    expect(parsed.resources[0]?.symbolicName).toBe('vm');
  });
});

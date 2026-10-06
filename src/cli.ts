/**
 * bicep-cost-lens CLI — cost gate for CI/CD pipelines.
 * (The #!/usr/bin/env node shebang is injected by esbuild at bundle time.)
 *
 *   node dist/cli.js [options] <file.bicep>
 *
 * Options:
 *   --budget <n>        Monthly budget in the configured currency. Exits 2 when
 *                       the estimated total exceeds it (pipeline gate).
 *   --currency <code>   ISO currency code (default: CAD).
 *   --region <name>     Azure region for price lookups (default: canadacentral).
 *   --format <fmt>      `markdown` (default) or `json`.
 *   --help              Print usage.
 *
 * Exit codes: 0 = under budget (or no budget set), 1 = usage/IO error,
 *             2 = over budget.
 *
 * Same engine as the VS Code extension — parser, price map, Retail Prices API,
 * estimator. Zero runtime dependencies; needs Node 18+ (global fetch) and
 * network access to prices.azure.com.
 */
import { readFileSync } from 'node:fs';
import { parseBicepResources } from './parser';
import { ResourceEstimator, type EstimateOutcome } from './estimator';
import { formatRange } from './costEstimator';
import type { BicepResource, CostLensConfig } from './types';

export interface CliOptions {
  file: string;
  budget?: number;
  currency: string;
  region: string;
  format: 'markdown' | 'json';
}

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_OVER_BUDGET = 2;

const USAGE = `bicep-cost-lens — directional cost gate for Bicep files.

Usage: bicep-cost-lens [options] <file.bicep>

Options:
  --budget <n>       Monthly budget in the configured currency.
                     Exits 2 when the estimate exceeds it (pipeline gate).
  --currency <code>  ISO currency code (default: CAD).
  --region <name>    Azure region for price lookups (default: canadacentral).
  --format <fmt>     markdown (default) or json.
  --help             Print this help.

Exit codes: 0 under budget · 1 usage/IO error · 2 over budget.

Example:
  bicep-cost-lens --budget 500 --currency CAD infra/main.bicep`;

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { file: '', currency: 'CAD', region: 'canadacentral', format: 'markdown' };
  const rest: string[] = [];

  // Reads the flag value at argv[i], throwing a usage error when missing.
  const take = (i: number, flag: string, example: string): string => {
    const value = argv[i];
    if (!value) {
      throw new Error(`${flag} needs a value, e.g. ${example}.`);
    }
    return value;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) {
      break;
    }
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(EXIT_OK);
    } else if (arg === '--budget') {
      const value = Number(take(i + 1, '--budget', '500'));
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('--budget needs a non-negative number.');
      }
      opts.budget = value;
      i++;
    } else if (arg === '--currency') {
      opts.currency = take(i + 1, '--currency', 'CAD').toUpperCase();
      i++;
    } else if (arg === '--region') {
      opts.region = take(i + 1, '--region', 'canadacentral');
      i++;
    } else if (arg === '--format') {
      const value = take(i + 1, '--format', 'markdown');
      if (value !== 'markdown' && value !== 'json') {
        throw new Error("--format must be 'markdown' or 'json'.");
      }
      opts.format = value;
      i++;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option '${arg}'. See --help.`);
    } else {
      rest.push(arg);
    }
  }
  if (rest.length !== 1) {
    throw new Error('Provide exactly one .bicep file. See --help.');
  }
  const file = rest[0];
  if (!file) {
    throw new Error('Provide exactly one .bicep file. See --help.');
  }
  opts.file = file;
  return opts;
}

export interface ResourceRow {
  symbolicName: string;
  resourceType: string;
  cost: string;
  low: number;
  high: number;
  priced: boolean;
  note: string;
}

export interface CostReport {
  file: string;
  currency: string;
  region: string;
  resources: ResourceRow[];
  totalLow: number;
  totalHigh: number;
  budget?: number;
  overBudget: boolean;
  unpricedCount: number;
}

/** One-line, table-safe note for an unpriced resource. */
export function shortNote(outcome: EstimateOutcome): string {
  if (outcome.kind === 'unmapped') {
    return outcome.reason.includes('No pricing data is mapped')
      ? 'type not mapped yet'
      : 'no SKU/size declared';
  }
  if (outcome.kind === 'noPrices') {
    return 'no prices for SKU in region';
  }
  return 'price lookup failed';
}

export async function buildReport(
  file: string,
  text: string,
  config: CostLensConfig,
  budget?: number,
): Promise<CostReport> {
  const estimator = new ResourceEstimator(config);
  const parsed: BicepResource[] = parseBicepResources(text);
  const resources: ResourceRow[] = [];
  let totalLow = 0;
  let totalHigh = 0;
  let unpricedCount = 0;

  for (const resource of parsed) {
    const outcome: EstimateOutcome = await estimator.estimate(resource);
    if (outcome.kind === 'estimate') {
      const { estimate } = outcome;
      totalLow += estimate.low;
      totalHigh += estimate.high;
      resources.push({
        symbolicName: resource.symbolicName,
        resourceType: resource.resourceType,
        cost: formatRange(estimate),
        low: estimate.low,
        high: estimate.high,
        priced: true,
        note: outcome.cached ? 'cached prices' : '',
      });
    } else {
      unpricedCount++;
      resources.push({
        symbolicName: resource.symbolicName,
        resourceType: resource.resourceType,
        cost: '—',
        low: 0,
        high: 0,
        priced: false,
        note: shortNote(outcome),
      });
    }
  }

  return {
    file,
    currency: config.currency,
    region: config.region,
    resources,
    totalLow,
    totalHigh,
    overBudget: budget !== undefined && totalHigh > budget,
    unpricedCount,
    ...(budget !== undefined ? { budget } : {}),
  };
}

export function renderMarkdown(report: CostReport): string {
  const lines: string[] = [];
  lines.push(`## 💰 Bicep Cost Lens — \`${report.file}\``);
  lines.push('');
  lines.push('| Resource | Type | Estimated monthly cost |');
  lines.push('|---|---|---|');
  for (const row of report.resources) {
    const cost = row.priced ? `**${row.cost}**` : `— *${row.note}*`;
    lines.push(`| \`${row.symbolicName}\` | \`${row.resourceType}\` | ${cost} |`);
  }
  lines.push('');
  const total = `**$${report.totalLow.toFixed(2)} – $${report.totalHigh.toFixed(2)} ${report.currency}**`;
  lines.push(`**Total (directional):** ${total}`);
  if (report.budget !== undefined) {
    const verdict = report.overBudget ? '❌ OVER budget' : '✅ under budget';
    lines.push(`**Budget:** $${report.budget.toFixed(2)} ${report.currency} → ${verdict}`);
  }
  if (report.unpricedCount > 0) {
    lines.push('');
    lines.push(
      `_${report.unpricedCount} resource(s) could not be priced — see notes above. ` +
        'Totals cover priced resources only._',
    );
  }
  lines.push('');
  lines.push(
    '_Directional estimate — list prices only, no EA/MCA discounts, reservations, or hybrid benefit._',
  );
  return lines.join('\n');
}

export function renderJson(report: CostReport): string {
  return JSON.stringify(report, null, 2);
}

async function main(): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    console.error('');
    console.error(USAGE);
    return EXIT_USAGE;
  }

  let text: string;
  try {
    text = readFileSync(opts.file, 'utf8');
  } catch {
    console.error(`error: cannot read file '${opts.file}'.`);
    return EXIT_USAGE;
  }

  const config: CostLensConfig = { region: opts.region, currency: opts.currency, auditUrl: '' };
  const report = await buildReport(opts.file, text, config, opts.budget);
  console.log(opts.format === 'json' ? renderJson(report) : renderMarkdown(report));
  return report.overBudget ? EXIT_OVER_BUDGET : EXIT_OK;
}

// istanbul ignore next — thin entry wrapper; logic is unit-tested above.
if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`error: ${(err as Error).message}`);
      process.exit(EXIT_USAGE);
    });
}

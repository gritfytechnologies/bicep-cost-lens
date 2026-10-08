// Gate 3 — catalog contract.
//
// The fixtures under e2e/fixtures/ declare SKUs the way Bicep authors write
// them. This gate runs the real estimator (the built CLI, same engine as
// the extension) against every fixture and checks each declared SKU still
// resolves in the live Azure Retail Prices catalog (canadacentral, CAD).
// It is the anti-drift alarm for catalog naming changes — e.g. the catalog
// listing storage as `Standard LRS` while Bicep declares `Standard_LRS`,
// which made v0.1.0 silently skip storage accounts.
//
// Exit codes: 0 = contract holds · 1 = catalog drift (a SKU that must
// resolve no longer does, or the fixtures changed without updating the
// expectations below) · 2 = the check itself could not run (network/HTTP
// failure, missing build) — always loud, never a silent pass.
// `--list` prints the declared SKUs and expectations without any network.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = 'canadacentral';
const CURRENCY = 'CAD';
const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'dist', 'cli.js');
const FIXTURES_DIR = path.join(ROOT, 'e2e', 'fixtures');

// What each fixture resource must do. Keep in sync with the fixture files
// and src/priceMap.ts (service names) whenever either changes — that sync
// is the contract this gate enforces.
// expected: 'priced' (SKU must resolve) or 'no-sku' (must skip by design).
const EXPECTATIONS = {
  'workload.bicep': [
    { name: 'vms', type: 'Microsoft.Compute/virtualMachines', serviceName: 'Virtual Machines', sku: 'Standard_D2s_v3', expected: 'priced' },
    { name: 'storage', type: 'Microsoft.Storage/storageAccounts', serviceName: 'Storage', sku: 'Standard_LRS', expected: 'priced' },
    { name: 'plan', type: 'Microsoft.Web/serverfarms', serviceName: 'Azure App Service', sku: 'P1v3', expected: 'priced' },
    { name: 'app', type: 'Microsoft.Web/sites', serviceName: 'Functions', sku: null, expected: 'no-sku' },
  ],
};

function listFixtures() {
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith('.bicep'))
    .sort();
}

function printList() {
  for (const fixture of listFixtures()) {
    const expectations = EXPECTATIONS[fixture];
    if (!expectations) {
      console.log(`${fixture}: NO EXPECTATIONS — gate 3 would fail (add them here).`);
      continue;
    }
    console.log(`${fixture}:`);
    for (const e of expectations) {
      console.log(
        `  ${e.name} (${e.type}) → ${e.serviceName} · SKU ${e.sku ?? '(none declared)'} · expect ${e.expected} [${REGION}/${CURRENCY}]`,
      );
    }
  }
}

function checkFixture(fixture) {
  const expectations = EXPECTATIONS[fixture];
  if (!expectations) {
    return { failures: [`${fixture}: no expectations recorded in scripts/catalog-contract.js`], blocked: [] };
  }
  const result = spawnSync(
    process.execPath,
    [CLI, '--format', 'json', '--region', REGION, '--currency', CURRENCY, path.join(FIXTURES_DIR, fixture)],
    { encoding: 'utf8', cwd: ROOT, timeout: 10 * 60 * 1000 },
  );
  if (result.error || result.status !== 0) {
    return {
      failures: [],
      blocked: [
        `${fixture}: CLI exited ${result.status ?? 'with error'} — ${(result.stderr || result.error?.message || '').trim().split('\n')[0]}`,
      ],
    };
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return { failures: [], blocked: [`${fixture}: CLI did not emit JSON`] };
  }

  const failures = [];
  const blocked = [];
  const notes = [];
  const rowsByName = new Map(report.resources.map((row) => [row.symbolicName, row]));

  for (const e of expectations) {
    const row = rowsByName.get(e.name);
    if (!row) {
      failures.push(
        `${fixture}:${e.name} — resource missing from the report (fixture changed? update EXPECTATIONS)`,
      );
      continue;
    }
    if (row.resourceType !== e.type) {
      failures.push(`${fixture}:${e.name} — type is ${row.resourceType}, expected ${e.type}`);
      continue;
    }
    if (e.expected === 'priced') {
      if (row.priced) {
        notes.push(`  ok  ${e.name} (${e.serviceName}, SKU '${e.sku}') → ${row.cost}`);
      } else if (row.note === 'no prices for SKU in region') {
        failures.push(
          `${fixture}:${e.name} — CATALOG DRIFT: SKU '${e.sku}' no longer resolves in ${e.serviceName}/${REGION}. ` +
            'Check how the Retail Prices catalog names this SKU now (skuName vs armSkuName), then update src/priceMap.ts / the lookup.',
        );
      } else if (row.note === 'price lookup failed') {
        blocked.push(`${fixture}:${e.name} — price lookup failed (network/HTTP) for SKU '${e.sku}'`);
      } else {
        failures.push(`${fixture}:${e.name} — expected a price, got '${row.note}'`);
      }
    } else if (row.priced) {
      failures.push(`${fixture}:${e.name} — expected the no-SKU skip, but it priced (${row.cost})`);
    } else if (row.note === 'no SKU/size declared') {
      notes.push(`  ok  ${e.name} — skips by design (no SKU declared)`);
    } else {
      failures.push(`${fixture}:${e.name} — expected the no-SKU skip, got '${row.note}'`);
    }
  }

  const expectedNames = new Set(expectations.map((e) => e.name));
  for (const row of report.resources) {
    if (!expectedNames.has(row.symbolicName)) {
      failures.push(
        `${fixture}:${row.symbolicName} — in the fixture but not in EXPECTATIONS; record its contract here`,
      );
    }
  }

  return { failures, blocked, notes };
}

function main() {
  if (process.argv.includes('--list')) {
    printList();
    process.exit(0);
  }
  if (!fs.existsSync(CLI)) {
    console.error('gate:catalog: dist/cli.js not found — run `npm run build` first (the gate script in package.json does).');
    process.exit(2);
  }

  const fixtures = listFixtures();
  if (fixtures.length === 0) {
    console.error('gate:catalog: no .bicep fixtures found under e2e/fixtures/.');
    process.exit(2);
  }

  const allFailures = [];
  const allBlocked = [];
  for (const fixture of fixtures) {
    console.log(`\n${fixture} (${REGION}/${CURRENCY}):`);
    const { failures, blocked, notes } = checkFixture(fixture);
    for (const line of notes ?? []) console.log(line);
    for (const line of blocked) console.log(`  !!  ${line}`);
    for (const line of failures) console.log(`  FAIL ${line}`);
    allFailures.push(...failures);
    allBlocked.push(...blocked);
  }

  if (allBlocked.length > 0) {
    console.error(
      `\ngate:catalog: BLOCKED — ${allBlocked.length} check(s) could not run (network/HTTP). This is not a pass; re-run when prices.azure.com is reachable.`,
    );
    process.exit(2);
  }
  if (allFailures.length > 0) {
    console.error(`\ngate:catalog: FAIL — ${allFailures.length} contract break(s) above.`);
    process.exit(1);
  }
  console.log('\ngate:catalog: PASS — every fixture SKU resolves against the live catalog.');
  process.exit(0);
}

main();

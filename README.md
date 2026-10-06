# Bicep Cost Lens

**Directional monthly cost estimates on your Bicep resources, right in the editor.**

> Free. No account. No backend. No telemetry.

![demo](media/demo.gif)

## What it does

- **Hover any Bicep resource** → see an estimated monthly cost range, pulled live from the
  [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
  for your region and currency.
- **Command: `Cost Lens: Estimate File Cost`** → totals the directional cost of every
  priced resource in the open `.bicep` file into the Output panel.
- **Status bar: `Get a full FinOps audit`** → one click to the FinOps audit page
  (configurable via `bicepCostLens.auditUrl`).

## The honest caveats (read these)

Every estimate is labeled **directional** because it is:

- List prices only — no EA/MCA discounts, reservations, hybrid benefit, or spot pricing.
- Scaled to a full 730-hour month for hourly meters; usage-based meters (per-GB,
  per-transaction) are shown per-unit because they can't be scaled without your usage data.
- Excludes data transfer, support plans, and anything the Retail Prices API doesn't cover.

**Verify with the [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/)
before budgeting.** If an estimate ever looks wrong,
[open an issue](https://github.com/gritfytechnologies/bicep-cost-lens/issues).

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `bicepCostLens.region` | `canadacentral` | Azure region for price lookups (e.g. `eastus`, `westeurope`) |
| `bicepCostLens.currency` | `CAD` | ISO currency code (e.g. `CAD`, `USD`) |
| `bicepCostLens.auditUrl` | `https://gritfytechnologies.com` | Destination of the FinOps audit CTA |

## Offline behavior

Prices are cached for 24 hours. If Azure's price list is unreachable, the extension serves
the last-known prices labeled as cached — or tells you plainly it can't compute an estimate.
It never fails silently.

## Why zero dependencies

This extension ships with **zero runtime dependencies** (bundled with esbuild). Fewer
dependencies = smaller attack surface, faster activation, and nothing to go stale or get
supply-chain hijacked. The only network call is to Microsoft's public Retail Prices API.

## Development

```bash
npm install
npm run build      # bundle to dist/
npm run watch      # rebuild on change
npm run lint       # eslint (CI-enforced)
npm run typecheck  # tsc --noEmit
npm run test       # vitest with coverage (≥80% gate on pure logic)
npm run test:e2e   # headless VS Code run of every command
npm run package    # vsce package -> .vsix (no publish)
```

## Release process

Per [extension standards](../../standards/extension-standards.md): unit + e2e green →
manual QA checklist signed → pre-release soak 7 days → promote to release.
`CHANGELOG.md` is updated on every release.

## License

MIT — see [LICENSE](LICENSE).

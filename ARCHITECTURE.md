# ARCHITECTURE — Bicep Cost Lens

## Shape
A VS Code extension and a CLI sharing one estimation core. No backend; the only external dependency is the anonymous Azure Retail Prices API (`https://prices.azure.com/api/retail/prices`).

```
.bicep file ──► parser ──► priceMap ──► pricesClient ──► cache (24h)
                                              ▲                │
config (region/currency/auditUrl) ────────────┘                ▼
                              estimator (×730h, directional) ──► hover card
                                                              ├─► Estimate File command
                                                              ├─► CLI report + budget gate
status bar (auditCta) ──► configured audit URL
```

## Modules (`src/`, ~1,200 LOC)
| Module | Job |
|---|---|
| `extension.ts` | Entry. Lazy activation (`onLanguage:bicep`, plus `workspaceContains` for `.bicep` / `.bicepparam` files so it works without Microsoft's Bicep extension); rebuilds the estimator when `bicepCostLens` settings change. |
| `parser.ts` | Lightweight regex + brace-matching extraction of resource type, SKU, VM size, location. Deliberately not a full Bicep grammar — skips what it can't understand, never throws on real files. |
| `priceMap.ts` | Resource type → Retail Prices service/meter mapping (12 types). Adding a type = one entry + one fixture. Also owns `skuCandidates` (declared-name spelling variants). |
| `pricesClient.ts` | API client. Anonymous, 15s timeout, max 5 pages; failures become plain-language `PricingError`. Lookups try `armSkuName` then `skuName` across the spelling variants — the catalog keys some services (storage) on the display name (`Standard LRS`) with an empty `armSkuName`. |
| `cache.ts` | 24h price cache so hovers stay fast and the API isn't hammered. |
| `estimator.ts` / `costEstimator.ts` | Combines parsed resources with prices; scales hourly meters to a 730-hour month; labels everything directional. |
| `hoverProvider.ts` | Renders the cost card per DESIGN_SYSTEM. |
| `commands.ts` | `Estimate File Cost` + `Get a Full FinOps Audit` commands. |
| `auditCta.ts` | Status-bar item; the single commercial surface. |
| `config.ts` | Settings surface: `region` (default `canadacentral`), `currency` (default `CAD`), `auditUrl`. |
| `cli.ts` | Zero-dependency bundled CLI sharing the same core; exit 0/2/1 = under/over/error. |

## Key decisions (and why)
- **Regex parser over full grammar:** pricing needs four fields, not an AST. Simplicity keeps the never-crash rule achievable.
- **Anonymous public API, no key:** zero-friction install is the product. The 24h cache keeps request volume polite.
- **No state leaves the machine:** no telemetry, no backend — a privacy posture and a marketplace-review simplifier.
- **esbuild single bundle:** the CLI ships as one file runnable with bare Node 20+ (`node dist/cli.js ...`), no install step, so it drops into any CI pipeline.

## Failure modes
- Prices API unreachable → `PricingError` in plain language; stale cache used when present.
- Unknown resource type → skipped silently in hover, listed as unestimated in file/CLI reports.
- Bad settings → defaults apply; estimator rebuilds on settings change without reload.

## Testing
Vitest unit suite mirrors the modules (`test/*.test.ts`); @vscode/test-electron e2e in `e2e/`. Release gate: all green + coverage held (see AGENTS.md).

The four gates (Deliverable: release pipeline) run as npm scripts and are mirrored in `.github/workflows/ci.yml`:
1. `gate:code` — typecheck + lint + unit tests.
2. `gate:e2e` — headless e2e against `e2e/fixtures/` (a workspace with a VM, storage account, App Service plan + site), exercising the no-Bicep-extension filename path. `scripts/run-e2e.js` wraps xvfb on display-less Linux.
3. `gate:catalog` — `scripts/catalog-contract.js` runs the built CLI over the fixtures against the live Retail Prices API and fails loudly when a declared SKU stops resolving (exit 1 = catalog drift, exit 2 = the check itself couldn't run; `--list` prints the contract without network).
4. `gate:package` — `vsce package` + `scripts/verify-package.js` (ZIP/CRC integrity, manifest identity, square icon, required members).

`npm run pipeline` runs all four in order. Publishing is not in the pipeline — it stays Siva's step.

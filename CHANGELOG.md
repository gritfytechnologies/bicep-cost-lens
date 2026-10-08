# Changelog

All notable changes to Bicep Cost Lens are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] — 2026-10-07

### Fixed
- Works without Microsoft's Bicep extension. Activation, hover, the audit
  status bar, and `Estimate File Cost` keyed entirely off the `bicep`
  language id, which only that extension provides — in a plain editor a
  `.bicep` file got "open a .bicep file first" and no hover. All four now
  also match on the `.bicep` / `.bicepparam` filename.
- `Estimate File Cost` no longer needs the Bicep file to be the focused
  editor: with a non-Bicep file focused it estimates the open `.bicep`
  file instead, and asks which one when several are open.
- Storage accounts (and any SKU the catalog lists under a display name)
  resolve prices again. Lookups only tried the ARM SKU name
  (`Standard_LRS`); the Retail Prices catalog lists that SKU as
  `Standard LRS`, so every storage account skipped. Lookups now try both
  catalog name fields and both spellings before giving up.
- App Service plan SKUs written without a space (`P1v3`) resolve too.
  The catalog lists them as `P1 v3`; the lookup now tries that spelling
  as well.

### Added
- Four-gate release pipeline (`npm run pipeline`): code (typecheck, lint,
  unit tests), headless extension e2e against a fixture workspace, a live
  catalog contract that fails when a fixture SKU stops resolving, and a
  package verification pass over the built `.vsix`. Mirrored in CI.

## [0.1.0] — 2026-10-05

### Added
- Hover provider: directional monthly cost range on Bicep resource declarations,
  via the Azure Retail Prices API (region + currency configurable).
- `bicep-cost-lens.estimateFile`: totals estimated file cost into the Output panel.
- `bicep-cost-lens.requestAudit` + status-bar CTA ("Get a full FinOps audit",
  destination via `bicepCostLens.auditUrl`).
- 24-hour price cache with honest stale labeling; plain-language offline degradation.
- Zero runtime dependencies; lazy activation on Bicep files only.
- `bicep-cost-lens` CLI (`dist/cli.js`): same engine as a pipeline cost gate —
  `node dist/cli.js --budget 500 --currency CAD infra/main.bicep` prints a
  markdown/JSON estimate and exits 2 when over budget. Single bundled file,
  zero install: `curl` it and run with Node 20+.

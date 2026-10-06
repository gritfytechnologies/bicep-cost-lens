# Changelog

All notable changes to Bicep Cost Lens are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-10-05

### Added
- Hover provider: directional monthly cost range on Bicep resource declarations,
  via the Azure Retail Prices API (region + currency configurable).
- `bicep-cost-lens.estimateFile`: totals estimated file cost into the Output panel.
- `bicep-cost-lens.requestAudit` + status-bar CTA ("Get a full FinOps audit",
  destination via `bicepCostLens.auditUrl`).
- 24-hour price cache with honest stale labeling; plain-language offline degradation.
- Zero runtime dependencies; lazy activation on Bicep files only.

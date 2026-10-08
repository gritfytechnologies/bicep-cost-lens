# DESIGN_SYSTEM — Bicep Cost Lens

## Brand
Gritfy "Executive Dark" — used across gritfytechnologies.com, listing assets and docs:
- Charcoal `#161310` (surface) · Amber `#D9A45B` (accent) — the only two brand colors.
- Canonical logo: `assets/logo.png` in the brand kit (never redraw or reinterpret it). Extension icon derives from `media/icon-1024.png` / `media/icon.svg`.

## Surfaces
1. **Hover card** (primary): VS Code markdown. Structure: resource name → monthly estimate (bold) → the word "directional" → top price drivers. No tables in hovers (they wrap badly); one fact per line.
2. **Status bar**: single item, audit CTA ("Get a Full FinOps Audit"). The only commercial surface in the product — keep it quiet, never nag.
3. **CLI report**: markdown or JSON. Human-readable first; `--budget` verdict line last. Exit codes are part of the design: 0 under budget, 2 over, 1 usage error.
4. **Marketplace listing & README**: hero image (`media/hero.png`), "how it works" diagram (`media/how-it-works.png`, rendered PNG — never mermaid), badges for CI/license/version.

## Number & copy conventions
- Currency: configured code (default CAD), 2 decimals, no thousands separators inside hover cards; separators allowed in CLI reports.
- Every figure is followed by "directional" framing at least once per surface. Never "will cost", always "estimated at ~".
- Errors are plain sentences ("Couldn't reach Azure pricing just now — showing the last cached estimate."), never raw error names or stack traces.
- Full Azure service names everywhere ("Azure App Service", not abbreviations) — in hovers, CLI output, docs and listing copy.

## Voice
Direct, engineer-to-engineer, no marketing adjectives. If a sentence would embarrass us pasted into a GitHub issue, rewrite it.

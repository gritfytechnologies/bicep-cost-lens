# AGENTS.md — how to work in this repo

Read order before any change: `PRD.md` (what/why) → `ARCHITECTURE.md` (how) → `DESIGN_SYSTEM.md` (look/feel) → the Gritfy extension standards (`~/workspace/goals/revenue-engine/standards/extension-standards.md`, which governs all Gritfy extensions).

## Commands
- Build: `npm run build` (esbuild) · Watch: `npm run watch`
- Test: `npm test` (vitest + coverage) · E2E: `npm run test:e2e` (@vscode/test-electron, headless-safe via `scripts/run-e2e.js`)
- Lint: `npm run lint` · Typecheck: `npm run typecheck`
- Package: `npm run package` (vsce → `.vsix`)
- Release gates: `npm run gate:code` / `gate:e2e` / `gate:catalog` / `gate:package`, or all four in order: `npm run pipeline`. Gate 3 hits the live prices API; `--list` mode (`node scripts/catalog-contract.js --list`) prints its contract offline. Publishing stays a human step (see change habits).

## Hard rules
1. **No telemetry, no backend, no account.** The only network call is the public Azure Retail Prices API (anonymous). A change that adds tracking, sign-in, or a server is rejected on sight.
2. **Every estimate is labeled directional** (pre-discount, pre-reservation). Never let UI copy or CLI output read as a quote.
3. **The parser never crashes.** Unparseable input is skipped, not thrown. Any exception path becomes a plain-language `PricingError`-style message.
4. **Test gate before release:** full unit suite + e2e + typecheck + lint green, coverage not regressing. (v0.1.0 shipped at 39/39 unit, 3/3 e2e, 97.3% coverage — hold that bar.)
5. **Public repo hygiene:** extension repos are public before marketplace work (badges/issues break on private). When pushing via the filtered staging flow, exclude `node_modules`, `.vscode-test`, `coverage`, `*.vsix`.
6. **READMEs carry no mermaid** (broken on GitHub mobile) — ship rendered PNG diagrams instead.
7. Costs, settings and copy use full Azure service names; currency defaults to CAD, region to `canadacentral`.

## Change habits
- One concern per PR; update `CHANGELOG.md` and the context files (this file, PRD, ARCHITECTURE, DESIGN_SYSTEM) when behavior or structure changes — an agent reading stale context is worse than no context.
- New resource type support = one `priceMap` entry + one test fixture. Nothing else should need to change.
- Siva approves every external step (publish, release, listing edits). Code changes inside the repo are build work; anything user-facing outside it waits for his go-ahead.

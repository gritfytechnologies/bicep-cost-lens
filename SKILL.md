---
name: bicep-cost-lens
description: Directional Azure cost estimates for Bicep infrastructure code. Use when working with .bicep files to see what resources cost before deploying, when adding a budget gate to a CI/CD pipeline, or when answering "what will this Bicep change cost per month?"
---

# Bicep Cost Lens

Free VS Code extension + zero-dependency CLI that shows directional monthly
Azure cost estimates on Bicep resources, via the Azure Retail Prices API.
Free. No account. No backend. No telemetry.

## When to use

- Estimating what a `.bicep` file or resource will cost per month
- Adding a cost/budget gate to GitHub Actions or Azure DevOps pipelines
- Answering "is this Bicep change over budget?"

## How it works

1. **Parse** — reads `resource` declarations (type, SKU, VM size, location) from `.bicep` files
2. **Map** — matches resource types to Retail Prices API service names (12 types and growing)
3. **Price** — queries Microsoft's public price list, filtered by region + currency, cached 24h
4. **Estimate** — scales hourly meters to a 730-hour month; every number labeled directional

## Interface

- **VS Code:** hover any resource → cost card; command `Cost Lens: Estimate File Cost`; status-bar FinOps audit CTA
- **CLI:** `node dist/cli.js --budget 500 --currency CAD infra/main.bicep` → markdown/JSON report; exits 0 under budget, 2 over budget, 1 on usage error
- **Settings:** `bicepCostLens.region` (default `canadacentral`), `bicepCostLens.currency` (default `CAD`), `bicepCostLens.auditUrl`

## Works together with

- **AI Spend Lens** (planned): Bicep Cost Lens covers infrastructure cost at deploy time; AI Spend Lens covers AI/API spend at runtime. Together: full-stack cost visibility.
- **FinOps audit services:** the extension is the free top-of-funnel — the in-editor "Get a full FinOps audit" CTA routes to the productized FinOps/Azure AI Spend audit services.
- **Agent Policy Guard** (planned): pair the budget gate with policy-as-code enforcement for AI agents.

## Development

- Repo: `gritfytechnologies/bicep-cost-lens`
- Build: `npm run build` → `dist/extension.js` + `dist/cli.js`
- Gates: `npm run typecheck`, `npm run lint`, `npm run test` (≥80% on pure logic), `npm run test:e2e`
- Standards: `extension-standards.md` §§1–8 (naming, zero deps, test gate, rollout, self-improvement loop, annotated skills)
- Release: pre-release soak 7 days → promote; success gate 1,000 installs in 60 days or park

# PRD — Bicep Cost Lens

## Problem
Azure teams write Bicep, deploy, and discover the cost weeks later in the bill. Existing cost tools (Azure Pricing Calculator, portal estimates) live outside the editor, break flow, and are usually skipped in review. The result: cost surprises that a 10-second in-editor estimate would have caught.

## Product
A free VS Code extension (plus a zero-dependency CLI) that shows **directional monthly cost estimates on Bicep resources at authoring time** — hover a resource, see what it costs. Prices come from Microsoft's public Azure Retail Prices API.

- **Free. No account. No backend. No telemetry.** (Hard rule, not a slogan — see AGENTS.md.)
- Funnel role: the extension is a lead magnet for Gritfy's paid FinOps audit. One status-bar action ("Get a Full FinOps Audit") is the only commercial surface.

## Audience
- Azure platform / cloud engineers authoring Bicep daily
- FinOps practitioners who want a cost gate in CI without another SaaS
- Platform teams standardizing on Bicep across subscriptions

## What it does (v0.1.0)
1. Parses `resource` declarations (type, SKU, VM size, location) from `.bicep` files.
2. Maps resource types to Retail Prices API services (12 types and growing).
3. Queries live retail prices filtered by configured region + currency, cached 24h.
4. Estimates monthly cost (hourly meters × 730h). Every number is labeled **directional** — pre-discount, pre-reservation, pre-usage-variance.
5. CLI mode: same estimate as a report with a budget gate (exit 0 under budget, 2 over, 1 on error).

## Non-goals
- **Not a billing-accurate quote.** Never present an estimate as a quote; reserved instances, savings plans, negotiated discounts and actual usage are out of scope.
- No cloud calls beyond the public prices API. No sign-in, no deployment, no Azure Resource Manager access.
- No full Bicep grammar. The parser is deliberately lightweight: it extracts what pricing needs and skips what it cannot understand — it must never crash on a real file.

## Success metrics
- Marketplace installs and week-4 retention (target set at publish)
- Audit CTA click-through (the only revenue-facing metric)
- GitHub issues answered with a fix or a documented limitation

## Principles
- **Directional honesty:** under-promise in every label; a wrong-but-confident number is the worst failure mode.
- **Degrade in plain language:** every failure surfaces as a sentence a tired engineer understands at 2 a.m., never a stack trace.
- **Zero friction:** install → open a `.bicep` file → first estimate. Any step that needs an account is a defect.

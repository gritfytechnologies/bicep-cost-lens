# Support — Bicep Cost Lens

Bicep Cost Lens is maintained by Gritfy Technologies Inc. This page explains how to report a problem, what response to expect, and how fixes reach you.

## Reporting a problem

Open an issue in this repository and choose the form that fits:

- **Bug report** — wrong prices, missing prices, or the extension failing. The form asks for your extension version, VS Code version, operating system, what happened, what you expected, and a minimal `.bicep` sample.
- **Feature request** — a resource type, region, or workflow the extension should cover. The form asks for your use case and what you do today instead.

Blank issues are disabled, so every report arrives with the detail needed to act on it. For general usage questions, the [Visual Studio Marketplace Q&A](https://marketplace.visualstudio.com/items?itemName=gritfytechnologies.bicep-cost-lens&ssr=false#qna) also works.

Every new issue is acknowledged automatically with its class and response target. A person reviews each one — the automation only sets the clock.

## Response targets

| Issue class | Label | Response target |
| --- | --- | --- |
| Bug | `priority-fix` | patch target: within 48 hours |
| Enhancement | `enhancement` | reviewed within 5 business days |
| Question | `question` | answered within 2 business days |

These are commitments, not marketing windows. If we miss one, the issue stays open and visible until it is resolved.

## How fixes ship

Bicep Cost Lens follows a stable release cadence: fixes and features ship as patch or minor releases, never as silent changes. Every release — including urgent patches — passes the full gate suite before it is published:

1. Unit tests, with coverage held at the shipped bar
2. Headless end-to-end tests in a real VS Code instance
3. A live Azure Retail Prices catalog check, so price lookups are verified against the real API
4. Package verification of the exact `.vsix` that will be uploaded

Publishing to the Marketplace is a maintainer-approved step; no release goes out automatically. When a fix is live, we update the originating issue with the fixed version number, and `CHANGELOG.md` names the version that carries each fix.

## A note on privacy

The extension has no telemetry, no backend, and no account — its only network call is the public Azure Retail Prices API. We cannot see your files or your VS Code setup. If you report a bug, the fastest path to a fix is the minimal `.bicep` sample in the bug form, with anything sensitive stripped out.

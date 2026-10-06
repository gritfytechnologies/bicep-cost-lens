/**
 * Hover provider: shows a directional monthly cost estimate when hovering
 * over a Bicep resource declaration.
 */
import * as vscode from 'vscode';
import { formatRange } from './costEstimator';
import type { ResourceEstimator } from './estimator';
import { parseBicepResources } from './parser';
import type { BicepResource, CostEstimate } from './types';

const DIRECTIONAL_NOTE =
  'Directional estimate only — list prices, no EA/MCA discounts, reservations, ' +
  'data transfer, or support costs. Verify with the Azure Pricing Calculator before budgeting.';

function resourceAt(
  resources: BicepResource[],
  position: vscode.Position,
): BicepResource | undefined {
  // The declaration usually spans one line; match by line number.
  return resources.find((resource) => resource.line === position.line + 1);
}

function estimateMarkdown(
  resource: BicepResource,
  estimate: CostEstimate,
  cached: boolean,
  stale: boolean,
): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = false;
  const cacheNote = stale
    ? ' (cached — price list unreachable, last known prices)'
    : cached
      ? ' (cached)'
      : '';
  md.appendMarkdown(
    `### 💰 Bicep Cost Lens\n\n` +
      `**${resource.symbolicName}** ` +
      `(\`${resource.resourceType}\`)\n\n` +
      `Estimated monthly cost: **${formatRange(estimate)}**${cacheNote}\n\n` +
      `_${estimate.basis} · ${estimate.meterCount} price record(s)_\n\n` +
      `> ${DIRECTIONAL_NOTE}\n`,
  );
  return md;
}

function messageMarkdown(message: string): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = false;
  md.appendMarkdown(`### 💰 Bicep Cost Lens\n\n${message}\n`);
  return md;
}

export class CostHoverProvider implements vscode.HoverProvider {
  constructor(private readonly getEstimator: () => ResourceEstimator) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): Promise<vscode.Hover | undefined> {
    if (document.languageId !== 'bicep') {
      return undefined;
    }
    const resources = parseBicepResources(document.getText());
    const resource = resourceAt(resources, position);
    if (!resource) {
      return undefined;
    }

    const outcome = await this.getEstimator().estimate(resource);
    const range = new vscode.Range(position.line, 0, position.line, Number.MAX_SAFE_INTEGER);

    switch (outcome.kind) {
      case 'estimate':
        return new vscode.Hover(
          estimateMarkdown(resource, outcome.estimate, outcome.cached, outcome.stale),
          range,
        );
      case 'unmapped':
      case 'noPrices':
      case 'error':
        return new vscode.Hover(messageMarkdown(outcome.reason), range);
    }
  }
}

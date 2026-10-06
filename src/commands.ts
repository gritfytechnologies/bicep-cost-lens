/**
 * Registered commands:
 * - bicep-cost-lens.estimateFile — totals directional cost for the open .bicep file
 * - bicep-cost-lens.requestAudit — opens the FinOps audit CTA destination
 */
import * as vscode from 'vscode';
import { formatMoney } from './costEstimator';
import type { ResourceEstimator } from './estimator';
import { parseBicepResources } from './parser';
import type { CostLensConfig } from './types';

const OUTPUT_CHANNEL = 'Bicep Cost Lens';
const ISSUE_LINK = 'https://github.com/gritfytechnologies/bicep-cost-lens/issues';

function showError(message: string): void {
  void vscode.window.showErrorMessage(message, 'Open an issue').then((choice) => {
    if (choice === 'Open an issue') {
      void vscode.env.openExternal(vscode.Uri.parse(ISSUE_LINK));
    }
  });
}

export function registerEstimateFileCommand(
  context: vscode.ExtensionContext,
  getEstimator: () => ResourceEstimator,
  getConfig: () => CostLensConfig,
): vscode.Disposable {
  return vscode.commands.registerCommand('bicep-cost-lens.estimateFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'bicep') {
      void vscode.window.showInformationMessage(
        'Cost Lens: open a .bicep file first, then estimate its cost.',
      );
      return;
    }

    const config = getConfig();
    const estimator = getEstimator();
    const resources = parseBicepResources(editor.document.getText());
    if (resources.length === 0) {
      void vscode.window.showInformationMessage(
        'Cost Lens: no resource declarations found in this file.',
      );
      return;
    }

    const channel = vscode.window.createOutputChannel(OUTPUT_CHANNEL);
    channel.appendLine(`Bicep Cost Lens — file estimate (${config.region}, ${config.currency})`);
    channel.appendLine('Directional estimates only — verify with the Azure Pricing Calculator.');
    channel.appendLine('');

    let low = 0;
    let high = 0;
    let counted = 0;
    let skipped = 0;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Cost Lens: estimating file cost…',
        cancellable: false,
      },
      async () => {
        for (const resource of resources) {
          const outcome = await estimator.estimate(resource);
          if (outcome.kind === 'estimate') {
            low += outcome.estimate.low;
            high += outcome.estimate.high;
            counted++;
            const cached = outcome.stale ? ' (stale cache)' : outcome.cached ? ' (cached)' : '';
            channel.appendLine(
              `✔ ${resource.symbolicName} (${resource.resourceType}): ` +
                `${formatMoney(outcome.estimate.low, config.currency)} – ` +
                `${formatMoney(outcome.estimate.high, config.currency)}${cached}`,
            );
          } else {
            skipped++;
            channel.appendLine(`– ${resource.symbolicName} (${resource.resourceType}): skipped — ${outcome.reason.split('\n')[0] ?? ''}`);
          }
        }
      },
    );

    channel.appendLine('');
    if (counted > 0) {
      const total =
        low === high
          ? formatMoney(low, config.currency)
          : `${formatMoney(low, config.currency)} – ${formatMoney(high, config.currency)}`;
      channel.appendLine(
        `Estimated monthly total for ${counted} resource(s): ${total}/month (directional)`,
      );
      if (skipped > 0) {
        channel.appendLine(`${skipped} resource(s) skipped — see lines above.`);
      }
      channel.show(true);
      void vscode.window.showInformationMessage(
        `Cost Lens: ~${total}/month across ${counted} resource(s) (directional). Details in the Output panel.`,
      );
    } else {
      channel.show(true);
      showError(
        'Cost Lens: no estimates could be computed for this file. Details in the Output panel.',
      );
    }
  });
}

export function registerRequestAuditCommand(
  context: vscode.ExtensionContext,
  getConfig: () => CostLensConfig,
): vscode.Disposable {
  return vscode.commands.registerCommand('bicep-cost-lens.requestAudit', async () => {
    const { auditUrl } = getConfig();
    try {
      await vscode.env.openExternal(vscode.Uri.parse(auditUrl));
    } catch {
      showError(`Cost Lens: couldn't open ${auditUrl}. Check the bicepCostLens.auditUrl setting.`);
    }
  });
}

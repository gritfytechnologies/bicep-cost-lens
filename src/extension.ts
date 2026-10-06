/**
 * Bicep Cost Lens — extension entry point.
 *
 * Activation is lazy (`onLanguage:bicep`): nothing runs until a Bicep file
 * is opened. Every user-facing failure degrades to a plain-language message.
 */
import * as vscode from 'vscode';
import { createAuditStatusBarItem, updateAuditStatusBarItem } from './auditCta';
import { registerEstimateFileCommand, registerRequestAuditCommand } from './commands';
import { getConfig } from './config';
import { ResourceEstimator } from './estimator';
import { CostHoverProvider } from './hoverProvider';

export function activate(context: vscode.ExtensionContext): void {
  // Rebuilt when settings change, so region/currency/auditUrl stay fresh.
  let estimator = new ResourceEstimator(getConfig());
  const getEstimator = (): ResourceEstimator => estimator;
  const refreshEstimator = (): void => {
    estimator = new ResourceEstimator(getConfig());
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('bicepCostLens')) {
        refreshEstimator();
      }
    }),
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ language: 'bicep', scheme: 'file' }, new CostHoverProvider(getEstimator)),
  );

  context.subscriptions.push(
    registerEstimateFileCommand(context, getEstimator, getConfig),
    registerRequestAuditCommand(context, getConfig),
  );

  const auditItem = createAuditStatusBarItem(context);
  updateAuditStatusBarItem(auditItem);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateAuditStatusBarItem(auditItem)),
  );
}

export function deactivate(): void {
  // Nothing to clean up beyond VS Code's own disposal of subscriptions.
}

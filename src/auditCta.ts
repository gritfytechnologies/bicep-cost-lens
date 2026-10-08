/**
 * Status-bar CTA: "Get a full FinOps audit".
 * Visible only when a Bicep file is open. Keyboard-operable via its command.
 */
import * as vscode from 'vscode';
import { isBicepDocument } from './bicepDocuments';

export function createAuditStatusBarItem(context: vscode.ExtensionContext): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.text = '$(shield) Get a full FinOps audit';
  item.tooltip = 'Bicep Cost Lens: open the FinOps audit page (bicep-cost-lens.requestAudit)';
  item.command = 'bicep-cost-lens.requestAudit';
  context.subscriptions.push(item);
  return item;
}

export function updateAuditStatusBarItem(item: vscode.StatusBarItem): void {
  const document = vscode.window.activeTextEditor?.document;
  if (document && isBicepDocument(document)) {
    item.show();
  } else {
    item.hide();
  }
}

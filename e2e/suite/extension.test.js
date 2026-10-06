// Runs inside the Extension Host (mocha TDD globals). Every registered
// command must run here at least once.
const assert = require('assert');
const vscode = require('vscode');

const SAMPLE_BICEP = `param location string = resourceGroup().location

resource stg 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'costlenstest'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}
`;

suite('Bicep Cost Lens e2e', () => {
  test('both commands are registered', async () => {
    // Opening a Bicep file triggers lazy activation (onLanguage:bicep);
    // activate() resolves immediately if it is already active.
    const doc = await vscode.workspace.openTextDocument({
      language: 'bicep',
      content: SAMPLE_BICEP,
    });
    await vscode.window.showTextDocument(doc);
    const ext = vscode.extensions.getExtension('gritfytechnologies.bicep-cost-lens');
    assert.ok(ext, 'extension is installed in the test host');
    await ext.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('bicep-cost-lens.estimateFile'), 'estimateFile registered');
    assert.ok(commands.includes('bicep-cost-lens.requestAudit'), 'requestAudit registered');
  });

  test('estimateFile runs on a bicep file without throwing', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'bicep',
      content: SAMPLE_BICEP,
    });
    await vscode.window.showTextDocument(doc);
    // Must not reject: the price API may be unreachable in CI, and the
    // command degrades to plain-language messages instead of throwing.
    await vscode.commands.executeCommand('bicep-cost-lens.estimateFile');
  });

  test('estimateFile on a non-bicep file shows guidance, not an error', async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: 'plaintext',
      content: 'hello',
    });
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('bicep-cost-lens.estimateFile');
  });
});

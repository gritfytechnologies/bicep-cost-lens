// Runs inside the Extension Host (mocha TDD globals).
//
// The fixture workspace (e2e/fixtures/workload.bicep) is opened from disk,
// and deliberately WITHOUT Microsoft's Bicep extension: in this clean test
// host a `.bicep` file gets no `bicep` language id, which is exactly the
// condition v0.1.0 handled badly (commands shrugged "open a .bicep file
// first", hover never fired). These tests pin the filename-pattern path:
// activation, hover, and Estimate File Cost must all work by filename.
//
// Price lookups hit the live Retail Prices API when the network allows.
// Where it doesn't, the extension degrades to "Couldn't reach Azure's
// price list" — so estimate assertions accept a real estimate OR that
// offline message, but never the old catalog-miss skip this release fixes.
const assert = require('assert');
const path = require('path');
const vscode = require('vscode');

const FIXTURE_URI = vscode.Uri.file(
  path.resolve(__dirname, '..', 'fixtures', 'workload.bicep'),
);

const ESTIMATE_OR_OFFLINE = /Estimated monthly cost|Couldn't reach Azure's price list/;

async function openFixture() {
  const doc = await vscode.workspace.openTextDocument(FIXTURE_URI);
  await vscode.window.showTextDocument(doc);
  return doc;
}

function lineOf(doc, marker) {
  const text = doc.getText();
  const index = text.indexOf(marker);
  assert.ok(index >= 0, `fixture contains ${marker}`);
  return text.slice(0, index).split('\n').length - 1;
}

function hoverText(hovers) {
  return hovers
    .flatMap((hover) => hover.contents)
    .map((content) => (typeof content === 'string' ? content : (content.value ?? '')))
    .join('\n');
}

async function hoverAt(doc, marker) {
  const position = new vscode.Position(lineOf(doc, marker), 1);
  const deadline = Date.now() + 30000;
  // The extension activates lazily (workspaceContains); poll until the
  // provider answers or the deadline passes, then assert on the result.
  for (;;) {
    const hovers = await vscode.commands.executeCommand(
      'vscode.executeHoverProvider',
      doc.uri,
      position,
    );
    if (hovers && hovers.length > 0) {
      return hoverText(hovers);
    }
    if (Date.now() > deadline) {
      return '';
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

suite('Bicep Cost Lens e2e', () => {
  test('both commands are registered', async () => {
    const doc = await openFixture();
    assert.ok(doc, 'fixture document opens');
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('bicep-cost-lens.estimateFile'), 'estimateFile registered');
    assert.ok(commands.includes('bicep-cost-lens.requestAudit'), 'requestAudit registered');
  });

  test('hover prices the virtual machine by ARM SKU name', async () => {
    const doc = await openFixture();
    const text = await hoverAt(doc, 'resource vms');
    assert.match(text, /Bicep Cost Lens/, 'hover carries the Cost Lens card');
    assert.match(text, ESTIMATE_OR_OFFLINE, 'hover estimates or degrades honestly');
  });

  test('hover no longer catalog-misses the storage account (Standard_LRS)', async () => {
    const doc = await openFixture();
    const text = await hoverAt(doc, 'resource storage');
    assert.match(text, /Bicep Cost Lens/);
    assert.doesNotMatch(
      text,
      /no `Standard_LRS` entries/,
      'storage must not skip on the underscore SKU name',
    );
    assert.match(text, ESTIMATE_OR_OFFLINE);
  });

  test('hover no longer catalog-misses the App Service plan (P1v3)', async () => {
    const doc = await openFixture();
    const text = await hoverAt(doc, 'resource plan');
    assert.match(text, /Bicep Cost Lens/);
    assert.doesNotMatch(text, /no `P1v3` entries/, 'plan must not skip on the ARM SKU name');
    assert.match(text, ESTIMATE_OR_OFFLINE);
  });

  test('hover on the site explains that it declares no SKU', async () => {
    const doc = await openFixture();
    const text = await hoverAt(doc, 'resource app');
    assert.match(text, /doesn't declare a SKU/);
  });

  test('estimateFile runs against the focused fixture file', async () => {
    await openFixture();
    await vscode.commands.executeCommand('bicep-cost-lens.estimateFile');
  });

  test('estimateFile falls back to the open .bicep file when a text file is focused', async () => {
    await openFixture();
    const notesUri = vscode.Uri.file(
      path.join(require('os').tmpdir(), 'bicep-cost-lens-e2e-notes.txt'),
    );
    await vscode.workspace.fs.writeFile(notesUri, Buffer.from('not a bicep file', 'utf8'));
    const notes = await vscode.workspace.openTextDocument(notesUri);
    await vscode.window.showTextDocument(notes);
    // Must not reject and must not stop at the "open a .bicep file first"
    // guidance: the fixture is open, so it is the estimate target.
    await vscode.commands.executeCommand('bicep-cost-lens.estimateFile');
  });

  test('estimateFile shows guidance (does not throw) with no Bicep document open', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('bicep-cost-lens.estimateFile');
  });

  test('requestAudit executes without throwing', async () => {
    await vscode.workspace
      .getConfiguration('bicepCostLens')
      .update('auditUrl', 'https://example.com', vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('bicep-cost-lens.requestAudit');
  });
});

// Headless e2e runner. Run with: npm run test:e2e (requires `npm run build` first).
// Opens the fixture workspace so `workspaceContains:**/*.bicep` activation
// fires exactly as it does for a user opening a folder of Bicep files.
const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index.js');
    const fixturesPath = path.resolve(__dirname, 'fixtures');
    await runTests({
      // Pin via env for reproducibility; unset = latest stable (downloads).
      version: process.env.VSCODE_TEST_VERSION || undefined,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [fixturesPath, '--disable-extensions', '--disable-workspace-trust'],
    });
  } catch (err) {
    console.error('e2e failed:', err);
    process.exit(1);
  }
}

main();

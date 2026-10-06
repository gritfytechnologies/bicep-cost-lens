// Headless e2e runner. Run with: npm run test:e2e (requires `npm run build` first).
const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index.js');
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions', '--disable-workspace-trust'],
    });
  } catch (err) {
    console.error('e2e failed:', err);
    process.exit(1);
  }
}

main();

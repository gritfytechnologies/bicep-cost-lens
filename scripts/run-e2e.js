// E2E launcher: runs the VS Code test host headlessly.
// On Linux without a display (CI, SSH, this build VM) it wraps the run in
// xvfb-run; everywhere else it runs directly. Used by `npm run test:e2e`
// and `npm run gate:e2e`.
const { spawnSync } = require('child_process');
const path = require('path');

const runTest = path.resolve(__dirname, '..', 'e2e', 'runTest.js');
const needsDisplay = process.platform === 'linux' && !process.env.DISPLAY;

let command = process.execPath;
let args = [runTest];

if (needsDisplay) {
  const probe = spawnSync('which', ['xvfb-run'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    console.error(
      'gate:e2e: no DISPLAY and xvfb-run not found. Install xvfb (e.g. `sudo apt-get install -y xvfb`) or run under a desktop session.',
    );
    process.exit(1);
  }
  command = 'xvfb-run';
  args = ['-a', process.execPath, runTest];
}

const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);

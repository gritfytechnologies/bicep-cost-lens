// Mocha bootstrap for the headless e2e run. The extension host calls
// `module.exports.run()`; mocha provides the `suite`/`test` globals (TDD UI).
const path = require('path');
const Mocha = require('mocha');
const glob = require('glob');

function run() {
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 60000 });
  const testsRoot = path.resolve(__dirname, '.');

  return new Promise((resolve, reject) => {
    glob
      .sync('**/*.test.js', { cwd: testsRoot })
      .forEach((file) => mocha.addFile(path.resolve(testsRoot, file)));

    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} e2e test(s) failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { run };

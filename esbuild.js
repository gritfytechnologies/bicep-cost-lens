// Build script: bundles src/extension.ts (VS Code) and src/cli.ts (pipeline CLI).
// Usage: node esbuild.js [--watch]
const esbuild = require('esbuild');
const { chmodSync } = require('node:fs');

const watch = process.argv.includes('--watch');

const common = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: false,
  minify: true,
};

async function build() {
  await esbuild.build({
    ...common,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    external: ['vscode'],
  });
  await esbuild.build({
    ...common,
    entryPoints: ['src/cli.ts'],
    outfile: 'dist/cli.js',
    banner: { js: '#!/usr/bin/env node' },
  });
  chmodSync('dist/cli.js', 0o755);
  console.log('Built dist/extension.js + dist/cli.js');
}

if (watch) {
  esbuild
    .context({ ...common, entryPoints: ['src/extension.ts'], outfile: 'dist/extension.js', external: ['vscode'] })
    .then((ctx) => ctx.watch())
    .then(() => console.log('Watching src/ ...'))
    .catch(() => process.exit(1));
} else {
  build().catch(() => process.exit(1));
}

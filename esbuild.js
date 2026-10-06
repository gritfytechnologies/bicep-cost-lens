// Build script: bundles src/extension.ts into dist/extension.js with esbuild.
// Usage: node esbuild.js [--watch]
const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: false,
  minify: true,
};

if (watch) {
  esbuild
    .context(options)
    .then((ctx) => ctx.watch())
    .then(() => console.log('Watching src/ ...'))
    .catch(() => process.exit(1));
} else {
  esbuild
    .build(options)
    .then(() => console.log('Built dist/extension.js'))
    .catch(() => process.exit(1));
}

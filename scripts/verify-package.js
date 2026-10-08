// Gate 4 — package verification.
//
// Checks a packaged .vsix the way tonight's Marketplace upload session had
// to by hand: archive integrity (every entry inflates, CRC32 matches),
// manifest identity (publisher / extension id / version / license), the
// archive's package.json agreeing with the repo's, a square PNG icon, and
// the members the listing depends on. Zero dependencies: minimal ZIP
// central-directory reader over node:zlib.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const EXPECTED_FILE = `${pkg.name}-${pkg.version}.vsix`;

// --- CRC32 (IEEE, table-driven) ---
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// --- Minimal ZIP reader ---
function readZip(filePath) {
  const data = fs.readFileSync(filePath);
  // End of central directory: scan the tail for its signature.
  const tailStart = Math.max(0, data.length - 65557);
  let eocd = -1;
  for (let i = data.length - 22; i >= tailStart; i--) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) {
    throw new Error('no end-of-central-directory record — not a ZIP file');
  }
  const count = data.readUInt16LE(eocd + 10);
  let offset = data.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (data.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`central directory entry ${n} has a bad signature`);
    }
    const method = data.readUInt16LE(offset + 10);
    const crc = data.readUInt32LE(offset + 16);
    const compressedSize = data.readUInt32LE(offset + 20);
    const size = data.readUInt32LE(offset + 24);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const localOffset = data.readUInt32LE(offset + 42);
    const name = data.toString('utf8', offset + 46, offset + 46 + nameLength);

    // Local header: skip to the entry data.
    if (data.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`entry ${name}: bad local header signature`);
    }
    const localNameLength = data.readUInt16LE(localOffset + 26);
    const localExtraLength = data.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = data.subarray(dataStart, dataStart + compressedSize);

    let body;
    if (method === 0) {
      body = Buffer.from(compressed);
    } else if (method === 8) {
      body = zlib.inflateRawSync(compressed);
    } else {
      throw new Error(`entry ${name}: unsupported compression method ${method}`);
    }
    if (body.length !== size) {
      throw new Error(`entry ${name}: size mismatch (header ${size}, actual ${body.length})`);
    }
    if (crc32(body) !== crc) {
      throw new Error(`entry ${name}: CRC32 mismatch — archive is corrupt`);
    }
    entries.set(name, body);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function pngDimensions(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, 8).equals(signature)) {
    return null;
  }
  // IHDR follows the signature: length(4) + 'IHDR'(4) + width(4) + height(4).
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function main() {
  const failures = [];
  const ok = (line) => console.log(`  ok  ${line}`);
  const fail = (line) => {
    failures.push(line);
    console.log(`  FAIL ${line}`);
  };

  const vsixPath = path.join(ROOT, EXPECTED_FILE);
  if (!fs.existsSync(vsixPath)) {
    const found = fs.readdirSync(ROOT).filter((f) => f.endsWith('.vsix'));
    console.error(
      `gate:package: ${EXPECTED_FILE} not found (run \`npm run package\` first).` +
        (found.length ? ` Found instead: ${found.join(', ')}` : ''),
    );
    process.exit(1);
  }

  let entries;
  try {
    entries = readZip(vsixPath);
    ok(`${EXPECTED_FILE}: ${entries.size} entries, all inflate + CRC32 verified`);
  } catch (error) {
    console.error(`gate:package: FAIL — archive unreadable: ${error.message}`);
    process.exit(1);
  }

  const required = [
    '[Content_Types].xml',
    'extension.vsixmanifest',
    'extension/package.json',
    'extension/dist/extension.js',
    'extension/dist/cli.js',
    'extension/README.md',
  ];
  for (const member of required) {
    if (entries.has(member)) ok(`member present: ${member}`);
    else fail(`missing member: ${member}`);
  }

  const manifestEntry = entries.get('extension.vsixmanifest');
  if (manifestEntry) {
    const manifest = manifestEntry.toString('utf8');
    // Identity carries the extension's Publisher / Id / Version; the
    // PackageManifest element has its own schema Version="2.0.0", so scope
    // the reads to the Identity tag.
    const identity = /<Identity\b[^>]*>/.exec(manifest)?.[0] ?? '';
    const attr = (name) => new RegExp(`${name}="([^"]+)"`).exec(identity)?.[1];
    if (attr('Publisher') === pkg.publisher) ok(`manifest Publisher = ${pkg.publisher}`);
    else fail(`manifest Publisher = ${attr('Publisher')}, expected ${pkg.publisher}`);
    if (attr('Id') === pkg.name) ok(`manifest Id = ${pkg.name}`);
    else fail(`manifest Id = ${attr('Id')}, expected ${pkg.name}`);
    if (attr('Version') === pkg.version) ok(`manifest Version = ${pkg.version}`);
    else fail(`manifest Version = ${attr('Version')}, expected ${pkg.version}`);
    if (manifest.includes('<License>')) ok('manifest carries a License element');
    else fail('manifest has no License element');
  }

  const packagedEntry = entries.get('extension/package.json');
  if (packagedEntry) {
    const packaged = JSON.parse(packagedEntry.toString('utf8'));
    for (const field of ['name', 'version', 'publisher']) {
      if (packaged[field] === pkg[field]) ok(`packaged package.json ${field} = ${pkg[field]}`);
      else fail(`packaged package.json ${field} = ${packaged[field]}, expected ${pkg[field]}`);
    }
    const iconPath = `extension/${packaged.icon}`;
    const icon = entries.get(iconPath);
    if (!icon) {
      fail(`icon not in archive: ${iconPath}`);
    } else {
      const dims = pngDimensions(icon);
      if (!dims) fail(`${iconPath} is not a PNG`);
      else if (dims.width !== dims.height) fail(`icon is ${dims.width}x${dims.height} — not square`);
      else ok(`icon ${iconPath} is a square PNG (${dims.width}x${dims.height})`);
    }
  }

  if (failures.length > 0) {
    console.error(`\ngate:package: FAIL — ${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log(`\ngate:package: PASS — ${EXPECTED_FILE} is intact and marketplace-shaped.`);
  process.exit(0);
}

main();

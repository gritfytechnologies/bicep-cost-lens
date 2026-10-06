/**
 * Minimal Bicep resource parser.
 *
 * We only need resource declarations (`resource <name> '<type>@<apiVersion>' = { ... }`)
 * plus a few body fields (sku name, VM size, location). This is intentionally a
 * lightweight regex + brace-matching parser, not a full Bicep grammar — it must
 * never crash on real-world files, it just skips what it cannot understand.
 */
import type { BicepResource } from './types';

const RESOURCE_DECLARATION =
  /^[ \t]*resource[ \t]+([A-Za-z_][\w]*)[ \t]+'([^']+)'/gm;

const QUOTED_FIELD = (field: string): RegExp =>
  new RegExp(`${field}\\s*:\\s*'([^']+)'`);

const SKU_BLOCK = /sku\s*:\s*\{([^}]*)\}/s;

/**
 * Extract the `{ ... }` body starting at the opening brace at `openIndex`.
 * Returns the body text (without outer braces), or undefined if unbalanced.
 */
function extractBody(text: string, openIndex: number): string | undefined {
  let depth = 0;
  let inString = false;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" && text[i - 1] !== '\\') {
      inString = !inString;
    }
    if (inString) {
      continue;
    }
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(openIndex + 1, i);
      }
    }
  }
  return undefined;
}

function splitTypeAndVersion(typeString: string): {
  resourceType: string;
  apiVersion: string;
} {
  const at = typeString.lastIndexOf('@');
  if (at === -1) {
    return { resourceType: typeString, apiVersion: '' };
  }
  return {
    resourceType: typeString.slice(0, at),
    apiVersion: typeString.slice(at + 1),
  };
}

function extractSkuName(body: string): string | undefined {
  const block = SKU_BLOCK.exec(body);
  if (!block || block[1] === undefined) {
    return undefined;
  }
  const name = /name\s*:\s*'([^']+)'/.exec(block[1]);
  return name?.[1];
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

/**
 * Parse every resource declaration in a .bicep document.
 * Never throws — unparseable declarations are skipped.
 */
export function parseBicepResources(text: string): BicepResource[] {
  const resources: BicepResource[] = [];
  let match: RegExpExecArray | null;
  RESOURCE_DECLARATION.lastIndex = 0;

  while ((match = RESOURCE_DECLARATION.exec(text)) !== null) {
    try {
      const symbolicName = match[1];
      const typeString = match[2];
      if (symbolicName === undefined || typeString === undefined) {
        continue;
      }
      const { resourceType, apiVersion } = splitTypeAndVersion(typeString);

      const afterDecl = text.indexOf('=', match.index + match[0].length);
      if (afterDecl === -1) {
        continue;
      }
      const openBrace = text.indexOf('{', afterDecl);
      if (openBrace === -1) {
        continue;
      }
      const body = extractBody(text, openBrace);
      if (body === undefined) {
        continue;
      }

      const resource: BicepResource = {
        symbolicName,
        resourceType,
        apiVersion,
        line: lineOf(text, match.index),
      };

      const skuName = extractSkuName(body);
      if (skuName) {
        resource.skuName = skuName;
      }
      const vmSize = QUOTED_FIELD('vmSize').exec(body)?.[1];
      if (vmSize) {
        resource.vmSize = vmSize;
      }
      const location = QUOTED_FIELD('location').exec(body)?.[1];
      if (location) {
        resource.location = location;
      }

      resources.push(resource);
    } catch {
      // Skip declarations we cannot understand; the file still gets partial estimates.
      continue;
    }
  }

  return resources;
}

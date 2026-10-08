/**
 * Pure helpers deciding whether a document counts as a Bicep document.
 *
 * The `bicep` language id comes from Microsoft's Bicep extension; without
 * it, VS Code opens `.bicep` files as plain text. Cost Lens must still work
 * there (install → open a `.bicep` file → first estimate, per the PRD), so
 * document identity is "language id is bicep OR filename ends in
 * `.bicep` / `.bicepparam`". Kept free of the `vscode` import so the logic
 * is unit-tested; callers pass anything shaped like a TextDocument.
 */

/** The slice of a text document these helpers need. */
export interface DocumentLike {
  languageId: string;
  fileName: string;
}

const BICEP_FILENAME = /\.bicep(param)?$/i;

/** True when a filename ends in `.bicep` or `.bicepparam` (any casing). */
export function isBicepFileName(fileName: string): boolean {
  return BICEP_FILENAME.test(fileName);
}

/** True when a document is Bicep by language id or by filename. */
export function isBicepDocument(document: DocumentLike): boolean {
  return document.languageId === 'bicep' || isBicepFileName(document.fileName);
}

/** Which Bicep document a command should act on. */
export type BicepDocumentPick<T extends DocumentLike> =
  | { kind: 'active'; document: T }
  | { kind: 'single'; document: T }
  | { kind: 'multiple'; documents: T[] }
  | { kind: 'none' };

/**
 * Decide which document a command targets: the active document when it is
 * a Bicep document; otherwise the single open Bicep document; otherwise
 * the candidates for a user pick; otherwise nothing.
 */
export function pickBicepDocument<T extends DocumentLike>(
  active: T | undefined,
  open: readonly T[],
): BicepDocumentPick<T> {
  if (active && isBicepDocument(active)) {
    return { kind: 'active', document: active };
  }
  const candidates = open.filter(isBicepDocument);
  const [only] = candidates;
  if (candidates.length === 1 && only) {
    return { kind: 'single', document: only };
  }
  if (candidates.length > 1) {
    return { kind: 'multiple', documents: candidates };
  }
  return { kind: 'none' };
}

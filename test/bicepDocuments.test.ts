import { describe, expect, it } from 'vitest';
import {
  isBicepDocument,
  isBicepFileName,
  pickBicepDocument,
  type DocumentLike,
} from '../src/bicepDocuments';

function doc(overrides: Partial<DocumentLike>): DocumentLike {
  return { languageId: 'plaintext', fileName: '/work/file.txt', ...overrides };
}

describe('isBicepFileName', () => {
  it('matches .bicep and .bicepparam files', () => {
    expect(isBicepFileName('/work/main.bicep')).toBe(true);
    expect(isBicepFileName('/work/params.bicepparam')).toBe(true);
    expect(isBicepFileName('C:\\work\\MAIN.BICEP')).toBe(true);
  });

  it('rejects other filenames', () => {
    expect(isBicepFileName('/work/main.bicep.txt')).toBe(false);
    expect(isBicepFileName('/work/bicep.md')).toBe(false);
    expect(isBicepFileName('/work/main.json')).toBe(false);
  });
});

describe('isBicepDocument', () => {
  it('accepts the bicep language id', () => {
    expect(isBicepDocument(doc({ languageId: 'bicep', fileName: '/work/untitled' }))).toBe(true);
  });

  it('accepts a .bicep filename without the language id (no Bicep extension)', () => {
    expect(isBicepDocument(doc({ languageId: 'plaintext', fileName: '/work/main.bicep' }))).toBe(
      true,
    );
  });

  it('rejects unrelated documents', () => {
    expect(isBicepDocument(doc({}))).toBe(false);
  });
});

describe('pickBicepDocument', () => {
  const bicepA = doc({ fileName: '/work/a.bicep' });
  const bicepB = doc({ fileName: '/work/b.bicep' });
  const notes = doc({ fileName: '/work/notes.txt' });

  it('prefers the active document when it is Bicep', () => {
    expect(pickBicepDocument(bicepA, [bicepA, bicepB])).toEqual({
      kind: 'active',
      document: bicepA,
    });
  });

  it('falls back to the single open Bicep document when the active one is not Bicep', () => {
    expect(pickBicepDocument(notes, [notes, bicepA])).toEqual({
      kind: 'single',
      document: bicepA,
    });
  });

  it('treats an untitled Bicep-language document as active', () => {
    const untitled = doc({ languageId: 'bicep', fileName: 'Untitled-1' });
    expect(pickBicepDocument(untitled, [untitled, bicepA])).toEqual({
      kind: 'active',
      document: untitled,
    });
  });

  it('returns the candidates when several Bicep documents are open', () => {
    expect(pickBicepDocument(notes, [notes, bicepA, bicepB])).toEqual({
      kind: 'multiple',
      documents: [bicepA, bicepB],
    });
  });

  it('returns none when no Bicep document is open', () => {
    expect(pickBicepDocument(notes, [notes])).toEqual({ kind: 'none' });
    expect(pickBicepDocument(undefined, [])).toEqual({ kind: 'none' });
  });
});

import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import type { Extension } from '@codemirror/state';

/**
 * Map active tab filename to CodeMirror language support.
 * GraphQL: no legacy graphql mode in this install — TypeScript-style highlighting is a decent fallback for schema text.
 * Prisma: approximate with JS-like tokenizer (comments/strings/identifiers).
 */
export function getLanguageExtensions(fileName: string): Extension[] {
  const base = fileName.split(/[/\\]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';

  switch (ext) {
    case 'json':
      return [json()];
    case 'sql':
      return [sql()];
    case 'tsx':
      return [javascript({ jsx: true, typescript: true })];
    case 'ts':
    case 'mts':
    case 'cts':
      return [javascript({ jsx: false, typescript: true })];
    case 'jsx':
      return [javascript({ jsx: true, typescript: false })];
    case 'js':
    case 'mjs':
    case 'cjs':
      return [javascript({ jsx: false, typescript: false })];
    case 'prisma':
      return [javascript({ jsx: false, typescript: false })];
    case 'graphql':
    case 'gql':
      return [javascript({ jsx: false, typescript: true })];
    case 'mongodb':
    case 'mongoose':
      return [javascript({ jsx: false, typescript: true })];
    case 'txt':
    default:
      return [javascript({ jsx: false, typescript: true })];
  }
}

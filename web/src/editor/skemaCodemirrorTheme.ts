import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/** Chrome: font, padding, caret, selection — matches .skema-code-inset */
export const skemaEditorChrome = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '13px',
      lineHeight: '1.7',
      fontFamily: "var(--font-mono), 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      backgroundColor: 'transparent',
    },
    '.cm-scroller': {
      fontFamily: 'inherit',
      lineHeight: 'inherit',
      overflow: 'auto',
    },
    '.cm-content': {
      padding: '14px var(--workspace-pad-x)',
      caretColor: 'var(--syntax-keyword)',
      color: 'var(--syntax-default)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--syntax-keyword) !important',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(143, 217, 194, 0.18) !important',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(240, 176, 112, 0.14) !important',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.045)',
    },
    '.cm-placeholder': {
      color: 'var(--syntax-comment)',
      opacity: '0.9',
    },
  },
  { dark: true },
);

/**
 * Uses --syntax-* tokens in index.css so strings / types / keywords read clearly
 * on dark inset (not the flat node kind grays).
 */
const skemaHighlightStyle = HighlightStyle.define(
  [
    { tag: tags.keyword, color: 'var(--syntax-keyword)', fontWeight: '500' },
    { tag: tags.controlKeyword, color: 'var(--syntax-control)', fontWeight: '500' },
    { tag: tags.operatorKeyword, color: 'var(--syntax-keyword)' },
    { tag: tags.definitionKeyword, color: 'var(--syntax-control)' },
    { tag: tags.moduleKeyword, color: 'var(--syntax-namespace)' },
    { tag: tags.self, color: 'var(--syntax-keyword)' },
    { tag: tags.string, color: 'var(--syntax-string)' },
    { tag: tags.docString, color: 'var(--syntax-string-alt)' },
    { tag: tags.character, color: 'var(--syntax-string)' },
    { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
    { tag: tags.lineComment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
    { tag: tags.blockComment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
    { tag: tags.docComment, color: 'var(--syntax-meta)', fontStyle: 'italic' },
    { tag: tags.number, color: 'var(--syntax-number)' },
    { tag: tags.integer, color: 'var(--syntax-number)' },
    { tag: tags.float, color: 'var(--syntax-number)' },
    { tag: tags.bool, color: 'var(--syntax-bool-null)' },
    { tag: tags.null, color: 'var(--syntax-bool-null)' },
    { tag: tags.atom, color: 'var(--syntax-bool-null)' },
    { tag: tags.propertyName, color: 'var(--syntax-property)' },
    { tag: tags.attributeName, color: 'var(--syntax-attribute)' },
    { tag: tags.variableName, color: 'var(--syntax-default)' },
    {
      tag: tags.definition(tags.variableName),
      color: 'var(--syntax-type)',
      fontWeight: '500',
    },
    { tag: tags.typeName, color: 'var(--syntax-type)', fontWeight: '500' },
    { tag: tags.className, color: 'var(--syntax-class)', fontWeight: '500' },
    { tag: tags.namespace, color: 'var(--syntax-namespace)' },
    { tag: tags.meta, color: 'var(--syntax-meta)' },
    { tag: tags.bracket, color: 'var(--syntax-punctuation)' },
    { tag: tags.tagName, color: 'var(--syntax-keyword)' },
    { tag: tags.literal, color: 'var(--syntax-string)' },
    { tag: tags.regexp, color: 'var(--syntax-regex)' },
    { tag: tags.operator, color: 'var(--syntax-operator)' },
    { tag: tags.punctuation, color: 'var(--syntax-punctuation)' },
    { tag: tags.invalid, color: 'var(--syntax-invalid)', fontWeight: '500' },
    { tag: tags.link, color: 'var(--syntax-string)' },
    { tag: tags.url, color: 'var(--syntax-string-alt)', textDecoration: 'underline' },
  ],
  { themeType: 'dark' },
);

export const skemaSyntaxHighlighting = syntaxHighlighting(skemaHighlightStyle);

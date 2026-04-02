/**
 * neuro-dark — Monaco theme aligned with the Neuro Syntax IDE design system.
 *
 * Colour source: neuro-syntax-ide/src/index.css @theme variables
 *   --color-surface-container-lowest: #0a0e14
 *   --color-surface-container:        #1c2026
 *   --color-surface-container-high:   #262a31
 *   --color-primary:                  #a2c9ff
 *   --color-primary-container:        #58a6ff
 *   --color-tertiary:                 #67df70
 *   --color-error:                    #ffb4ab
 *   --color-outline:                  #8b919d
 *   --color-outline-variant:          #414752
 */

import type { editor } from 'monaco-editor';

export const NEURO_DARK_THEME: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // --- Comments ---
    { token: 'comment', foreground: '4a5568', fontStyle: 'italic' },
    { token: 'comment.doc', foreground: '5a6577', fontStyle: 'italic' },

    // --- Keywords ---
    { token: 'keyword', foreground: 'a2c9ff' },
    { token: 'keyword.control', foreground: '7db8ff' },
    { token: 'keyword.operator', foreground: 'a2c9ff' },
    { token: 'keyword.operator.new', foreground: 'a2c9ff' },

    // --- Strings ---
    { token: 'string', foreground: '67df70' },
    { token: 'string.escape', foreground: '8ff09a' },
    { token: 'string.regex', foreground: '5bc460' },

    // --- Numbers ---
    { token: 'number', foreground: 'ffb4ab' },
    { token: 'number.float', foreground: 'ffb4ab' },

    // --- Types & identifiers ---
    { token: 'type', foreground: '7dd3fc' },
    { token: 'type.identifier', foreground: '7dd3fc' },
    { token: 'type.alias', foreground: '93dbfd' },
    { token: 'identifier', foreground: 'dfe2eb' },
    { token: 'identifier.alias', foreground: '7dd3fc' },

    // --- Functions & methods ---
    { token: 'function', foreground: 'c8d8f0' },
    { token: 'function.call', foreground: 'dfe2eb' },

    // --- Variables ---
    { token: 'variable', foreground: 'dfe2eb' },
    { token: 'variable.predefined', foreground: 'a2c9ff' },
    { token: 'variable.other.constant', foreground: 'ffb4ab', fontStyle: 'bold' },

    // --- Operators & punctuation ---
    { token: 'operator', foreground: '8b919d' },
    { token: 'delimiter', foreground: '8b919d' },
    { token: 'delimiter.bracket', foreground: 'a2c9ff' },

    // --- Tags (HTML/JSX) ---
    { token: 'tag', foreground: 'a2c9ff' },
    { token: 'tag.delimiter', foreground: '8b919d' },
    { token: 'attribute.name', foreground: 'c8d8f0' },
    { token: 'attribute.value', foreground: '67df70' },

    // --- Meta / decorators ---
    { token: 'meta', foreground: '8b919d' },
    { token: 'meta.decorator', foreground: 'ffb4ab' },
    { token: 'annotation', foreground: 'ffb4ab' },

    // --- Literals ---
    { token: 'string.literal', foreground: '67df70' },
    { token: 'constant', foreground: 'ffb4ab' },
    { token: 'constant.language', foreground: 'a2c9ff' },
    { token: 'constant.escape', foreground: '8ff09a' },

    // --- Markdown ---
    { token: 'keyword.md', foreground: 'a2c9ff' },
    { token: 'string.md', foreground: '67df70' },
    { token: 'variable.md', foreground: 'ffb4ab' },

    // --- YAML / TOML ---
    { token: 'type.yaml', foreground: 'a2c9ff' },
    { token: 'string.yaml', foreground: '67df70' },
  ],
  colors: {
    // --- Editor background & foreground ---
    'editor.background': '#0a0e14',
    'editor.foreground': '#dfe2eb',

    // --- Line highlighting ---
    'editor.lineHighlightBackground': '#1c2026',
    'editor.lineHighlightBorder': '#262a3100', // transparent border

    // --- Line numbers ---
    'editorLineNumber.foreground': '#414752',
    'editorLineNumber.activeForeground': '#8b919d',

    // --- Selection ---
    'editor.selectionBackground': '#58a6ff30',
    'editor.inactiveSelectionBackground': '#58a6ff15',
    'editor.selectionHighlightBackground': '#58a6ff18',

    // --- Cursor ---
    'editorCursor.foreground': '#a2c9ff',
    'editorCursor.background': '#0a0e14',

    // --- Word highlight ---
    'editor.wordHighlightBackground': '#58a6ff20',
    'editor.wordHighlightStrongBackground': '#58a6ff35',

    // --- Find / replace ---
    'editor.findMatchBackground': '#58a6ff35',
    'editor.findMatchHighlightBackground': '#58a6ff18',
    'editor.findRangeHighlightBackground': '#262a3150',

    // --- Bracket matching ---
    'editorBracketMatch.background': '#58a6ff20',
    'editorBracketMatch.border': '#a2c9ff60',

    // --- Overview ruler (right gutter) ---
    'editorOverviewRuler.background': '#0a0e14',
    'editorOverviewRuler.border': '#1c202600',

    // --- Scrollbar ---
    'scrollbarSlider.background': '#41475240',
    'scrollbarSlider.hoverBackground': '#41475270',
    'scrollbarSlider.activeBackground': '#41475290',

    // --- Minimap ---
    'minimap.background': '#0a0e14',
    'minimapSlider.background': '#41475240',
    'minimapSlider.hoverBackground': '#41475270',

    // --- Indent guides ---
    'editorIndentGuide.background': '#262a31',
    'editorIndentGuide.activeBackground': '#414752',

    // --- Folding ---
    'editorGutter.foldingControlForeground': '#8b919d',

    // --- Code lens ---
    'editorCodeLens.foreground': '#8b919d',

    // --- Suggestions / IntelliSense ---
    'editorSuggestWidget.background': '#1c2026',
    'editorSuggestWidget.border': '#262a31',
    'editorSuggestWidget.foreground': '#dfe2eb',
    'editorSuggestWidget.selectedBackground': '#262a31',
    'editorSuggestWidget.highlightForeground': '#a2c9ff',

    // --- Peek view ---
    'peekViewEditor.background': '#0a0e14',
    'peekViewResult.background': '#1c2026',
    'peekViewResult.selectionBackground': '#262a31',

    // --- Breadcrumbs ---
    'breadcrumbPickerWidget.background': '#1c2026',

    // --- Widget (hover) ---
    'editorWidget.background': '#1c2026',
    'editorWidget.border': '#262a31',

    // --- Error / warning squiggles ---
    'editorError.foreground': '#ffb4ab',
    'editorWarning.foreground': '#ffd666',

    // --- Diff editor ---
    'editorGutter.modifiedBackground': '#58a6ff20',
    'editorGutter.addedBackground': '#67df7020',
    'editorGutter.deletedBackground': '#ffb4ab20',

    // --- Git decorations in gutter ---
    'editorGutter.commentRangeForeground': '#414752',

    // --- Current search match ---
    'editor.findMatchBorder': '#a2c9ff50',

    // --- Range highlight ---
    'editor.rangeHighlightBackground': '#58a6ff12',
  },
};

/**
 * Neuro Syntax IDE — Monaco themes (dark + light).
 *
 * Colour source: neuro-syntax-ide/src/index.css CSS custom properties
 */

import type { editor } from 'monaco-editor';

// ===========================================================================
// Dark theme
// ===========================================================================

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
    'editor.background': '#0a0a0a',
    'editor.foreground': '#dfe2eb',
    'editor.lineHighlightBackground': '#1a1a1a',
    'editor.lineHighlightBorder': '#25252500',
    'editorLineNumber.foreground': '#333333',
    'editorLineNumber.activeForeground': '#8b919d',
    'editor.selectionBackground': '#58a6ff30',
    'editor.inactiveSelectionBackground': '#58a6ff15',
    'editor.selectionHighlightBackground': '#58a6ff18',
    'editorCursor.foreground': '#a2c9ff',
    'editorCursor.background': '#0a0a0a',
    'editor.wordHighlightBackground': '#58a6ff20',
    'editor.wordHighlightStrongBackground': '#58a6ff35',
    'editor.findMatchBackground': '#58a6ff35',
    'editor.findMatchHighlightBackground': '#58a6ff18',
    'editor.findRangeHighlightBackground': '#25252550',
    'editorBracketMatch.background': '#58a6ff20',
    'editorBracketMatch.border': '#a2c9ff60',
    'editorOverviewRuler.background': '#0a0a0a',
    'editorOverviewRuler.border': '#1a1a1a00',
    'scrollbarSlider.background': '#33333340',
    'scrollbarSlider.hoverBackground': '#33333370',
    'scrollbarSlider.activeBackground': '#33333390',
    'minimap.background': '#0a0a0a',
    'minimapSlider.background': '#33333340',
    'minimapSlider.hoverBackground': '#33333370',
    'editorIndentGuide.background': '#252525',
    'editorIndentGuide.activeBackground': '#333333',
    'editorGutter.foldingControlForeground': '#8b919d',
    'editorCodeLens.foreground': '#8b919d',
    'editorSuggestWidget.background': '#1a1a1a',
    'editorSuggestWidget.border': '#252525',
    'editorSuggestWidget.foreground': '#dfe2eb',
    'editorSuggestWidget.selectedBackground': '#252525',
    'editorSuggestWidget.highlightForeground': '#a2c9ff',
    'peekViewEditor.background': '#0a0a0a',
    'peekViewResult.background': '#1a1a1a',
    'peekViewResult.selectionBackground': '#252525',
    'breadcrumbPickerWidget.background': '#1a1a1a',
    'editorWidget.background': '#1a1a1a',
    'editorWidget.border': '#252525',
    'editorError.foreground': '#ffb4ab',
    'editorWarning.foreground': '#ffd666',
    'editorGutter.modifiedBackground': '#58a6ff20',
    'editorGutter.addedBackground': '#67df7020',
    'editorGutter.deletedBackground': '#ffb4ab20',
    'editorGutter.commentRangeForeground': '#333333',
    'editor.findMatchBorder': '#a2c9ff50',
    'editor.rangeHighlightBackground': '#58a6ff12',
  },
};

// ===========================================================================
// Light theme
// ===========================================================================

export const NEURO_LIGHT_THEME: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    // --- Comments ---
    { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
    { token: 'comment.doc', foreground: '5f6368', fontStyle: 'italic' },

    // --- Keywords ---
    { token: 'keyword', foreground: '0b57d0' },
    { token: 'keyword.control', foreground: '1a73e8' },
    { token: 'keyword.operator', foreground: '0b57d0' },
    { token: 'keyword.operator.new', foreground: '0b57d0' },

    // --- Strings ---
    { token: 'string', foreground: '1b7d34' },
    { token: 'string.escape', foreground: '2e8b47' },
    { token: 'string.regex', foreground: '1b7d34' },

    // --- Numbers ---
    { token: 'number', foreground: 'ba1a1a' },
    { token: 'number.float', foreground: 'ba1a1a' },

    // --- Types & identifiers ---
    { token: 'type', foreground: '0b57d0' },
    { token: 'type.identifier', foreground: '0b57d0' },
    { token: 'type.alias', foreground: '1a73e8' },
    { token: 'identifier', foreground: '1a1c1e' },
    { token: 'identifier.alias', foreground: '0b57d0' },

    // --- Functions & methods ---
    { token: 'function', foreground: '3c4043' },
    { token: 'function.call', foreground: '1a1c1e' },

    // --- Variables ---
    { token: 'variable', foreground: '1a1c1e' },
    { token: 'variable.predefined', foreground: '0b57d0' },
    { token: 'variable.other.constant', foreground: 'ba1a1a', fontStyle: 'bold' },

    // --- Operators & punctuation ---
    { token: 'operator', foreground: '5f6368' },
    { token: 'delimiter', foreground: '5f6368' },
    { token: 'delimiter.bracket', foreground: '0b57d0' },

    // --- Tags (HTML/JSX) ---
    { token: 'tag', foreground: '0b57d0' },
    { token: 'tag.delimiter', foreground: '5f6368' },
    { token: 'attribute.name', foreground: '3c4043' },
    { token: 'attribute.value', foreground: '1b7d34' },

    // --- Meta / decorators ---
    { token: 'meta', foreground: '5f6368' },
    { token: 'meta.decorator', foreground: 'ba1a1a' },
    { token: 'annotation', foreground: 'ba1a1a' },

    // --- Literals ---
    { token: 'string.literal', foreground: '1b7d34' },
    { token: 'constant', foreground: 'ba1a1a' },
    { token: 'constant.language', foreground: '0b57d0' },
    { token: 'constant.escape', foreground: '2e8b47' },

    // --- Markdown ---
    { token: 'keyword.md', foreground: '0b57d0' },
    { token: 'string.md', foreground: '1b7d34' },
    { token: 'variable.md', foreground: 'ba1a1a' },

    // --- YAML / TOML ---
    { token: 'type.yaml', foreground: '0b57d0' },
    { token: 'string.yaml', foreground: '1b7d34' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1a1c1e',
    'editor.lineHighlightBackground': '#f1f3f5',
    'editor.lineHighlightBorder': '#e9ecef00',
    'editorLineNumber.foreground': '#9ca3af',
    'editorLineNumber.activeForeground': '#5f6368',
    'editor.selectionBackground': '#0b57d025',
    'editor.inactiveSelectionBackground': '#0b57d010',
    'editor.selectionHighlightBackground': '#0b57d012',
    'editorCursor.foreground': '#0b57d0',
    'editorCursor.background': '#ffffff',
    'editor.wordHighlightBackground': '#0b57d015',
    'editor.wordHighlightStrongBackground': '#0b57d025',
    'editor.findMatchBackground': '#0b57d025',
    'editor.findMatchHighlightBackground': '#0b57d012',
    'editor.findRangeHighlightBackground': '#dee2e650',
    'editorBracketMatch.background': '#0b57d015',
    'editorBracketMatch.border': '#0b57d040',
    'editorOverviewRuler.background': '#ffffff',
    'editorOverviewRuler.border': '#e9ecef00',
    'scrollbarSlider.background': '#c4c6d040',
    'scrollbarSlider.hoverBackground': '#c4c6d070',
    'scrollbarSlider.activeBackground': '#c4c6d090',
    'minimap.background': '#ffffff',
    'minimapSlider.background': '#c4c6d040',
    'minimapSlider.hoverBackground': '#c4c6d070',
    'editorIndentGuide.background': '#e9ecef',
    'editorIndentGuide.activeBackground': '#c4c6d0',
    'editorGutter.foldingControlForeground': '#5f6368',
    'editorCodeLens.foreground': '#5f6368',
    'editorSuggestWidget.background': '#ffffff',
    'editorSuggestWidget.border': '#dee2e6',
    'editorSuggestWidget.foreground': '#1a1c1e',
    'editorSuggestWidget.selectedBackground': '#f1f3f5',
    'editorSuggestWidget.highlightForeground': '#0b57d0',
    'peekViewEditor.background': '#ffffff',
    'peekViewResult.background': '#f8f9fa',
    'peekViewResult.selectionBackground': '#e9ecef',
    'breadcrumbPickerWidget.background': '#f8f9fa',
    'editorWidget.background': '#ffffff',
    'editorWidget.border': '#dee2e6',
    'editorError.foreground': '#ba1a1a',
    'editorWarning.foreground': '#b45309',
    'editorGutter.modifiedBackground': '#0b57d018',
    'editorGutter.addedBackground': '#1b7d3418',
    'editorGutter.deletedBackground': '#ba1a1a18',
    'editorGutter.commentRangeForeground': '#c4c6d0',
    'editor.findMatchBorder': '#0b57d040',
    'editor.rangeHighlightBackground': '#0b57d010',
  },
};

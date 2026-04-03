/**
 * Vue Single File Component language support for Monaco Editor.
 *
 * Provides a Monarch tokenizer that recognises the three top-level blocks
 * (<template>, <script>, <style>) and applies appropriate highlighting
 * for Vue directives, interpolation expressions, and structural tags.
 *
 * Register via `registerVueLanguage(monaco)` during `beforeMount`.
 */

import type { languages } from 'monaco-editor';

// ---------------------------------------------------------------------------
// Monarch tokenizer definition
// ---------------------------------------------------------------------------

export const VUE_MONARCH_LANGUAGE: languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.vue',

  // -- HTML-like keywords for the structural tags ----------------------------
  keywords: [
    'template', 'script', 'style',
  ],

  // -- Vue directive attributes ---------------------------------------------
  vueDirectives: [
    'v-if', 'v-else', 'v-else-if', 'v-for', 'v-model',
    'v-on', 'v-bind', 'v-slot', 'v-show', 'v-text', 'v-html',
    'v-pre', 'v-cloak', 'v-once', 'v-memo',
  ],

  // Shorthand directives
  shorthandDirectives: [
    '@', ':', '#',
  ],

  tokenizer: {
    root: [
      // --- Interpolation {{ ... }} ---
      [/\{\{/, { token: 'punctuation.definition.interpolation.vue', next: '@interpolation' }],

      // --- HTML comments ---
      [/<!--/, 'comment', '@comment'],

      // --- Top-level block tags ---
      [/(<\/?)(template|script|style)(\s*>|\s+)/, [
        { token: 'tag.delimiter' },
        { token: 'entity.name.tag.vue' },
        { token: 'tag.delimiter' },
      ]],
      [/(<\/?)(template|script|style)(>)/, [
        { token: 'tag.delimiter' },
        { token: 'entity.name.tag.vue' },
        { token: 'tag.delimiter' },
      ]],

      // --- Vue directives in tags ---
      [/\b(v-if|v-else|v-else-if|v-for|v-model|v-on|v-bind|v-slot|v-show|v-text|v-html|v-pre|v-cloak|v-once|v-memo)\b/, 'support.directive.vue'],
      [/v-on:/, 'support.directive.vue'],
      [/v-bind:/, 'support.directive.vue'],
      [/v-slot:/, 'support.directive.vue'],

      // --- Shorthand directives ---
      [/(\s)@([\w-]+)/, 'support.directive.vue'],
      [/(\s):([\w-]+)/, 'support.directive.vue'],
      [/(#)([\w-]+)/, 'support.directive.vue'],

      // --- Script content block (between <script>...</script>) ---
      [/<script[^>]*>/, { token: 'tag', next: '@scriptContent', nextEmbedded: 'javascript' }],

      // --- Style content block ---
      [/<style[^>]*>/, { token: 'tag', next: '@styleContent', nextEmbedded: 'css' }],

      // --- HTML tags ---
      [/<\/?/, { token: 'tag.delimiter', next: '@tag' }],

      // --- Strings outside tags ---
      [/"/, 'string', '@stringDouble'],
      [/'/, 'string', '@stringSingle'],
    ],

    interpolation: [
      [/\}\}/, { token: 'punctuation.definition.interpolation.vue', next: '@pop' }],
      [/\{/, { token: 'delimiter.bracket', next: '@interpolation' }],
      [/\}/, { token: 'delimiter.bracket' }],
      // JS-like tokens inside interpolation
      [/\b(true|false|null|undefined)\b/, 'constant.language'],
      [/\b(this)\b/, 'variable.language'],
      [/[a-zA-Z_]\w*/, 'variable'],
      [/\d+(\.\d+)?/, 'number'],
      [/[+\-*/%]/, 'keyword.operator'],
    ],

    comment: [
      [/-->/, 'comment', '@pop'],
      [/[^-]+/, 'comment'],
      [/./, 'comment'],
    ],

    tag: [
      [/[ \t\r\n]+/, ''],
      // Vue directives
      [/\b(v-if|v-else|v-else-if|v-for|v-model|v-on|v-bind|v-slot|v-show|v-text|v-html|v-pre|v-cloak|v-once|v-memo)\b/, 'support.directive.vue'],
      [/v-on:/, 'support.directive.vue'],
      [/v-bind:/, 'support.directive.vue'],
      [/v-slot:/, 'support.directive.vue'],
      // Shorthand directives
      [/(@)([\w-]+)/, 'support.directive.vue'],
      [/(:)([\w-]+)/, 'support.directive.vue'],
      [/(#)([\w-]+)/, 'support.directive.vue'],
      // Attribute name
      [/[a-zA-Z_][\w-]*/, 'attribute.name'],
      // = sign
      [/=/, 'delimiter'],
      // Strings
      [/"/, 'string', '@stringDouble'],
      [/'/, 'string', '@stringSingle'],
      // Close tag
      [/\/?>/, { token: 'tag.delimiter', next: '@pop' }],
    ],

    scriptContent: [
      [/<\/script>/, { token: 'tag', next: '@pop', nextEmbedded: '@pop' }],
      [/[^<]+/, ''],
      [/<(?!\/script)/, ''],
    ],

    styleContent: [
      [/<\/style>/, { token: 'tag', next: '@pop', nextEmbedded: '@pop' }],
      [/[^<]+/, ''],
      [/<(?!\/style)/, ''],
    ],

    stringDouble: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],

    stringSingle: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop'],
    ],
  },
};

// ---------------------------------------------------------------------------
// Registration helper
// ---------------------------------------------------------------------------

let _vueRegistered = false;

/**
 * Register the Vue language with Monaco Editor.
 * Call this in `beforeMount` exactly once.
 */
export function registerVueLanguage(
  monaco: Parameters<
    NonNullable<Parameters<typeof import('@monaco-editor/react').default>[0]['beforeMount']>
  >[0],
): void {
  if (_vueRegistered) return;

  // Register the language id
  monaco.languages.register({ id: 'vue' });

  // Set Monarch tokens provider
  monaco.languages.setMonarchTokensProvider('vue', VUE_MONARCH_LANGUAGE as any);

  // Configure language defaults (completion, etc. are out of scope;
  // we only provide tokenization)
  monaco.languages.setLanguageConfiguration('vue', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{{', '}}'],
      ['<', '>'],
      ['{', '}'],
      ['(', ')'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '<', close: '>' },
    ],
    surroundingPairs: [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '<', close: '>' },
    ],
  });

  _vueRegistered = true;
}

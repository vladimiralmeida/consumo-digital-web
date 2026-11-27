'use strict';

const js = require('@eslint/js');
const globals = require('globals');

const regras = {
  ...js.configs.recommended.rules,
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-var': 'off',
  'prefer-const': 'error',
  'no-console': ['error', { allow: ['error', 'log'] }],
  'max-depth': ['error', 4],
  complexity: ['warn', 15]
};

module.exports = [
  { ignores: ['node_modules/', 'data/'] },
  { files: ['server/**/*.js', 'test/**/*.js', 'eslint.config.js'], languageOptions: { sourceType: 'commonjs', globals: globals.node }, rules: regras },
  { files: ['assets/js/**/*.js'], languageOptions: { sourceType: 'module', globals: globals.browser }, rules: { ...regras, 'no-console': 'error' } },
  { files: ['assets/data.js', 'assets/dominio.js'], languageOptions: { sourceType: 'script', globals: { ...globals.browser, module: 'writable' } }, rules: regras }
];

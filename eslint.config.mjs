import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

// Flat config for Quasar v2 + Vue 3 + TypeScript.
// Scope is intentionally correctness, not formatting: the codebase predates any
// linting, so we use vue's `essential` (Priority A: error prevention) rather
// than `recommended` (which would force a full template-formatting rewrite).
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.quasar/**',
      'node_modules/**',
      'public/**',
      'src-pwa/custom-service-worker.ts',
      '**/*.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],

  // TypeScript inside <script setup> blocks.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Allow deliberately-unused args when prefixed with _ (event handlers, etc.).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // The SSR middlewares and value scripts legitimately use `any` at the
      // boundary of untyped external JSON; keep it visible as a warning.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)

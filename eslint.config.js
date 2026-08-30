import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'vite.config.d.ts',
    ],
  },

  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', '*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],

    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },

    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
      },
    },

    rules: {
      ...reactHooks.configs.recommended.rules,

      'react-hooks/set-state-in-effect': 'off',

      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  {
    files: ['scripts/**/*.mjs'],

    extends: [js.configs.recommended],

    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },

  prettier,
);

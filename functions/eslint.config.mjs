import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'quotes': ['error', 'single'],
      'object-curly-spacing': ['error', 'always'],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }]
    },
  },
  {
    files: ['*.config.mjs', 'migrations/**/*.ts', 'tests/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    ignores: ['lib/**/*', 'node_modules/**/*'],
  }
);

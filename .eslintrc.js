module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json', // Use main tsconfig instead of eslint one
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended', // Only use built-in ESLint rules - this always works
  ],
  rules: {
    // Disable conflicting base rules
    'no-unused-vars': 'off',
    'no-undef': 'off', // TypeScript handles this better
    'no-redeclare': 'off',
    'no-use-before-define': 'off',

    // Enable TypeScript-specific rules manually (no presets needed)
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/no-inferrable-types': 'error',

    // Basic code quality rules
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
  },
  env: {
    node: true,
    es6: true,
    jest: true,
  },
  overrides: [
    // More relaxed rules for test files
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
    // More relaxed for config files
    {
      files: ['*.config.js', '*.config.ts', 'jest.config.js', 'scripts/**/*'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: [
    'lib/',
    'dist/',
    'node_modules/',
    '*.js',
    '*.d.ts',
    'coverage/',
    'docs/',
    'examples/',
    '.eslintcache',
  ],
};

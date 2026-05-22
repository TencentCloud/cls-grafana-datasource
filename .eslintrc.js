module.exports = {
  extends: [
    'eslint-config-tencent',
    'eslint-config-tencent/ts',
    'eslint-config-tencent/prettier',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/typescript',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.eslint.json'],
    tsconfigRootDir: '.',
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      pragma: 'React',
      version: '17',
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['./tsconfig.eslint.json'],
      },
    },
  },
  env: {
    browser: true,
    es6: true,
    amd: true,
    jquery: true,
    jest: true,
  },
  globals: {
    seajs: false,
    process: false,
  },
  plugins: ['@typescript-eslint', 'import', 'prettier', 'react', 'react-hooks'],

  overrides: [
    {
      files: ['*.js', 'toolkit/**/*.js'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'import/order': 'off',
        'prettier/prettier': 'off',
      },
    },
    {
      files: ['src/log-service/common/format/ConvertSearchResultsToDataFrame.ts'],
      rules: {
        'prettier/prettier': 'off',
      },
    },
  ],
  rules: {
    'react/display-name': 'warn',
    'react/prop-types': 'off',
    '@typescript-eslint/class-literal-property-style': 'off',
    '@typescript-eslint/member-ordering': 'off',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    // 增加 react-use 相关 hooks提示
    // @reference https://github.com/streamich/react-use/issues/1703
    'react-hooks/exhaustive-deps': [
      'warn',
      {
        additionalHooks:
          '^use(Async|AsyncFn|AsyncRetry|Debounce|UpdateEffect|IsomorphicLayoutEffect|DeepCompareEffect|ShallowCompareEffect)$',
      },
    ],
  },
};

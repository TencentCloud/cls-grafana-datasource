module.exports = {
  extends: [
    'eslint-config-tencent',
    'eslint-config-tencent/ts',
    'eslint-config-tencent/prettier',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  settings: {
    react: {
      pragma: 'React',
      version: '17',
    }
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
  plugins: ['import', 'prettier', 'react', 'react-hooks'],
  rules: {
    'react/display-name': 'warn',
    'react/prop-types': 'off',
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

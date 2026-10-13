// 모노레포 전체 ESLint 10 flat config.
// - apps/web: eslint-config-next(core-web-vitals + typescript) + jsx-a11y recommended 규칙
// - apps/admin, packages/*: typescript-eslint + react-hooks + jsx-a11y recommended
// eslint-config-next가 끌어오는 jsx-a11y/react/import 플러그인은 peer가 ESLint 9까지라서
// 루트 package.json overrides로 ESLint 10에 맞추고, 옛 규칙 API는 @eslint/compat으로 감쌉니다.
// 해당 플러그인이 ESLint 10을 공식 지원하면 overrides와 fixupConfigRules를 걷어냅니다.
import { fixupConfigRules } from '@eslint/compat';
import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const WEB_DIR = 'apps/web';
const WEB_FILES = [`${WEB_DIR}/**/*.{js,jsx,mjs,ts,tsx,mts,cts}`];
const NON_WEB_IGNORES = [`${WEB_DIR}/**`];

// next 설정 객체를 apps/web 파일에만 적용되도록 범위를 좁히는 함수.
// ignores만 있는 전역 무시 객체는 아래 전역 ignores가 대신하므로 버립니다.
function scopeToWeb(configs) {
  return configs
    .filter((config) => !(Object.keys(config).length === 1 && config.ignores))
    .map((config) => ({
      ...config,
      files: config.files ? config.files.map((pattern) => `${WEB_DIR}/${pattern}`) : WEB_FILES,
    }));
}

// Next 앱이 아닌 곳에 적용할 설정 객체의 범위를 지정하는 함수
function scopeToNonWeb(configs, files) {
  return configs.map((config) => ({
    ...config,
    files: config.files ?? files,
    ignores: [...(config.ignores ?? []), ...NON_WEB_IGNORES],
  }));
}

const restrictMockImports = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['@eum/api/mock/*', '@eum/api/mock'],
          message:
            '목 데이터는 @eum/api 내부 전용입니다. createApi()가 반환하는 함수로 조회하세요.',
        },
      ],
    },
  ],
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/out/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },

  // apps/web — Next.js
  ...fixupConfigRules(scopeToWeb([...nextVitals, ...nextTs])),
  {
    files: WEB_FILES,
    settings: { next: { rootDir: WEB_DIR } },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      ...restrictMockImports,
    },
  },

  // apps/admin, packages/*, 루트 설정 파일 — TypeScript + React
  ...scopeToNonWeb(tseslint.configs.recommended, ['**/*.{ts,tsx,mts,cts}']),
  ...scopeToNonWeb([reactHooks.configs.flat.recommended], ['**/*.{jsx,tsx}']),
  ...scopeToNonWeb(fixupConfigRules([jsxA11y.flatConfigs.recommended]), ['**/*.{jsx,tsx}']),
  {
    files: ['apps/admin/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['apps/admin/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    rules: restrictMockImports,
  },

  // 공통 규칙
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];

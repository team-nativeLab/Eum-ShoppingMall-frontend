# Eum-ShoppingMall-frontend

이음산업건설 쇼핑몰의 구매자용 Web과 관리자용 Admin을 한 저장소에서 개발하는 프론트엔드 모노레포입니다.

## 목차
- [개요](#개요)
- [기술 스택](#기술-스택)
- [요구 환경](#요구-환경)
- [시작하기](#시작하기)
- [스크립트](#스크립트)
- [프로젝트 구조](#프로젝트-구조)
- [목 API와 환경변수](#목-api와-환경변수)
- [디자인 토큰](#디자인-토큰)
- [비즈니스 규칙](#비즈니스-규칙)
- [테스트와 CI](#테스트와-ci)
- [브랜치 전략](#브랜치-전략)
- [진행 단계](#진행-단계)
- [보안 제보](#보안-제보)

## 개요
이음산업건설 쇼핑몰(산업 안전용품 온라인 쇼핑몰)의 hi-fi 디자인을 실제로 동작하는 프론트엔드로 구현합니다.
npm workspaces 모노레포로 구성되며, 두 앱이 디자인 토큰·공통 컴포넌트(`@eum/ui`)와 타입·API 레이어(`@eum/api`)를 함께 씁니다.

- **Web** (`apps/web`): 구매자용 쇼핑몰. 데스크톱(1440) 디자인과, 모바일 디자인이 있는 일부 화면(메인, 상품 상세)의 모바일웹(390) 디자인을 함께 대응합니다. 스타일은 모바일 우선으로 작성합니다([디자인 토큰](#디자인-토큰) 참고).
- **Admin** (`apps/admin`): 상품·카테고리·견적 문의·주문·회원을 관리하는 관리자 SPA. 데스크톱만 대응합니다.

서버 API는 아직 연결되지 않았습니다. 화면과 로그인은 `packages/api`의 목 API·목 인증으로 동작하며, 상품명·가격·이름·전화번호처럼 서버에서 와야 할 값은 화면 코드에 하드코딩하지 않습니다. 실제 API와 실제 인증(`real` 모드)은 현재 스텁입니다.

## 기술 스택
| 영역 | 사용 기술 |
|---|---|
| 언어 | TypeScript ~6.0 |
| UI | React 19 |
| Web | Next.js 16 (App Router) |
| Admin | Vite 8 SPA + React Router 8 |
| 스타일 | Tailwind CSS v4 (web: `@tailwindcss/postcss`, admin: `@tailwindcss/vite`), Pretendard 폰트, lucide-react 아이콘 |
| 서버 상태 | TanStack Query v5 |
| 단위 테스트 | Vitest 5, Testing Library, jsdom |
| E2E | Playwright |
| 품질 | ESLint 10 (flat config), Prettier 3 + `prettier-plugin-tailwindcss` |
| 패키지 관리 | npm workspaces (`packageManager: npm@11.12.1`) |

## 요구 환경
- Node.js **24.15.0 이상** (`.nvmrc`: `24.15.0`, `package.json` `engines.node: >=24.15.0`)
- npm **11** (`packageManager: npm@11.12.1`). 락파일은 `package-lock.json`이며 pnpm·yarn·bun은 쓰지 않습니다.

```bash
nvm use   # .nvmrc 기준 Node 24.15.0
```

## 시작하기
### 1. 설치
```bash
git clone https://github.com/team-nativeLab/Eum-ShoppingMall-frontend.git
cd Eum-ShoppingMall-frontend
npm ci
```

### 2. 환경변수
루트 `.env.example`에 앱별 변수와 규칙이 정리되어 있습니다. 해당 부분을 복사해 앱별 `.env.local`을 만듭니다. `.env*` 파일은 `.env.example`을 빼고 커밋하지 않습니다.

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_MODE=mock
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
NEXT_PUBLIC_MOCK_SCENARIO=normal

# apps/admin/.env.local
VITE_API_MODE=mock
VITE_API_BASE_URL=http://localhost:8080/api
VITE_MOCK_SCENARIO=normal
VITE_WEB_BASE_URL=http://localhost:3000
```

> `NEXT_PUBLIC_*`, `VITE_*` 변수는 브라우저 번들에 포함되므로 비밀값을 넣지 않습니다.
> 개발 서버에서는 모드 값이 비어 있으면 자동으로 `mock`이 쓰입니다. 자세한 규칙은 [목 API와 환경변수](#목-api와-환경변수)를 참고하세요.

### 3. 개발 서버 실행
```bash
npm run dev:web     # Web   → http://localhost:3000 (Next.js 기본 포트)
npm run dev:admin   # Admin → http://localhost:5173 (strictPort)
```

- Admin 포트는 `apps/admin/vite.config.ts`에 고정되어 있습니다(dev `5173`, preview `4173`, `strictPort: true` — 포트가 사용 중이면 다른 포트로 넘어가지 않고 실패합니다).
- Web 포트는 별도 설정 없이 Next.js 기본값(3000)을 씁니다. Playwright 설정도 `http://localhost:3000`을 기준으로 합니다.

## 스크립트
루트에서 실행합니다.

| 명령 | 설명 |
|---|---|
| `npm run dev:web` | Web 개발 서버 (`next dev`) |
| `npm run dev:admin` | Admin 개발 서버 (`vite`) |
| `npm run build` | Web → Admin 순서로 빌드 (`scripts/build-all.mjs`). 로컬에서 API 모드를 지정하지 않으면 **목 모드 검증 빌드(배포용 아님)**, CI(`CI=true`)에서는 모드 미지정 시 실패 — [빌드와 배포](#빌드와-배포) 참고 |
| `npm run build:web` | Web만 빌드 (`next build`, 배포 env 검증 적용) |
| `npm run build:admin` | Admin만 빌드 (`vite build`, 배포 env 검증 적용) |
| `npm run typecheck` | 루트 설정 파일 + 모든 워크스페이스 타입 검사 (web은 `next typegen` 포함) |
| `npm run lint` | ESLint 검사 |
| `npm run lint:fix` | ESLint 자동 수정 |
| `npm run format` | Prettier로 전체 포맷 |
| `npm run format:check` | Prettier 포맷 검사 |
| `npm run test` | Vitest 단위 테스트 1회 실행 |
| `npm run test:watch` | Vitest watch 모드 |
| `npm run test:e2e` | Playwright E2E (아래 [E2E](#e2e-playwright) 참고) |

워크스페이스 전용 스크립트: `apps/web`의 `start`(`next start`), `typegen`(`next typegen`), `apps/admin`의 `preview`(`vite preview`). 예: `npm run preview --workspace @eum/admin`

## 프로젝트 구조
```
Eum-ShoppingMall-frontend/
├── apps/
│   ├── web/                     # @eum/web — Next.js App Router 구매자 쇼핑몰
│   │   └── src/
│   │       ├── app/             # layout, page, providers, globals.css
│   │       ├── components/      # site-header, site-footer, cart-link, page-container
│   │       ├── features/        # 기능 단위 코드 (cart, products)
│   │       └── lib/             # api-config.ts(env 검증), shop-api.ts, member-auth.ts
│   └── admin/                   # @eum/admin — Vite + React Router 관리자 SPA
│       └── src/
│           ├── components/      # AdminSidebar, AdminTopBar
│           ├── layouts/         # AdminLayout
│           ├── pages/           # LoginPage, PlaceholderPage, NotFoundPage
│           ├── lib/             # api-config.ts(env 검증), shop-api.ts, admin-auth.ts
│           └── routes.tsx       # 관리자 라우트 정의
├── packages/
│   ├── ui/                      # @eum/ui — 디자인 토큰(tokens.css) + 공통 컴포넌트
│   │   └── src/
│   │       ├── tokens.css
│   │       ├── components/      # Button, TextField, Checkbox, Modal, Pagination 등
│   │       └── lib/             # cx, pagination
│   └── api/                     # @eum/api — 타입, 목 API, mock/real 전환
│       └── src/
│           ├── config.ts        # 환경변수 검증 → ApiConfig
│           ├── shop-api.ts      # ShopApi 인터페이스
│           ├── mock-api.ts      # 목 구현 (createMockApi)
│           ├── real-api.ts      # 실제 API 스텁 (createRealApi, NOT_IMPLEMENTED)
│           ├── mock/            # 목 데이터 (패키지 내부 전용)
│           ├── price.ts         # 금액 표시 규칙
│           ├── cart.ts          # 장바구니 그룹·합계 규칙
│           ├── auth.ts          # 인증 클라이언트 타입 + real 인증 스텁 (NOT_IMPLEMENTED)
│           ├── mock-auth.ts     # 개발용 목 인증 스텁
│           └── types.ts, errors.ts, query-keys.ts, redirect.ts, quote-status.ts
├── e2e/                         # Playwright 스펙 (web.*.spec.ts, admin.*.spec.ts)
├── test/                        # Vitest 공통 setup (jest-dom, 정리)
├── scripts/build-all.mjs        # 루트 npm run build (목 모드 검증 빌드 기본값)
├── .github/
│   ├── workflows/ci.yml
│   └── dependabot.yml           # npm·GitHub Actions 주간 업데이트 PR
├── .env.example                 # 환경변수 이름과 규칙
├── SECURITY.md                  # 보안 취약점 제보 정책
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.mjs
└── tsconfig.base.json
```

워크스페이스 패키지(`@eum/ui`, `@eum/api`)는 빌드 없이 TypeScript 소스로 배포되며, Web은 `next.config.ts`의 `transpilePackages`로 함께 변환합니다. 두 앱 모두 `@/`가 각 앱의 `src`를 가리킵니다.

## 목 API와 환경변수
화면은 각 앱의 `src/lib/shop-api.ts`의 `getShopApi()`가 돌려주는 `ShopApi`(`@eum/api/shop-api` 인터페이스)로만 데이터를 조회합니다. 이 함수가 설정에 따라 `createMockApi()`(`@eum/api/mock-api`) 또는 `createRealApi()`(`@eum/api/real-api`)를 고릅니다. `mock`과 `real` 구현이 같은 인터페이스를 따르므로, 실제 API가 준비되면 화면 코드를 바꾸지 않고 모드만 전환합니다. 목 구현은 동적 import로 불러와 `real` 모드 번들에 목 데이터가 들어가지 않게 합니다.

`packages/api`는 환경변수를 직접 읽지 않습니다. 각 앱의 `src/lib/api-config.ts`와 빌드 설정(`next.config.ts`, `vite.config.ts`)이 자기 환경변수를 읽어 `resolveApiConfig()`에 넘깁니다.

| 용도 | Web (`apps/web`) | Admin (`apps/admin`) | 값 |
|---|---|---|---|
| API 모드 | `NEXT_PUBLIC_API_MODE` | `VITE_API_MODE` | `mock` 또는 `real` |
| 실제 API 주소 | `NEXT_PUBLIC_API_BASE_URL` | `VITE_API_BASE_URL` | `real` 모드에서 필수 |
| 목 응답 시나리오 | `NEXT_PUBLIC_MOCK_SCENARIO` | `VITE_MOCK_SCENARIO` | `normal`(기본), `empty`, `error` |
| 운영 빌드 목 허용 | `NEXT_PUBLIC_ALLOW_MOCK_IN_PRODUCTION` | `VITE_ALLOW_MOCK_IN_PRODUCTION` | `true`일 때만 인정 |
| 쇼핑몰 보기 링크 | — | `VITE_WEB_BASE_URL` | Admin TopBar "쇼핑몰 보기" 링크 주소. 비우면 링크를 숨김 |

모든 변수는 `.env.example`에 문서화되어 있습니다(`ALLOW_MOCK_IN_PRODUCTION`은 주석 처리된 예시). `MOCK_SCENARIO`를 `empty`/`error`로 바꾸면 빈 상태·에러 화면을 재현할 수 있습니다.

### 모드 결정 규칙 (`packages/api/src/config.ts`)
- 앱 진입점(`apps/*/src/lib/api-config.ts`)과 빌드 설정(`apps/web/next.config.ts`, `apps/admin/vite.config.ts`)이 같은 `resolveApiConfig()`로 검증합니다.
- 런타임(`resolveApiConfig()`)에서는 모드가 비어 있으면 **개발에서는 `mock`, 운영에서는 `real`** 로 봅니다. 단, 운영 빌드 시점 검사(`assertBuildApiEnv()`)는 모드 생략을 허용하지 않습니다([빌드와 배포](#빌드와-배포) 참고).
- **운영 빌드에서 `mock`은 차단됩니다.** `ALLOW_MOCK_IN_PRODUCTION=true`를 명시했을 때만 허용합니다(목 데이터가 실수로 배포되는 것을 막기 위함).
- `real` 모드에는 공백이 아닌 `API_BASE_URL`이 필요합니다. `real` 모드에서는 `MOCK_SCENARIO` 값을 검사하지 않습니다.
- `mock`/`real`, `normal`/`empty`/`error` 외의 값은 조용히 넘어가지 않고 `ApiConfigError`를 던집니다.
- 개발 서버에서는 설정 오류가 첫 조회에서 드러나며, 화면은 에러 상태를 보여 줍니다. 운영 빌드에서는 아래처럼 빌드 단계에서 먼저 실패합니다.
- 목 API·목 인증 팩토리도 `assertMockAllowed()`로 같은 조건을 한 번 더 확인합니다.

### 빌드와 배포
- **루트 `npm run build`는 검증용입니다.** `scripts/build-all.mjs`가 Web → Admin 순서로 빌드합니다.
  - 로컬에서 `NEXT_PUBLIC_API_MODE`/`VITE_API_MODE`가 없으면 해당 앱에 `mock` + `ALLOW_MOCK_IN_PRODUCTION=true`를 넣어 **목 모드 검증 빌드(배포용 아님)** 로 진행하고 경고를 출력합니다.
  - **CI(`CI=true`)에서는 모드가 없으면 기본값을 넣지 않고 실패합니다.** 워크플로 env에 `*_API_MODE`를 명시해야 합니다.
  - 모드를 지정하면(빈 문자열 포함) 그 값을 그대로 넘기며, 검사는 각 앱 빌드 설정이 합니다. 빈 문자열은 아래 규칙에 따라 앱 빌드에서 실패합니다.
- **배포는 앱별 빌드 명령과 배포 환경변수로 합니다.** 루트의 `build:web`/`build:admin`은 각각 `npm run build -w @eum/web`, `npm run build -w @eum/admin`과 같습니다. 예:

  ```bash
  NEXT_PUBLIC_API_MODE=real NEXT_PUBLIC_API_BASE_URL=https://YOUR_API_HOST/api npm run build -w @eum/web
  VITE_API_MODE=real VITE_API_BASE_URL=https://YOUR_API_HOST/api npm run build -w @eum/admin
  ```

- 운영 빌드는 빌드 시점에 `assertBuildApiEnv()`(`packages/api/src/config.ts`)로 API 설정을 검사해, 아래 경우 **빌드를 실패시킵니다**.
  - `*_API_MODE`가 없거나 공백일 때 (운영 빌드는 모드를 **반드시 명시**해야 함. 배포는 `real`)
  - `mock`인데 `*_ALLOW_MOCK_IN_PRODUCTION=true`가 없을 때
  - `real`인데 `*_API_BASE_URL`이 없거나 공백일 때
- 검사 시점: Web은 `next build`(`next typegen` 제외), Admin은 `vite build`면 `--mode`와 무관하게(예: `--mode staging`) 항상 검사합니다. Admin의 운영 여부는 `NODE_ENV`(없으면 `production`) 기준입니다.
- 각 앱의 `src/lib/shop-api.ts`·인증 로더는 빌드 때 치환되는 모드 상수로 분기하므로, `real`로 빌드하면 목 구현·목 데이터·목 인증 chunk가 산출물에서 제외됩니다.
- 현재 `real` API와 인증은 스텁이라 `real` 빌드 산출물은 조회 시 `NOT_IMPLEMENTED` 오류를 냅니다. 실제 배포 대상·배포 환경은 확인 필요입니다.

### 목 데이터 접근 제한
`packages/api/src/mock/*`는 패키지 내부 전용입니다. 앱과 `packages/ui`에서 `@eum/api/mock`을 import하면 ESLint(`no-restricted-imports`) 오류가 납니다. 반드시 `getShopApi()`가 돌려주는 `ShopApi`로 조회합니다.

### 인증
인증도 API 모드에 연결되어 있습니다. `@eum/api/auth`가 회원·관리자 인증 클라이언트 인터페이스(`login`, `logout`, `getCurrentUser`)를 정의하고, 각 앱의 로더(`apps/web/src/lib/member-auth.ts`, `apps/admin/src/lib/admin-auth.ts`)가 `mock` 모드면 `@eum/api/mock-auth`를 동적 import하고 그 외에는 real 인증(`createRealMemberAuth`/`createRealAdminAuth`)을 씁니다. real 인증은 아직 미구현 스텁으로 `NOT_IMPLEMENTED` 오류를 냅니다.

- `@eum/api/mock-auth`는 개발·검증용 스텁입니다. 비밀번호를 검증·저장하지 않고 토큰도 만들지 않으며, 어떤 목 계정으로 로그인했는지(userId)만 저장합니다. 운영 빌드에서 허용 플래그 없이 만들면 `ApiConfigError`로 거부됩니다.
- 일반 회원과 관리자는 별개의 인증 클라이언트·세션(저장 키, 계정 목록)을 씁니다.
- **화면의 로그인 확인·라우트 가드는 UX를 위한 것이며, 실제 인가는 서버가 한다는 전제입니다.** 실제 연동은 HttpOnly 쿠키 세션을 전제로 하며, 토큰을 `localStorage`처럼 스크립트가 읽는 저장소에 두지 않습니다.
- 로그인 후 `?redirect=` 값은 `sanitizeRedirectPath()`로 같은 사이트 안의 경로만 허용합니다.

## 디자인 토큰
토큰은 `packages/ui/src/tokens.css`의 Tailwind v4 `@theme`에 정의되어 있고, 두 앱의 전역 CSS가 이를 import합니다.

```css
@import 'tailwindcss';
@import '@eum/ui/tokens.css';
```

**Tailwind 기본 팔레트·텍스트 크기·반경·그림자는 꺼져 있고(`initial`) 프로젝트 토큰만 쓸 수 있습니다.**

| 종류 | 사용법 |
|---|---|
| 간격 | `--spacing: 1px`이라 **숫자 유틸리티가 곧 px**입니다. `p-16` = 16px, `gap-24` = 24px. 허용 값은 `2·4·6·8·12·16·20·24·32·40·48·64·80·120`이며, 목록 밖 값은 가장 가까운 토큰으로 맞춥니다. 예외는 아래 참고 |
| 색 | `bg-bg`, `bg-surface`, `text-text-1`, `text-text-2`, `border-line`, `bg-danger`, `bg-success-tint` 등 26개 (`--color-*`) |
| 반경 | `rounded-4`(체크박스·상태 배지), `rounded-6`(카드 이미지), `rounded-8`(버튼·입력·스테퍼·상품카드), `rounded-12`(섹션 박스·패널·배너·토스트), `rounded-capsule`(검색바·히어로 CTA·칩) |
| 텍스트 | `text-display`, `text-h1`~`text-h3`, `text-title`, `text-body-l`/`-m`/`-s`, `text-label-*`, `text-caption`, `text-price-l`/`-m`, `text-web-*` 등. 크기·행간·자간·굵기가 함께 적용됩니다. |
| 그림자 | `shadow-1`, `shadow-2`, `shadow-3` |
| 컨테이너 | `max-w-web`(1296px), `max-w-admin-content`(1136px) |
| 포커스 | `focus-ring`, `focus-ring-danger` (`:focus-visible`에만 2px 외곽선) |
| 브레이크포인트 | `mweb`(390, `24.375rem`) 추가. Tailwind 기본 `sm`~`2xl`은 그대로 |

- **간격 예외**: 공통 컴포넌트 자체가 쓰는 값이라 그대로 둔 컴포넌트 고유 값이 있습니다.
  - `14` — TextField·SelectField 안쪽 좌우 여백, 선택 아이콘 위치(`right-14`), Chip·NoticeInline 좌우 여백
  - `10` — RemovableChip 오른쪽 여백, Toast 아이콘 간격, NoticeInline(전체 폭) 위아래 여백
  - 너비·높이·크기(`w`/`h`/`size`)는 컴포넌트 치수라 간격 규칙 대상이 아닙니다(예: 버튼 `h-56`).
- **브레이크포인트**: 모바일 우선입니다. 기본 스타일이 모바일웹(390) 디자인이고, 데스크톱(1440) 디자인은 `lg`(1024) 이상에 적용합니다. 390보다 좁은 기기만 따로 다룰 때 `max-mweb:`을 씁니다.

- 폰트는 Pretendard(Variable)입니다.
- 클래스 조합은 `@eum/ui/lib/cx`의 `cx()`를 쓰며, Prettier가 `cx()` 안의 Tailwind 클래스도 정렬합니다.
- 공통 컴포넌트는 `@eum/ui/components/<이름>`으로 import합니다. 예: `import { Button } from '@eum/ui/components/Button'` (컴포넌트별 export 이름은 각 파일에서 확인하세요.)

## 비즈니스 규칙
화면이 공유하는 규칙은 `packages/api`에 순수 함수로 두고 단위 테스트로 검증합니다.

- **금액 표시 토글** (`price.ts`): 상품마다 관리자가 금액 표시/미표시(`priceVisible`)를 정하며, 가격 값과는 독립입니다.
  - 표시: 가격을 `₩12,000` 형식으로 보여 주고 구매할 수 있습니다. `₩0`도 그대로 표시합니다.
  - 미표시: 가격 자리에 **"구매 불가"** 를 표시합니다. 보기·찜·장바구니 담기만 가능하고 바로 구매는 할 수 없습니다.
  - `canBuyNow()`는 금액 표시이면서 재고가 있을 때만 `true`, `canAddToCart()`는 품절만 막습니다.
- **장바구니** (`cart.ts`): 금액 미표시 상품과 품절 상품은 **'주문할 수 없는 상품'** 그룹으로 분리되고 합계에서 빠집니다. 수량은 1~999로 제한합니다(상한은 임시 값).
- **회원**: **비회원 주문은 없습니다.** 관리자 계정과 일반 회원은 분리되어 있습니다.
- **문구**: 구매자에게 보이는 문구는 합니다체로 씁니다.

## 테스트와 CI
### 단위 테스트 (Vitest)
`vitest.config.ts`가 워크스페이스별 project를 나눠 실행합니다.

| project | 환경 | 대상 |
|---|---|---|
| `api` | node | `packages/api/src/**/*.test.ts` |
| `ui` | jsdom | `packages/ui/src/**/*.test.{ts,tsx}` |
| `web` | jsdom | `apps/web/src/**/*.test.{ts,tsx}` |
| `admin` | jsdom | `apps/admin/src/**/*.test.{ts,tsx}` |

jsdom 프로젝트는 `test/setup-dom.ts`에서 jest-dom 매처를 등록하고 테스트마다 렌더 결과와 `localStorage`를 정리합니다. 특정 project만 돌리려면 `npx vitest run --project api`처럼 실행합니다.

### E2E (Playwright)
- 브라우저를 먼저 설치합니다: `npx playwright install chromium`
- `npm run test:e2e`는 `dev:web`(3000)과 `dev:admin`(5173)을 자동으로 띄우고(로컬에서는 이미 떠 있는 서버를 재사용) 아래 project를 실행합니다.

| project | 대상 스펙 | 뷰포트 |
|---|---|---|
| `web-desktop` | `e2e/web.*.spec.ts` | 1440×900 |
| `web-mobile` | `e2e/web.*.spec.ts` | 390×844 (모바일·터치) |
| `admin-desktop` | `e2e/admin.*.spec.ts` | 1440×900 |

### 린트 규칙 요약 (`eslint.config.mjs`)
- `apps/web`: `eslint-config-next`(core-web-vitals, typescript) + jsx-a11y recommended
- `apps/admin`, `packages/*`: typescript-eslint recommended + react-hooks + jsx-a11y recommended
- 공통: `no-explicit-any`, `consistent-type-imports`, 미사용 변수 오류(`_` 접두사는 예외), 목 데이터 직접 import 금지

단위 테스트는 `packages/api`의 비즈니스 규칙·설정·목 API·목 인증·redirect, `packages/ui` 공통 컴포넌트·페이지네이션, Web 장바구니 상태·저장소를 다룹니다. Admin(`apps/admin`)에는 아직 단위 테스트 파일이 없습니다.

### CI (`.github/workflows/ci.yml`)
`dev`, `main` 브랜치에 대한 push와 pull request에서 실행됩니다. `.nvmrc`의 Node 버전으로 아래를 순서대로 검사합니다.

1. `npm ci`
2. `npm audit --omit=dev --audit-level=high` (운영 의존성에 high 이상 취약점이 있으면 실패)
3. `npm run typecheck`
4. `npm run lint`
5. `npm run format:check`
6. `npm run test`
7. `npm run build` (잡 env로 `*_API_MODE=mock`, `*_ALLOW_MOCK_IN_PRODUCTION=true`를 지정한 **목 모드 검증 빌드**, 배포 빌드 아님)

- 공식 액션(`checkout`, `setup-node`, `cache`)은 태그 대신 커밋 SHA로 고정합니다. 권한은 `contents: read`이고, checkout은 자격 증명을 남기지 않습니다.
- Next.js 빌드 캐시(`apps/web/.next/cache`)를 재사용합니다.
- E2E는 CI 기본 잡에서 실행하지 않습니다. 같은 브랜치·PR에 새 실행이 오면 이전 실행은 취소됩니다.

### 의존성 업데이트 (`.github/dependabot.yml`)
npm과 GitHub Actions를 주간으로 확인해 업데이트 PR을 엽니다. 새 버전이 나온 뒤 일정 기간(cooldown)을 기다리며, npm minor·patch 업데이트는 한 PR로 묶습니다.

## 브랜치 전략
- 원격 저장소의 기본 브랜치는 `dev`이고, `main`과 함께 CI 대상입니다. (예전에 클론한 로컬은 `git remote set-head origin -a`로 `origin/HEAD`를 갱신할 수 있습니다.)
- 이슈를 먼저 만들고, `feature/#<이슈번호>-<요약>` 브랜치에서 작업한 뒤 `dev`로 PR을 엽니다. 예: `feature/#1-monorepo-setup`
- 한 단계(아래 진행 단계)마다 이슈 하나, PR 하나를 냅니다.
- PR 전에 `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run build`를 통과시킵니다.

## 진행 단계
전체 화면(Web 39개, Admin 11개)을 6단계로 나눠 구현하고 단계마다 검증합니다.

| 단계 | 범위 | 주요 화면 |
|---|---|---|
| 1단계 | 모노레포 기반 구축 | 워크스페이스, 디자인 토큰, 공통 컴포넌트, 목 API, 테스트·CI, Web/Admin 골격 |
| 2단계 | Web 공통 레이아웃 + 탐색 | GNB·Footer, 메인(데스크톱·모바일), 카테고리 상품목록, 상품 상세(금액 미표시 포함), 검색 결과, 전체메뉴 |
| 3단계 | 구매·인증 | 장바구니(금액 미표시 혼합 포함), 주문(배송지·결제·완료), 로그인, 회원가입 |
| 4단계 | 마이페이지 | 주문/배송 조회, 취소/반품/교환, 찜, 최근 본 상품, 쿠폰, 적립금, 내 정보, 배송지, 견적 문의 내역 |
| 5단계 | 회사소개·견적문의·고객지원 | 회사소개, 견적문의(안전 솔루션), 공지사항, FAQ, 1:1 문의 |
| 6단계 | 관리자(Admin) | 로그인, 대시보드, 상품 목록·등록·수정, 카테고리, 견적 문의, 주문, 회원 관리 |

현재 Admin의 대부분 라우트(`apps/admin/src/routes.tsx`)는 6단계에서 실제 화면으로 바꿀 자리표시(`PlaceholderPage`)입니다. 단계별 완료 여부는 GitHub 이슈와 PR에서 확인합니다.

## 보안 제보
보안 취약점은 공개 이슈로 올리지 말고 GitHub의 비공개 취약점 제보(저장소 **Security** 탭 → **Report a vulnerability**)를 이용해 주십시오. 제보 절차와 지원 범위는 [SECURITY.md](SECURITY.md)를 참고하세요.

## 라이선스
라이선스 미정 (확인 필요)

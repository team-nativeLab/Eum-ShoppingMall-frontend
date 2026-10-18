# Web/Admin 기능 호환성 — 작업 인계

기준일: 2026-10-19

## 현재 상태

- 이슈: [#89](https://github.com/team-nativeLab/Eum-ShoppingMall-frontend/issues/89) — OPEN
- 브랜치: `feature/#89-admin-web-parity`
- Worktree: `/private/tmp/eum-admin-web-parity-89`
- 범위: 전체 Admin 화면과 구매자 Web 흐름의 프론트엔드 mock 연결. 실제 API/DB, 실서비스 인증/인가, 환불/택배 처리는 미구현.

## 완료 내용

- 상품·카테고리·브랜드·홈 편성·이벤트·공지·FAQ·문의·리뷰·주문·클레임·견적·회원·적립금·배송/할인·회사/정책·쿠폰 운영 화면을 추가/보완했습니다.
- 같은 ShopApi mock 인스턴스 안에서 상품/SKU, 주문/배송, 쿠폰/적립금/배송비, 견적, 클레임 및 운영 콘텐츠의 구매자 표시와 Admin 편집·응답을 연결했습니다.
- 회원별 mock 조회, 주문/클레임/반품 수량 검증, 주문 취소 재고·포인트·쿠폰 복원, 내부 정보 구매자 projection 제외를 반영했습니다.
- Admin/Web은 별도 프로세스에서 각자의 mock 메모리를 사용하므로 저장 상태가 프로세스 사이에서 공유되지 않습니다.

## 검증

- `npm test` — PASS, 75 files / 626 tests
- `npm run lint` — PASS
- `npm run typecheck` — PASS
- Admin mock production build — PASS (500KB 이상 chunk 경고)
- Web `npx next build --webpack` — PASS; 기본 Turbopack은 sandbox worker port bind 권한 문제로 대체했습니다.
- `git diff --check` — PASS
- Browser QA: Admin 핵심 화면을 1440×1000으로 확인. 모바일/좁은 화면과 키보드 접근성은 미검증.
- 보안 리뷰: Critical 없음. `.env.production`의 mock 허용과 브라우저에서 변경 가능한 mock 회원 세션은 실제 인증이 아니므로 실데이터와 함께 운영하면 안 됩니다.

## 남은 작업

- 실제 API/DB와 서버 측 관리자 역할 및 회원 소유권 검증을 연결합니다.
- Admin과 Web의 별도 실행 프로세스 사이 저장 상태 공유를 위한 영속 API를 구현합니다.
- 실제 환불/회수/택배 연동과 서버 쿠폰 속도 제한을 구현합니다.
- 변경은 아직 커밋/PR하지 않았습니다. GitHub workflow 진행은 사용자 요청 후 위임합니다.

현재 프론트엔드 mock 구현에는 미해결 질문이 없습니다.

---

# 전역 메뉴 팝업 개선 — 작업 인계

기준일: 2026-10-16

## 현재 상태

- 이슈: [#50 전역 메뉴 팝업 레이아웃 및 애니메이션 개선](https://github.com/team-nativeLab/Eum-ShoppingMall-frontend/issues/50) — OPEN
- PR: [#53 전역 메뉴 팝업 및 애니메이션 개선](https://github.com/team-nativeLab/Eum-ShoppingMall-frontend/pull/53) — Draft, 미병합
- 브랜치: `feature/#50-web-global-menu-popup-animation`
- Worktree: `/private/tmp/eum-worktree-50`

## 완료 내용

- 전체 메뉴 팝업을 viewport 정중앙에 고정하고, 데스크톱 좌우 24px·모바일 16px 여백과 최대 폭 1200px을 적용했습니다.
- 화면 높이에 맞춘 최대 높이와 내부 스크롤을 유지합니다.
- 팝업 shell 전체가 열릴 때 아래로, 닫힐 때 위로 이동합니다. 다섯 대표 카테고리는 별도로 부드럽게 접고 펼칩니다.
- 활성 링크의 초록색 배경은 제거하고 초록색 텍스트·밑줄과 `aria-current`는 유지합니다.
- 상단의 “전체 메뉴” 제목과 하단 고객센터·이용 안내 행은 제거했습니다. 고객지원 카테고리는 유지합니다.

## 검증

- `npx vitest run --project web apps/web/src/components/site-header-navigation.test.tsx` — PASS, 29 tests
- `npm run typecheck -w @eum/web` — PASS
- `npx eslint apps/web/src/components/site-header.tsx apps/web/src/components/site-header-navigation.test.tsx` — PASS
- `npx prettier --check apps/web/src/components/site-header.tsx apps/web/src/components/site-header-navigation.test.tsx` — PASS
- `git diff --check` — PASS
- Browser QA: 1440×1000 데스크톱 중심 `(720, 500)`, 390×300 모바일 중심 `(195, 150)`; 페이지 스크롤 후에도 중심 유지, 모바일 내부 스크롤, 활성 링크 배경 투명, 진입·종료 방향 확인.
- GitHub CI의 typecheck·lint·test·build 및 Web real-mode build, Vercel preview checks — PASS. E2E workflow는 SKIPPED.
- 전체 테스트와 전체 빌드는 로컬에서 별도로 실행하지 않았습니다.

## 남은 작업

- PR #53의 리뷰와 피드백을 처리합니다.
- 저장소 GitHub 규칙에 따라 사용자가 요청한 뒤 Draft를 Ready로 바꾸거나 병합합니다.
- 병합 후 이슈 #50 종료와 CI 상태를 확인하고 전용 worktree를 정리합니다.

현재 구현 관련 미해결 질문은 없습니다.

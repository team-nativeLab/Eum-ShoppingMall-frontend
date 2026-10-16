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

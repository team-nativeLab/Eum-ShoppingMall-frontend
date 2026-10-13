# Web browse E2E plan

## Capability

- Open the home page at 1440px and 390px and verify the hero, category navigation, and featured product area render.
- Open a category route and verify category context and product cards render from the mock API.
- Open a visible and a hidden-price product detail. The hidden-price product must show `구매 불가` and keep the immediate purchase action unavailable.
- Search for a matching term and a term without results; verify suggestions/results and the empty state.
- Open and close the all-menu overlay using its keyboard-accessible controls.
- Capture each Web E2E viewport in Playwright artifacts for manual Figma comparison.

## Regression

- Existing admin layout E2E stays available to local runs; the manual workflow selects only Web desktop and mobile projects.
- Cart storage stays ID + quantity + option only; its migration and latest-product restore rules are covered by Vitest tests.
- Hidden-price projection, filters, and sorting remain covered by API unit tests.

## Gates

- `npm run test:e2e -- --project=web-desktop --project=web-mobile`
- GitHub Actions `workflow_dispatch` stores `playwright-report/` and `test-results/` artifacts.
- Manual visual comparison uses the screenshots from Web desktop and mobile projects against Figma.

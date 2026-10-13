import { expect, test } from '@playwright/test';

// 가로 넘침 회귀 확인 대상 화면(목 데이터 기준 경로)
const PAGE_PATHS = [
  '/',
  '/category/personal-protective-equipment',
  '/products/prd-1001',
  '/products/prd-1003',
  '/search?q=%EC%95%88%EC%A0%84%EB%AA%A8',
  '/search?q=%EC%97%86%EB%8A%94%EC%83%81%ED%92%88%EA%B2%80%EC%83%89%EC%96%B4',
];

// 데스크톱 프로젝트는 1024·1280·1440, 모바일 프로젝트는 390에서 확인합니다.
const DESKTOP_WIDTHS = [1024, 1280, 1440];

for (const pagePath of PAGE_PATHS) {
  test(`${pagePath} 화면은 가로로 넘치지 않습니다`, async ({ page }, testInfo) => {
    const viewportWidths = testInfo.project.name === 'web-mobile' ? [390] : DESKTOP_WIDTHS;
    for (const viewportWidth of viewportWidths) {
      await page.setViewportSize({ width: viewportWidth, height: 900 });
      await page.goto(pagePath);
      await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
      const pageWidths = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(pageWidths.scrollWidth, `${viewportWidth}px`).toBeLessThanOrEqual(
        pageWidths.innerWidth,
      );
    }
  });
}

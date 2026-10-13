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

// 데스크톱 프로젝트는 1024·1280·1440, 모바일 프로젝트는 360·390에서 확인합니다.
const DESKTOP_WIDTHS = [1024, 1280, 1440];
const MOBILE_WIDTHS = [360, 390];

for (const pagePath of PAGE_PATHS) {
  test(`${pagePath} 화면은 가로로 넘치지 않습니다`, async ({ page }, testInfo) => {
    const viewportWidths = testInfo.project.name === 'web-mobile' ? MOBILE_WIDTHS : DESKTOP_WIDTHS;
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
      // 보이는 버튼 안에서 글자가 넘치거나 잘리지 않는지 확인합니다(줄임표 처리된 글자도 넘침으로 봅니다).
      const overflowingButtons = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('button, button *')]
          .filter((element) => element.offsetParent !== null && element.clientWidth > 0)
          .filter((element) => element.scrollWidth > element.clientWidth + 1)
          .map((element) => element.closest('button')?.textContent?.trim() ?? element.tagName),
      );
      expect(overflowingButtons, `${viewportWidth}px 버튼 내부 넘침`).toEqual([]);
    }
  });
}

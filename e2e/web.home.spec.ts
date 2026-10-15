import { expect, test } from '@playwright/test';

test('홈은 히어로, 카테고리, 베스트 상품을 보여 줍니다', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '베스트 셀러' })).toBeVisible();
  await expect(page.getByRole('link', { name: '개인보호장비' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'ABS 안전모 (내관 조절형)', exact: true }),
  ).toBeVisible();

  const pageFitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(pageFitsViewport).toBe(true);
});

test('전체 메뉴는 X 버튼으로 닫을 수 있습니다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '전체 메뉴 열기' }).click();

  const allMenu = page.getByRole('navigation', { name: '전체 메뉴' });
  await expect(allMenu).toBeVisible();
  await expect(allMenu.getByRole('region', { name: '제품' })).toBeVisible();

  await allMenu.getByRole('button', { name: '전체 메뉴 닫기' }).click();
  await expect(allMenu).toBeHidden();
});

import { expect, test } from '@playwright/test';

test('관리자 레이아웃: 사이드바 활성 메뉴와 화면 제목', async ({ page }) => {
  await page.goto('/products');
  const adminMenu = page.getByRole('navigation', { name: '관리자 메뉴' });
  await expect(adminMenu.getByRole('link', { name: '상품 관리' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { level: 1, name: '상품 목록' })).toBeVisible();
});

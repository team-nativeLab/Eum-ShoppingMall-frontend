import { expect, test } from '@playwright/test';

test('홈 자리표시와 목 상품 미리보기가 보입니다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '상품 미리보기' })).toBeVisible();
  await expect(page.getByText('구매 불가').first()).toBeVisible();
});

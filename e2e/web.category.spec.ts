import { expect, test } from '@playwright/test';

test('카테고리 화면은 하위 상품과 필터·정렬 UI를 표시합니다', async ({ page }) => {
  await page.goto('/category/personal-protective-equipment');

  await expect(page.getByRole('heading', { name: '개인보호장비' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'ABS 안전모 (내관 조절형) 상세 보기' }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: '정렬' })).toBeVisible();

  const soldOutFilter = page.getByRole('checkbox', { name: '품절 상품 제외' });
  if (!(await soldOutFilter.isVisible())) await page.getByRole('button', { name: '필터' }).click();
  await soldOutFilter.check();
  await expect(page.getByText('품절 상품 제외').first()).toBeVisible();
});

import { expect, test } from '@playwright/test';

test('검색 자동완성에서 상품을 열고 전체 검색 결과로 이동합니다', async ({ page }) => {
  await page.goto('/');
  const searchInput = page.getByRole('searchbox', { name: '상품 검색' });
  if (!(await searchInput.isVisible()))
    await page.getByRole('button', { name: '검색 열기' }).click();

  await searchInput.fill('안전모');
  await expect(page.getByRole('list', { name: '검색 자동완성' })).toBeVisible();
  await expect(page.getByRole('button', { name: /ABS 안전모/ })).toBeVisible();
  await page.getByRole('button', { name: '검색 결과 전체 보기' }).click();

  await expect(page).toHaveURL(/\/search\?q=%EC%95%88%EC%A0%84%EB%AA%A8/);
  await expect(page.getByRole('heading', { name: /검색 결과/ })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'ABS 안전모 (내관 조절형) 상세 보기' }),
  ).toBeVisible();
});

test('검색 결과가 없으면 대체 탐색 카테고리를 보여 줍니다', async ({ page }) => {
  await page.goto('/search?q=없는상품검색어');

  await expect(page.getByText(/검색 결과가 없습니다/)).toBeVisible();
  await expect(page.getByText('상품 카테고리 둘러보기')).toBeVisible();
  await expect(page.getByRole('link', { name: '개인보호장비' })).toBeVisible();
});

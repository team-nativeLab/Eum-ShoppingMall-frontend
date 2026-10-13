import { expect, test } from '@playwright/test';

test('검색 자동완성에서 상품을 열고 전체 검색 결과로 이동합니다', async ({ page }) => {
  await page.goto('/');
  const searchInput = page.getByRole('combobox', { name: '상품 검색' });
  if (!(await searchInput.isVisible()))
    await page.getByRole('button', { name: '검색 열기' }).click();

  await searchInput.fill('안전모');
  await expect(page.getByRole('listbox', { name: '검색 자동완성' })).toBeVisible();
  await expect(searchInput).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('option', { name: /ABS 안전모/ })).toBeVisible();
  await page.getByRole('button', { name: '검색 결과 전체 보기' }).click();

  await expect(page).toHaveURL(/\/search\?q=%EC%95%88%EC%A0%84%EB%AA%A8/);
  await expect(page.getByRole('heading', { name: /검색 결과/ })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'ABS 안전모 (내관 조절형)', exact: true }),
  ).toBeVisible();
});

test('검색 결과가 없으면 사이드바 없이 추천 검색어와 추천 상품을 보여 줍니다', async ({ page }) => {
  await page.goto('/search?q=없는상품검색어');

  await expect(
    page.getByRole('heading', { name: '‘없는상품검색어’에 대한 검색 결과가 없습니다' }),
  ).toBeVisible();
  await expect(page.getByRole('complementary', { name: '상품 필터' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '전체 상품 보기' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '추천 검색어' })).toBeVisible();
  await expect(page.getByRole('link', { name: '안전모', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '추천 상품' })).toBeVisible();
});

test('검색 결과 칩은 결과가 있는 카테고리와 개수를 보여 주고, 헤더 검색창에 검색어를 채웁니다', async ({
  page,
}) => {
  await page.goto('/search?q=%EC%95%88%EC%A0%84%EB%AA%A8');
  const categoryChips = page.getByRole('group', { name: '검색 결과 카테고리' });
  await expect(categoryChips.getByRole('button', { name: /^전체 \d+$/ })).toBeVisible();
  await expect(categoryChips.getByRole('button', { name: /^개인보호장비 \d+$/ })).toBeVisible();
  await expect(categoryChips.getByRole('button', { name: /소방/ })).toHaveCount(0);

  const searchInput = page.getByRole('combobox', { name: '상품 검색' });
  if (!(await searchInput.isVisible()))
    await page.getByRole('button', { name: '검색 열기' }).click();
  await expect(searchInput).toHaveValue('안전모');
  await page.getByRole('button', { name: '검색어 지우기' }).click();
  await expect(searchInput).toHaveValue('');
});

test('검색 자동완성은 화살표와 Enter로 상품을 엽니다', async ({ page }) => {
  await page.goto('/');
  const searchInput = page.getByRole('combobox', { name: '상품 검색' });
  if (!(await searchInput.isVisible()))
    await page.getByRole('button', { name: '검색 열기' }).click();

  await searchInput.fill('ABS');
  const firstOption = page.getByRole('option', { name: /ABS 안전모/ });
  await expect(firstOption).toBeVisible();
  await searchInput.press('ArrowDown');
  await expect(firstOption).toHaveAttribute('aria-selected', 'true');
  await searchInput.press('Enter');

  await expect(page).toHaveURL(/\/products\/prd-1001$/);
});

test('검색 결과 화면은 서버 렌더 HTML부터 헤더 검색창에 검색어가 들어 있습니다', async ({
  page,
  request,
}) => {
  const searchHtml = await (await request.get('/search?q=%EC%95%88%EC%A0%84%EB%AA%A8')).text();
  expect(searchHtml).toMatch(/<input[^>]*value="안전모"/);

  await page.goto('/search?q=%EC%95%88%EC%A0%84%EB%AA%A8');
  const searchInput = page.getByRole('combobox', { name: '상품 검색' });
  if (!(await searchInput.isVisible()))
    await page.getByRole('button', { name: '검색 열기' }).click();
  await expect(searchInput).toHaveValue('안전모');
});

import { expect, test } from '@playwright/test';

test('금액 미표시 상품은 가격을 노출하지 않고 바로 구매를 막습니다', async ({ page }) => {
  await page.goto('/products/prd-1003');

  await expect(page.getByRole('heading', { name: '전신 안전벨트 (그네식)' })).toBeVisible();
  await expect(page.getByText('구매 불가', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '바로 구매' }).first()).toBeDisabled();
  await expect(page.getByText('₩126,000', { exact: true })).toHaveCount(0);

  await page.waitForFunction(() => localStorage.getItem('eum.cart.v2') !== null);
  await page.getByRole('button', { name: '장바구니 담기', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '장바구니에 담았습니다.' }),
  ).toBeVisible();

  const storedCart = await page.evaluate(() => localStorage.getItem('eum.cart.v2'));
  expect(JSON.parse(storedCart ?? '{}').cartItems).toEqual([
    { productId: 'prd-1003', quantity: 1, optionId: null, optionLabel: null },
  ]);
});

test('필수 옵션 선택 후 장바구니에는 선택값과 상품 ID만 저장합니다', async ({ page }) => {
  await page.goto('/products/prd-1001');
  await page.waitForFunction(() => localStorage.getItem('eum.cart.v2') !== null);

  // 옵션을 고르기 전에 담으면 필수 옵션 안내를 보여 줍니다.
  await page.getByRole('button', { name: '장바구니 담기', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '필수 옵션을 선택해 주세요.' }),
  ).toBeVisible();

  await page.getByRole('combobox', { name: '색상' }).selectOption('white');
  const selectedLines = page.getByRole('list', { name: '선택한 옵션' });
  await expect(selectedLines.getByText('색상: 백색')).toBeVisible();
  await expect(page.getByText('총 금액 (1개)')).toBeVisible();
  await page.getByRole('button', { name: '장바구니 담기', exact: true }).click();

  const storedCart = await page.evaluate(() => localStorage.getItem('eum.cart.v2'));
  expect(JSON.parse(storedCart ?? '{}').cartItems).toEqual([
    {
      productId: 'prd-1001',
      quantity: 1,
      optionId: 'color:white',
      optionLabel: '색상: 백색',
    },
  ]);
});

test('여러 옵션을 고르면 줄이 쌓이고 수량·삭제가 총 금액에 반영됩니다', async ({ page }) => {
  await page.goto('/products/prd-1001');
  const colorSelect = page.getByRole('combobox', { name: '색상' });
  await colorSelect.selectOption('white');
  await colorSelect.selectOption('yellow');

  const selectedLines = page.getByRole('list', { name: '선택한 옵션' });
  await expect(selectedLines.getByRole('listitem')).toHaveCount(2);
  await selectedLines
    .getByRole('group', { name: '색상: 노란색 수량' })
    .getByRole('button', { name: '수량 늘리기' })
    .click();
  await expect(page.getByText('총 금액 (3개)')).toBeVisible();
  await expect(page.getByText('₩54,000').first()).toBeVisible();

  await selectedLines.getByRole('button', { name: '색상: 백색 선택 취소' }).click();
  await expect(selectedLines.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText('총 금액 (2개)')).toBeVisible();
});

test('데스크톱 썸네일을 누르면 선택 상태가 바뀝니다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'web-desktop', '데스크톱 썸네일 확인');
  await page.goto('/products/prd-1001');
  const thumbnails = page.getByRole('list', { name: '상품 이미지 선택' }).getByRole('button');
  await expect(thumbnails).toHaveCount(5);
  await expect(thumbnails.first()).toHaveAttribute('aria-pressed', 'true');
  await thumbnails.nth(2).click();
  await expect(thumbnails.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(thumbnails.first()).toHaveAttribute('aria-pressed', 'false');
});

test('리뷰는 목록을 불러오고, 리뷰가 없으면 빈 상태를 보여 줍니다', async ({ page }) => {
  await page.goto('/products/prd-1001');
  const reviewSection = page.locator('#product-tab-reviews');
  await expect(reviewSection.getByRole('heading', { name: '리뷰 (3)' })).toBeVisible();
  await expect(reviewSection.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText('리뷰를 불러오는 중입니다')).toHaveCount(0);

  await page.goto('/products/prd-1003');
  await expect(page.getByRole('heading', { name: '아직 작성된 리뷰가 없습니다' })).toBeVisible();
  await expect(page.getByText('구매 후 첫 리뷰를 남겨 주세요.')).toBeVisible();
});

test('함께 구매하면 좋은 제품은 페이지 하단 캐러셀로 보여 줍니다', async ({ page }) => {
  await page.goto('/products/prd-1001');
  const relatedSection = page.getByRole('region', { name: '함께 구매하면 좋은 제품' });
  await expect(relatedSection.getByTestId('product-carousel')).toBeVisible();
  // 오른쪽 구매 요약(데스크톱)에는 관련 상품을 넣지 않습니다.
  await expect(
    page.getByRole('complementary', { name: '구매 요약' }).getByTestId('product-carousel'),
  ).toHaveCount(0);
});

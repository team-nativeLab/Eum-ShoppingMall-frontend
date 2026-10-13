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
  await page.getByRole('combobox', { name: '색상' }).selectOption('white');
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

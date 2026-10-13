import { expect, test } from '@playwright/test';

test('카테고리 화면은 하위 상품과 필터·정렬 UI를 표시합니다', async ({ page }) => {
  await page.goto('/category/personal-protective-equipment');

  await expect(page.getByRole('heading', { name: '개인보호장비' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'ABS 안전모 (내관 조절형)', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: '정렬' })).toBeVisible();

  // 할인 상품 카드는 판매가와 함께 취소선 정가를 보여 줍니다.
  const discountedCard = page.getByRole('article').filter({
    has: page.getByRole('link', { name: 'ABS 안전모 (내관 조절형)', exact: true }),
  });
  await expect(discountedCard.getByText('₩18,000')).toBeVisible();
  await expect(discountedCard.getByText('₩22,000')).toHaveCSS(
    'text-decoration-line',
    'line-through',
  );

  // 데스크톱은 필터 사이드바의 체크박스, 모바일은 "필터" 패널 안의 토글 칩입니다.
  const soldOutCheckbox = page.getByRole('checkbox', { name: '품절 상품 제외' });
  if (await soldOutCheckbox.isVisible()) {
    await soldOutCheckbox.check();
    await expect(soldOutCheckbox).toBeChecked();
  } else {
    await page.getByRole('button', { name: '필터' }).click();
    const soldOutChip = page.getByRole('button', { name: '품절 상품 제외', exact: true });
    await soldOutChip.click();
    await expect(soldOutChip).toHaveAttribute('aria-pressed', 'true');
  }
});

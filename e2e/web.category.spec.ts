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
    // 체크박스는 시각적으로 숨긴 네이티브 input이라 사용자처럼 라벨을 누릅니다.
    await page.locator('label').filter({ has: soldOutCheckbox }).click();
    await expect(soldOutCheckbox).toBeChecked();
  } else {
    await page.getByRole('button', { name: '필터', exact: true }).click();
    const soldOutChip = page.getByRole('button', { name: '품절 상품 제외', exact: true });
    await soldOutChip.click();
    await expect(soldOutChip).toHaveAttribute('aria-pressed', 'true');
  }
});

test('카테고리 칩은 하위 카테고리, 필터에는 개수, 결과가 많으면 페이지 이동을 보여 줍니다', async ({
  page,
}) => {
  await page.goto('/category/personal-protective-equipment');
  const subcategoryNav = page.getByRole('navigation', { name: '하위 카테고리' });
  await expect(subcategoryNav.getByRole('link', { name: '전체' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(subcategoryNav.getByRole('link', { name: '안전모' })).toBeVisible();
  await expect(subcategoryNav.getByRole('link', { name: '교통·도로 안전' })).toHaveCount(0);

  const pagination = page.getByRole('navigation', { name: '페이지 이동' });
  await expect(pagination.getByRole('button', { name: '2페이지' })).toBeVisible();
  await pagination.getByRole('button', { name: '2페이지' }).click();
  await expect(pagination.getByRole('button', { name: '2페이지' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // 새 페이지를 받는 동안에도 페이지 이동이 사라지지 않아 포커스가 그 안에 남습니다.
  await expect(pagination.getByRole('button', { name: '2페이지' })).toBeFocused();

  const brandCheckbox = page.getByRole('checkbox', { name: /^세이프가드 \d+개$/ });
  if (await brandCheckbox.isVisible()) {
    await page.locator('label').filter({ has: brandCheckbox }).click();
    await expect(brandCheckbox).toBeChecked();
    await expect(page.getByRole('button', { name: '세이프가드 삭제' })).toBeVisible();
    await expect(page.getByRole('button', { name: '전체 해제' })).toBeVisible();
  }
});

test('다른 카테고리로 이동하면 정렬·필터·페이지 상태가 처음으로 돌아갑니다', async ({ page }) => {
  await page.goto('/category/personal-protective-equipment');
  const sortSelect = page.getByRole('combobox', { name: '정렬' });
  await sortSelect.selectOption('newest');
  const pagination = page.getByRole('navigation', { name: '페이지 이동' });
  await pagination.getByRole('button', { name: '2페이지' }).click();
  await expect(pagination.getByRole('button', { name: '2페이지' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page
    .getByRole('navigation', { name: '하위 카테고리' })
    .getByRole('link', { name: '안전화' })
    .click();
  await expect(page).toHaveURL(/\/category\/foot-protection$/);
  await expect(page.getByRole('heading', { level: 1, name: '안전화' })).toBeVisible();
  await expect(sortSelect).toHaveValue('recommended');
  await expect(page.getByRole('button', { name: '전체 해제' })).toHaveCount(0);
});

import { expect, test } from '@playwright/test';

test('GNB 브랜드에서 브랜드 목록 → 상세 → 브랜드 제품 목록으로 이동합니다', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'web-desktop') {
    await page
      .getByRole('navigation', { name: '주요 메뉴' })
      .getByRole('link', { name: '브랜드' })
      .click();
  } else {
    // 모바일은 GNB 대신 전체 메뉴의 「전체 브랜드」로 들어갑니다.
    await page.getByRole('button', { name: '전체 메뉴 열기' }).click();
    await page
      .getByRole('dialog', { name: '전체 메뉴' })
      .getByRole('link', { name: '전체 브랜드' })
      .click();
  }

  await expect(page).toHaveURL(/\/brands$/);
  await expect(page.getByRole('heading', { level: 1, name: '브랜드' })).toBeVisible();
  if (testInfo.project.name === 'web-desktop') {
    await expect(
      page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '브랜드' }),
    ).toHaveAttribute('aria-current', 'page');
  }
  await expect(page.getByRole('region', { name: '이달의 브랜드' })).toBeVisible();

  await page.getByRole('link', { name: /^워크핏, 제품 \d+개$/ }).click();
  await expect(page).toHaveURL(/\/brands\/brd-workfit$/);
  await expect(page.getByRole('heading', { level: 1, name: '워크핏' })).toBeVisible();

  const productsCta = page.getByRole('link', { name: /^제품 \d+개 보기$/ });
  await expect(productsCta).toBeVisible();
  await productsCta.click();
  await expect(page).toHaveURL(/\/search\?brand=%EC%9B%8C%ED%81%AC%ED%95%8F$/);
  if (testInfo.project.name === 'web-desktop') {
    // 브랜드 필터가 걸린 상품 목록은 「제품」이 활성입니다.
    await expect(
      page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '제품' }),
    ).toHaveAttribute('aria-current', 'page');
  }
});

test('브랜드 색인은 키보드로 고른 묶음까지 펼치고 그 제목으로 이동합니다', async ({ page }) => {
  await page.goto('/brands');
  const brandIndex = page.getByRole('navigation', { name: '브랜드 색인' });
  await expect(brandIndex).toBeVisible();
  await expect(brandIndex.getByText('ㄴ', { exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );

  const latinKey = brandIndex.getByRole('link', { name: 'A–Z' });
  await latinKey.focus();
  await page.keyboard.press('Enter');

  const latinHeading = page.getByRole('heading', { level: 3, name: /A–Z/ });
  await expect(latinHeading).toBeFocused();
  await expect(latinHeading).toBeInViewport();
  await expect(page.getByRole('link', { name: /^Duraguard, 제품 \d+개$/ })).toBeVisible();
  await expect(latinKey).toHaveAttribute('aria-current', 'location');
});

test('잘못된 브랜드 주소는 찾을 수 없음 안내와 목록 링크를 보여 줍니다', async ({ page }) => {
  await page.goto('/brands/brd-does-not-exist');
  await expect(page.getByRole('heading', { name: '브랜드를 찾을 수 없습니다' })).toBeVisible();
  await page.getByRole('link', { name: '브랜드 목록 보기' }).click();
  await expect(page).toHaveURL(/\/brands$/);
});

test('예전 브랜드 주소(/search?browse=brands)는 브랜드 목록으로 보냅니다', async ({ page }) => {
  await page.goto('/search?browse=brands');
  await expect(page).toHaveURL(/\/brands$/);
  await expect(page.getByRole('heading', { level: 1, name: '브랜드' })).toBeVisible();
});

test('브랜드 화면은 가로로 넘치지 않습니다', async ({ page }) => {
  for (const brandPath of ['/brands', '/brands/brd-safeguard']) {
    await page.goto(brandPath);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow, `${brandPath} 가로 넘침`).toBe(false);
  }
});

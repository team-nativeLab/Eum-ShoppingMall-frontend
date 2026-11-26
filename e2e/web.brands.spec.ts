import { expect, test, type Locator } from '@playwright/test';

/** 브랜드 페이지 상품 카드는 상품 상세로 가는 링크입니다. 상품 목록이 보이는지 확인할 때 씁니다. */
const PRODUCT_CARD_LINK = 'a[href^="/products/"]';

test('데스크톱 GNB·모바일 전체 메뉴의 브랜드 링크에서 브랜드 목록 → 브랜드 카드 → 브랜드 페이지 → 목록으로 돌아가기', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'web-desktop') {
    await page
      .getByRole('navigation', { name: '주요 메뉴' })
      .getByRole('link', { name: '브랜드' })
      .click();
  } else {
    // 모바일은 GNB가 없으므로 전체 메뉴의 「브랜드」 링크(lg 미만에서만 보임)로 들어갑니다.
    const menuTrigger = page.locator(
      'button[aria-controls="site-header-all-menu"]:visible, button[aria-haspopup="dialog"]:visible',
    );
    await expect(menuTrigger).toHaveCount(1);
    await menuTrigger.click();

    const allMenu = page.locator('#site-header-all-menu');
    await expect(allMenu).toBeVisible();
    await allMenu.getByRole('link', { name: '브랜드', exact: true }).click();
  }

  await expect(page).toHaveURL(/\/brands$/);
  await expect(page.getByRole('heading', { level: 1, name: '브랜드' })).toBeVisible();
  if (testInfo.project.name === 'web-desktop') {
    await expect(
      page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '브랜드' }),
    ).toHaveAttribute('aria-current', 'page');
  }

  // 목록은 브랜드 카드만 보여 줍니다. 「제품 보기」나 상품 섹션은 없습니다.
  await expect(page.getByRole('link', { name: '제품 보기' })).toHaveCount(0);
  await page.getByRole('link', { name: /^워크핏, 제품 \d+개$/ }).click();

  // 카드를 누르면 그 브랜드 페이지로 이동합니다.
  await expect(page).toHaveURL(/\/brands\/brd-workfit$/);
  await expect(page.getByRole('heading', { level: 1, name: '워크핏', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '제품 보기' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^[^,]+, 제품 \d+개$/ })).toHaveCount(0);
  await expect(page.locator(PRODUCT_CARD_LINK).first()).toBeVisible();

  // 「브랜드 목록」으로 돌아가면 목록이 다시 보입니다.
  await page.getByRole('link', { name: '브랜드 목록', exact: true }).click();
  await expect(page).toHaveURL(/\/brands$/);
  await expect(page.getByRole('link', { name: /^워크핏, 제품 \d+개$/ })).toBeVisible();
});

test('키보드로 브랜드 카드에 포커스를 옮겨 Enter를 누르면 브랜드 페이지로 이동합니다', async ({
  page,
}) => {
  await page.goto('/brands');
  const workfitCard = page.getByRole('link', { name: /^워크핏, 제품 \d+개$/ });
  await expect(workfitCard).toBeVisible();

  // 탭 순서에는 앞 카드들이 끼어 있으므로, 워크핏 카드에 닿을 때까지 Tab을 누릅니다.
  for (let step = 0; step < 60; step += 1) {
    if (await workfitCard.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(workfitCard).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/brands\/brd-workfit$/);
  await expect(page.getByRole('heading', { level: 1, name: '워크핏', exact: true })).toBeVisible();
});

test('예전 상품 목록 주소(/brands/[brandId]/products)는 브랜드 페이지로 영구 이동합니다', async ({
  page,
  request,
}) => {
  // 리디렉션 상태 코드와 이동 위치를 직접 확인하려고 자동 이동을 끈 요청으로 봅니다.
  const response = await request.get('/brands/brd-workfit/products', { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toMatch(/\/brands\/brd-workfit$/);

  await page.goto('/brands/brd-workfit/products');
  await expect(page).toHaveURL(/\/brands\/brd-workfit$/);
  await expect(page.getByRole('heading', { level: 1, name: '워크핏', exact: true })).toBeVisible();
});

test('브랜드 페이지 헤더는 이름·설명·제품 수를 보여 주고, 긴 이름도 화면 밖으로 넘치지 않습니다', async ({
  page,
}, testInfo) => {
  await page.goto('/brands/brd-long-name-check');
  const heading = page.getByRole('heading', { level: 1, name: 'ALONGUNBROKENBRANDNAMEFORTEST' });
  await expect(heading).toBeVisible();

  // 제목은 한 줄을 넘겨도 줄바꿈되며, 제목 요소 안에서 가로로 잘리거나 넘치지 않아야 합니다.
  const headingOverflows = await heading.evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  expect(headingOverflows, '제목 안쪽 넘침').toBe(false);
  const headingBox = await requireBox(heading);
  const viewportWidth = testInfo.project.name === 'web-mobile' ? 390 : 1440;
  expect(headingBox.x + headingBox.width, '제목 오른쪽 경계').toBeLessThanOrEqual(viewportWidth);

  const documentFitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(documentFitsViewport, '문서 가로 넘침').toBe(true);

  await expect(page.getByText('제품 3개')).toBeVisible();
  await expect(page.getByRole('link', { name: '제품 보기' })).toHaveCount(0);
});

// 현재 HTTP 200 안내(후속 이슈: 서버 조회 기반 404). 브랜드 존재 여부는 클라이언트 조회로 확인하므로 응답 상태는 200이고, 안내 화면으로 대신합니다.
test('존재하지 않는 브랜드 주소는 브랜드를 찾을 수 없다는 안내와 브랜드 목록 링크를 보여 줍니다', async ({
  page,
}) => {
  await page.goto('/brands/brd-does-not-exist');
  await expect(page.getByRole('heading', { name: '브랜드를 찾을 수 없습니다' })).toBeVisible();
  await expect(page.getByRole('link', { name: '브랜드 목록 보기' })).toHaveAttribute(
    'href',
    '/brands',
  );
});

test('예전 브랜드 주소(/search?browse=brands)는 브랜드 목록으로 보냅니다', async ({ page }) => {
  await page.goto('/search?browse=brands');
  await expect(page).toHaveURL(/\/brands$/);
  await expect(page.getByRole('heading', { level: 1, name: '브랜드' })).toBeVisible();
});

test('브랜드 목록 화면은 가로로 넘치지 않습니다', async ({ page }) => {
  await page.goto('/brands');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow, '/brands 가로 넘침').toBe(false);
});

test('타일에는 상품 목록으로 가는 화살표 링크가 없고, 타일 전체가 브랜드 페이지 링크입니다', async ({
  page,
}) => {
  await page.goto('/brands');
  const workfitTile = page.getByRole('link', { name: /^워크핏, 제품 \d+개$/ });
  await expect(workfitTile).toHaveAttribute('href', '/brands/brd-workfit');
  await expect(page.getByRole('link', { name: /워크핏 제품 보기$/ })).toHaveCount(0);
  await expect(page.locator('a[href^="/brands/"][href$="/products"]')).toHaveCount(0);
});

/** 화면에 그려진 요소의 박스를 가져오고, 없으면 원인을 드러내며 실패합니다. */
async function requireBox(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('화면에 그려진 박스를 찾지 못했습니다.');
  return box;
}

import { expect, test, type Locator } from '@playwright/test';

// 홈 팝업은 첫 방문에 열려 메뉴 클릭을 가립니다. 브랜드 화면 검증과 무관하므로 이 탭 세션에서는 숨겨 둡니다(home-popup.tsx의 세션 키).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('eum-home-popup-hidden', 'hidden');
  });
});

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

test('브랜드 페이지 히어로는 이름·설명·제품 수를 보여 주고, 긴 이름도 화면 밖으로 넘치지 않습니다', async ({
  page,
}, testInfo) => {
  await page.goto('/brands/brd-long-name-check');
  const hero = page.getByRole('region', { name: 'ALONGUNBROKENBRANDNAMEFORTEST', exact: true });
  await expect(hero).toBeVisible();
  const heading = hero.getByRole('heading', { level: 1 });

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

  await expect(hero.getByText('제품 3개')).toBeVisible();
  await expect(page.getByRole('link', { name: '제품 보기' })).toHaveCount(0);
});

test('브랜드 페이지는 상품 카드를 히어로 아래에 2줄로 두고, 필터 패널과 전체 보기 링크는 두지 않습니다', async ({
  page,
}, testInfo) => {
  await page.goto('/brands/brd-workfit');
  await expect(page.getByRole('region', { name: '워크핏', exact: true })).toBeVisible();

  const productList = page.getByRole('list', { name: '워크핏 제품' });
  const items = productList.getByRole('listitem');
  await expect(items.first()).toBeVisible();
  // 브랜드 상품은 상위 10개까지입니다. 시드 집계는 워크핏 6개, 하이세이프 7개(최대)이고 목록 타일의 제품 수와 같습니다.
  const itemCount = await items.count();
  expect(itemCount, '상품 카드 개수').toBeGreaterThan(0);
  expect(itemCount, '상품 카드 개수 상한').toBeLessThanOrEqual(10);

  // 2줄 배치: 데스크톱은 5열이라 여섯 번째 카드가 둘째 줄, 모바일은 2열이라 세 번째 카드가 둘째 줄입니다.
  const secondRowIndex = testInfo.project.name === 'web-mobile' ? 2 : 5;
  const firstRowBox = await requireBox(items.nth(0));
  const secondRowBox = await requireBox(items.nth(secondRowIndex));
  expect(secondRowBox.y - firstRowBox.y, '첫 행과 둘째 행의 세로 차이').toBeGreaterThan(100);

  // 위치: 상품 목록은 히어로 아래에 있고, 문서 순서도 히어로가 먼저입니다.
  const heroBox = await requireBox(page.getByRole('region', { name: '워크핏', exact: true }));
  const listBox = await requireBox(productList);
  expect(heroBox.y + heroBox.height, '히어로 끝과 상품 목록 시작').toBeLessThanOrEqual(listBox.y);
  const heroComesFirst = await page.evaluate(() => {
    const hero = document.querySelector('section[aria-labelledby="brand-hero-title"]');
    const list = document.querySelector('ul[aria-label="워크핏 제품"]');
    return Boolean(
      hero && list && hero.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(heroComesFirst, '문서 순서: 히어로가 상품 목록보다 앞').toBe(true);

  // 필터·정렬 패널과 전체 보기 링크는 이 화면에 없습니다.
  await expect(page.getByRole('button', { name: '필터' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '전체 보기' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '제품 보기' })).toHaveCount(0);

  // < > 버튼은 페이지가 둘 이상일 때만 보입니다. 워크핏은 6개라 한 페이지에 들어가므로 보이지 않습니다.
  // 다음 페이지 이동은 단위 테스트(brand-detail-view.test.tsx)에서 확인합니다. 시드의 최대(7개)로는 두 번째 페이지가 생기지 않습니다.
  await expect(page.getByRole('button', { name: '다음 워크핏 제품' })).toHaveCount(0);

  const documentFitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(documentFitsViewport, '브랜드 페이지 문서 가로 넘침').toBe(true);
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

test('목록 타일의 로고 줄은 60px 안에 있고, 로고는 이름 줄과 겹치지 않으며 타일 높이는 164px입니다', async ({
  page,
}) => {
  await page.goto('/brands');
  const tile = page.getByRole('link', { name: /^워크핏, 제품 \d+개$/ });
  await expect(tile).toBeVisible();
  const logo = tile.getByRole('img', { name: '워크핏 로고' });
  const name = tile.getByText('워크핏', { exact: true });

  const tileBox = await requireBox(tile);
  const logoBox = await requireBox(logo);
  const nameBox = await requireBox(name);
  // 로고는 타일 안에 있고, 이름 줄 위에서 끝나며, 로고 영역은 카드 높이(164px)를 크게 넘지 않습니다.
  expect(logoBox.x, '로고 왼쪽 경계').toBeGreaterThanOrEqual(tileBox.x);
  expect(logoBox.x + logoBox.width, '로고 오른쪽 경계').toBeLessThanOrEqual(
    tileBox.x + tileBox.width,
  );
  expect(logoBox.y + logoBox.height, '로고와 이름 줄 겹침').toBeLessThanOrEqual(nameBox.y + 0.5);
  expect(tileBox.height, '타일 높이 유지').toBeCloseTo(164, 0);
  expect(logoBox.height, '로고 높이 60px 이하').toBeLessThanOrEqual(60.5);
  const logoRowBox = await requireBox(tile.locator('> span').first());
  expect(logoRowBox.height, '로고 줄 높이 60px').toBeCloseTo(60, 0);
  expect(logoBox.width, '로고 박스 최대 폭 120px 이하').toBeLessThanOrEqual(120.5);
});

test('한 줄 이름 타일과 여러 줄 이름 타일은 이름 시작 위치가 같습니다', async ({ page }) => {
  await page.goto('/brands');
  const shortTile = page.getByRole('link', { name: /^워크핏, 제품 \d+개$/ });
  const longTile = page.getByRole('link', { name: /^ALONGUNBROKENBRANDNAMEFORTEST, 제품 \d+개$/ });
  await expect(shortTile).toBeVisible();
  await expect(longTile).toBeVisible();
  const shortName = shortTile.getByText('워크핏', { exact: true });
  const longName = longTile.getByText('ALONGUNBROKENBRANDNAMEFORTEST', { exact: true });

  // 줄 수를 글자 조각의 줄 위치로 셉니다. line-clamp-2는 넘는 줄을 말줄임으로 가리지만 조각은 남아 있으므로, 긴 이름은 2줄 이상으로 셉니다.
  const lineCount = (locator: Locator) =>
    locator.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set(Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))).size;
    });
  expect(await lineCount(shortName), '한 줄 이름의 줄 수').toBe(1);
  expect(await lineCount(longName), '여러 줄 이름의 줄 수').toBeGreaterThanOrEqual(2);

  // 타일 안에서 이름 줄의 시작 위치(타일 위쪽부터의 거리)가 두 카드에서 같습니다.
  const shortOffset = (await requireBox(shortName)).y - (await requireBox(shortTile)).y;
  const longOffset = (await requireBox(longName)).y - (await requireBox(longTile)).y;
  expect(longOffset, '이름 시작 위치 차이').toBeCloseTo(shortOffset, 0);
});

test('상품 수는 있지만 구매 가능한 목록이 빈 브랜드는 안내와 다른 브랜드 링크를 보여 줍니다', async ({
  page,
}) => {
  await page.goto('/brands/brd-paused-line');
  await expect(page.getByText('지금 구매할 수 있는 제품이 없습니다')).toBeVisible();
  await expect(page.getByRole('link', { name: '다른 브랜드 보기' })).toHaveAttribute(
    'href',
    '/brands',
  );
});

test('로고가 없는 브랜드의 히어로 텍스트는 데스크톱에서도 왼쪽에 놓입니다', async ({
  page,
}, testInfo) => {
  await page.goto('/brands/brd-long-name-check');
  const heading = page
    .getByRole('region', { name: 'ALONGUNBROKENBRANDNAMEFORTEST', exact: true })
    .getByRole('heading', { level: 1 });
  const headingBox = await requireBox(heading);
  const viewportWidth = testInfo.project.name === 'web-mobile' ? 390 : 1440;
  expect(headingBox.x, '히어로 제목이 왼쪽 절반에 있음').toBeLessThan(viewportWidth / 2);
});

/** 화면에 그려진 요소의 박스를 가져오고, 없으면 원인을 드러내며 실패합니다. */
async function requireBox(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('화면에 그려진 박스를 찾지 못했습니다.');
  return box;
}

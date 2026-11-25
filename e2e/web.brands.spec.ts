import { expect, test, type Locator } from '@playwright/test';

test('데스크톱 GNB·모바일 전체 메뉴의 브랜드 링크에서 브랜드 목록 → 카드 선택 → 밴드의 제품 보기 → 브랜드 전용 제품 목록으로 이동합니다', async ({
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

  // 처음에는 선택 브랜드가 없어 상단 밴드가 없습니다.
  await expect(page.getByRole('region', { name: '워크핏' })).toHaveCount(0);
  // 카드는 상품 목록으로 가지 않고 상단 밴드의 선택 브랜드를 고릅니다.
  await page.getByRole('button', { name: /^워크핏, 제품 \d+개$/ }).click();
  const workfitBand = page.getByRole('region', { name: '워크핏' });
  await expect(workfitBand.getByRole('heading', { level: 2, name: '워크핏' })).toBeVisible();
  // 밴드의 「제품 보기」는 그 브랜드만 거는 제품 목록(/brands/[brandId]/products)으로 갑니다.
  await workfitBand.getByRole('link', { name: '제품 보기' }).click();
  await expect(page).toHaveURL(/\/brands\/brd-workfit\/products$/);
  await expect(page.getByRole('heading', { level: 1, name: '워크핏' })).toBeVisible();
  if (testInfo.project.name === 'web-desktop') {
    // 브랜드 제품 목록은 브랜드 탭이 아니라 「전체상품」 탭이 활성입니다.
    const primaryNavigation = page.getByRole('navigation', { name: '주요 메뉴' });
    await expect(primaryNavigation.getByRole('link', { name: '전체상품' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(primaryNavigation.getByRole('link', { name: '브랜드' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  }
});

test('키보드로 카드에 포커스를 옮겨 Enter로 고르면 밴드 제목이 나타납니다', async ({ page }) => {
  await page.goto('/brands');
  const workfitCard = page.getByRole('button', { name: /^워크핏, 제품 \d+개$/ });
  await expect(workfitCard).toBeVisible();
  await expect(page.getByRole('region', { name: '워크핏' })).toHaveCount(0);

  // 탭 순서에는 앞 카드들이 끼어 있으므로, 워크핏 카드에 닿을 때까지 Tab을 누릅니다.
  for (let step = 0; step < 60; step += 1) {
    if (await workfitCard.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(workfitCard).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(workfitCard).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('region', { name: '워크핏' }).getByRole('heading', { level: 2, name: '워크핏' }),
  ).toBeVisible();
});

test('선택 브랜드 밴드는 헤더 바로 아래 첫 요소로 시작하고, 그때 목록 제목 블록은 화면에서 숨겨집니다', async ({
  page,
}) => {
  await page.goto('/brands?brand=brd-workfit');
  const band = page.locator('section[aria-labelledby="brand-spotlight-title"]');
  await expect(band).toBeVisible();
  await expect(page.getByText('현장에서 검증한 안전용품 브랜드를 한곳에 모았습니다.')).toBeHidden();

  const headerBox = await requireBox(page.getByRole('banner'));
  const bandBox = await requireBox(band);
  // 밴드 위쪽에 흰 띠(제목 블록 자리)가 남지 않아야 합니다. 허용 오차는 1px입니다.
  expect(Math.abs(bandBox.y - (headerBox.y + headerBox.height))).toBeLessThanOrEqual(1);
});

test('선택 브랜드 밴드의 긴 무공백 문구는 밴드 안에서 넘치지 않고, 로고 열은 모바일에서 위·데스크톱에서 오른쪽에 놓입니다', async ({
  page,
}, testInfo) => {
  await page.goto('/brands');
  await page.getByRole('button', { name: /^워크핏, 제품 \d+개$/ }).click();

  // 밴드는 상단 밴드 section(aria-labelledby 제목)으로만 찾습니다. 제목 이름은 긴 문자열로 바뀌므로 이름에 기대지 않습니다.
  const band = page.locator('section[aria-labelledby="brand-spotlight-title"]');
  await expect(band).toBeVisible();
  // 히어로 로고는 목록 요약으로 바로 그려지며, 사진 열 자리에 가운데 놓입니다.
  const logoPlate = band.getByRole('img', { name: '워크핏 로고' });
  await expect(logoPlate).toBeVisible();
  const heightBeforeChange = (await requireBox(band)).height;

  // 제목·영문명·주력 분야·소개 문구를 긴 무공백 문자열로 바꿉니다.
  const longText = 'WORKFITLONG'.repeat(32);
  const textBlocks = band.getByRole('heading', { level: 2 }).or(band.getByRole('paragraph'));
  const textBlockCount = await textBlocks.count();
  expect(textBlockCount).toBeGreaterThan(1);
  for (let index = 0; index < textBlockCount; index += 1) {
    await textBlocks.nth(index).evaluate((element, text) => {
      element.textContent = text;
    }, longText);
  }

  const bandBox = await requireBox(band);
  for (let index = 0; index < textBlockCount; index += 1) {
    const textBox = await requireBox(textBlocks.nth(index));
    const textName = `텍스트 ${index + 1}`;
    expect(textBox.x, `${textName} 왼쪽 경계`).toBeGreaterThanOrEqual(bandBox.x);
    expect(textBox.x + textBox.width, `${textName} 오른쪽 경계`).toBeLessThanOrEqual(
      bandBox.x + bandBox.width,
    );

    const hasInnerOverflow = await textBlocks
      .nth(index)
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(hasInnerOverflow, `${textName} 안쪽 넘침`).toBe(false);
  }

  const documentFitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(documentFitsViewport, '문서 가로 넘침').toBe(true);

  const titleBox = await requireBox(band.getByRole('heading', { level: 2 }));
  const plateBox = await requireBox(logoPlate);
  if (testInfo.project.name === 'web-mobile') {
    expect(plateBox.y, '모바일: 로고 열이 제목보다 위에 있어야 합니다').toBeLessThan(titleBox.y);
    // 모바일 밴드 높이는 텍스트 열 최소 높이로 고정되어, 긴 문구가 와도 높이가 변하지 않습니다.
    expect((await requireBox(band)).height, '모바일: 긴 문구에도 밴드 높이 유지').toBe(
      heightBeforeChange,
    );
  } else {
    expect(plateBox.x, '데스크톱: 로고 열이 제목 열의 오른쪽에 있어야 합니다').toBeGreaterThan(
      titleBox.x,
    );
  }
});

test('모바일에서 목록 맨 아래 카드를 고르면 밴드가 화면 안으로 옮겨집니다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'web-mobile', '모바일 화면에서만 밴드가 화면 밖에 놓입니다.');
  await page.goto('/brands');
  // 목록은 API 순서의 한 그리드입니다. Duraguard는 목록의 마지막 브랜드이므로 맨 아래 카드가 됩니다.
  const lastCard = page.getByRole('button', { name: /^Duraguard, 제품 \d+개$/ });
  await lastCard.scrollIntoViewIfNeeded();
  await lastCard.click();

  await expect(page.getByRole('heading', { level: 2, name: 'Duraguard' })).toBeInViewport();
});

test('선택한 브랜드는 「제품 보기」 뒤 뒤로 가기로 돌아오면 그대로 복원됩니다', async ({
  page,
}) => {
  await page.goto('/brands');
  await page.getByRole('button', { name: /^워크핏, 제품 \d+개$/ }).click();
  await expect(page).toHaveURL(/\/brands\?brand=brd-workfit$/);
  await expect(
    page.getByRole('region', { name: '워크핏' }).getByRole('heading', { level: 2, name: '워크핏' }),
  ).toBeVisible();

  await page
    .getByRole('region', { name: '워크핏' })
    .getByRole('link', { name: '제품 보기' })
    .click();
  await expect(page).toHaveURL(/\/brands\/brd-workfit\/products$/);

  await page.goBack();

  await expect(page).toHaveURL(/\/brands\?brand=brd-workfit$/);
  await expect(
    page.getByRole('region', { name: '워크핏' }).getByRole('heading', { level: 2, name: '워크핏' }),
  ).toBeVisible();
});

test('존재하지 않는 브랜드 주소는 404 상태와 안내를 보여 줍니다', async ({ page }) => {
  const response = await page.goto('/brands/brd-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
});

test('존재하지 않는 브랜드의 제품 목록은 안내와 브랜드 목록 링크를 보여 줍니다', async ({
  page,
}) => {
  await page.goto('/brands/brd-does-not-exist/products');
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

test('브랜드 화면은 가로로 넘치지 않습니다', async ({ page }) => {
  await page.goto('/brands');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow, '/brands 가로 넘침').toBe(false);
});

for (const width of [1024, 1136, 1440]) {
  test(`${width}폭에서 히어로 로고는 사진 열 안에 있고 문서는 가로로 넘치지 않습니다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/brands?brand=brd-workfit');
    const band = page.locator('section[aria-labelledby="brand-spotlight-title"]');
    const heroLogo = band.locator('img').first();
    await expect(heroLogo).toBeVisible();

    const placement = await heroLogo.evaluate((logoElement) => {
      // 로고 → 래퍼 → 사진 열 순서입니다. 사진 열은 텍스트 열 오른쪽에 있습니다.
      const wrapper = logoElement.parentElement;
      const photoColumn = wrapper?.parentElement;
      const logoRect = logoElement.getBoundingClientRect();
      const columnRect = photoColumn?.getBoundingClientRect();
      return {
        insideColumn:
          columnRect !== undefined &&
          logoRect.left >= columnRect.left - 0.5 &&
          logoRect.right <= columnRect.right + 0.5,
        insideViewport: logoRect.right <= window.innerWidth + 0.5,
        documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      };
    });
    expect(placement).toEqual({ insideColumn: true, insideViewport: true, documentFits: true });
  });
}

test('타일의 화살표 링크는 브랜드 제품 목록으로 가고, 외곽선이 잘리지 않습니다', async ({
  page,
}) => {
  await page.goto('/brands');
  const arrowLink = page.getByRole('link', { name: '워크핏 제품 보기' });
  await expect(arrowLink).toBeVisible();

  // 링크의 포커스 외곽선이 잘리지 않도록 조상 어디에도 overflow 클리핑이 없어야 합니다.
  await arrowLink.focus();
  const clippingAncestors = await arrowLink.evaluate((element) => {
    const names: string[] = [];
    let ancestor = element.parentElement;
    while (ancestor) {
      const overflow = getComputedStyle(ancestor).overflow;
      if (overflow !== 'visible') names.push(`${ancestor.tagName}:${overflow}`);
      ancestor = ancestor.parentElement;
    }
    return names;
  });
  expect(clippingAncestors).toEqual([]);

  await arrowLink.click();
  await expect(page).toHaveURL(/\/brands\/brd-workfit\/products$/);
});

/** 화면에 그려진 요소의 박스를 가져오고, 없으면 원인을 드러내며 실패합니다. */
async function requireBox(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('화면에 그려진 박스를 찾지 못했습니다.');
  return box;
}

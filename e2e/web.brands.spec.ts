import { expect, test, type Locator } from '@playwright/test';

test('데스크톱 GNB·모바일 전체 메뉴의 브랜드 링크에서 브랜드 목록 → 카드 선택 → 밴드의 제품 보기 → 브랜드 필터 상품 목록으로 이동합니다', async ({
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

  // 카드는 상품 목록으로 가지 않고 상단 밴드의 선택 브랜드를 바꿉니다.
  await page.getByRole('button', { name: /^워크핏, 제품 \d+개$/ }).click();
  const workfitBand = page.getByRole('region', { name: '워크핏' });
  await expect(workfitBand.getByRole('heading', { level: 2, name: '워크핏' })).toBeVisible();
  // 밴드의 「제품 보기」는 기존 브랜드 필터가 걸린 전체 상품 목록으로 갑니다.
  await workfitBand.getByRole('link', { name: '제품 보기' }).click();
  await expect(page).toHaveURL(/\/search\?brand=%EC%9B%8C%ED%81%AC%ED%95%8F$/);
  if (testInfo.project.name === 'web-desktop') {
    // 브랜드 필터가 걸린 상품 목록은 「전체상품」이 활성입니다.
    await expect(
      page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '전체상품' }),
    ).toHaveAttribute('aria-current', 'page');
  }
});

test('키보드로 카드에 포커스를 옮겨 Enter로 고르면 밴드 제목이 바뀝니다', async ({ page }) => {
  await page.goto('/brands');
  const workfitCard = page.getByRole('button', { name: /^워크핏, 제품 \d+개$/ });
  await expect(workfitCard).toBeVisible();

  // 탭 순서에는 밴드 CTA와 앞 카드들이 끼어 있으므로, 워크핏 카드에 닿을 때까지 Tab을 누릅니다.
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

test('선택 브랜드 밴드의 긴 무공백 문구는 밴드 안에서 넘치지 않고, 로고 열은 모바일에서 위·데스크톱에서 오른쪽에 놓입니다', async ({
  page,
}, testInfo) => {
  await page.goto('/brands');
  await page.getByRole('button', { name: /^워크핏, 제품 \d+개$/ }).click();

  // 밴드는 CTA 링크를 가진 가장 안쪽 region으로 찾습니다. 제목 이름은 긴 문자열로 바뀌므로 이름에 기대지 않습니다.
  // 상단 밴드 section만 고릅니다(목록 섹션도 region이고, 타일 화살표 링크 이름에도 「제품 보기」가 들어갑니다).
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
  // 섹션은 ㄱ~ㅎ, A–Z, # 순입니다. Duraguard는 A–Z 그룹(D)에 있고 목록의 마지막 그룹이라 맨 아래 카드가 됩니다.
  const lastCard = page.getByRole('button', { name: /^Duraguard, 제품 \d+개$/ });
  await lastCard.scrollIntoViewIfNeeded();
  await lastCard.click();

  await expect(page.getByRole('heading', { level: 2, name: 'Duraguard' })).toBeInViewport();
});

test('인덱스 키를 누르면 해당 섹션 헤더가 sticky 헤더 아래에 보입니다', async ({ page }) => {
  await page.goto('/brands');
  const sectionHeading = page.getByRole('heading', { level: 3, name: 'ㅅ', exact: true });
  await expect(sectionHeading).toBeVisible();

  await page.getByRole('button', { name: 'ㅅ', exact: true }).click();

  await expect(page.getByRole('button', { name: 'ㅅ', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(sectionHeading).toBeInViewport();
  // 헤더가 가리지 않는지 확인합니다. 스크롤이 끝날 때까지 기다리며 헤더 아래 여백이 0 이상인지 봅니다.
  await expect
    .poll(async () => {
      const headingBox = await requireBox(sectionHeading);
      const headerBox = await requireBox(page.getByRole('banner'));
      return headingBox.y - (headerBox.y + headerBox.height);
    })
    .toBeGreaterThanOrEqual(0);
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
  await expect(page).toHaveURL(/\/search\?brand=/);

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

test('키보드로 인덱스 키에 포커스하면 외곽선 4면(2px 선 + 2px 오프셋)이 키 행 안에 모두 보입니다', async ({
  page,
}) => {
  await page.goto('/brands');
  const keyRow = page.getByRole('group', { name: '브랜드 초성·알파벳 인덱스' });
  await expect(keyRow).toBeVisible();
  const siKey = page.getByRole('button', { name: 'ㅅ', exact: true });

  // 검색창에서 Tab으로 키 행을 따라가 ㅅ 키에 닿습니다. 키 행은 가로로 스크롤되므로 중간 키를 거칩니다.
  await page.getByRole('searchbox', { name: '브랜드 검색' }).focus();
  for (let step = 0; step < 60; step += 1) {
    if (await siKey.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(siKey).toBeFocused();
  const outlineStyle = await siKey.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outlineStyle).not.toBe('none');

  // 키 행은 포커스된 키를 부드럽게(smooth) 옮기므로, 이동이 끝날 때까지 기다리며 네 면을 확인합니다.
  const OUTLINE_REACH = 4; // outline 2px + outline-offset 2px
  const readOutlineFits = async () => {
    const rowBox = await requireBox(keyRow);
    const keyBox = await requireBox(siKey);
    return {
      left: keyBox.x - OUTLINE_REACH >= rowBox.x,
      right: keyBox.x + keyBox.width + OUTLINE_REACH <= rowBox.x + rowBox.width,
      top: keyBox.y - OUTLINE_REACH >= rowBox.y,
      bottom: keyBox.y + keyBox.height + OUTLINE_REACH <= rowBox.y + rowBox.height,
    };
  };
  await expect.poll(readOutlineFits).toEqual({ left: true, right: true, top: true, bottom: true });
});

test('인덱스 키 행을 가로로 스크롤해도 문서는 가로로 넘치지 않습니다', async ({ page }) => {
  await page.goto('/brands');
  const keyRow = page.getByRole('group', { name: '브랜드 초성·알파벳 인덱스' });
  // 1440에서는 뒤쪽 알파벳 키가 화면 밖에 있어 행이 넘칩니다. 끝까지 가로로 밀어 넘침을 확인합니다.
  await keyRow.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });

  // 행이 실제로 넘쳐 스크롤됐는지 먼저 확인합니다(넘치지 않으면 이 검사는 의미가 없습니다).
  await expect.poll(() => keyRow.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const documentFitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(documentFitsViewport, '키 행 스크롤 후 문서 가로 넘침').toBe(true);
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
  await expect(page).toHaveURL(/\/search\?brand=%EC%9B%8C%ED%81%AC%ED%95%8F$/);
});

test('인덱스 키를 누르거나 Tab으로 포커스하면 키와 외곽선 4면이 헤더 아래에 온전히 보입니다', async ({
  page,
}, testInfo) => {
  const siKey = page.getByRole('button', { name: 'ㅅ', exact: true });
  const readKeyPlacement = async () => {
    const headerBox = await requireBox(page.getByRole('banner'));
    const keyBox = await requireBox(siKey);
    const viewportHeight = testInfo.project.use.viewport?.height ?? 0;
    return {
      belowHeader: keyBox.y - 4 >= headerBox.y + headerBox.height,
      insideViewport: keyBox.y + keyBox.height + 4 <= viewportHeight,
    };
  };

  // 1) 키를 누른 뒤
  await page.goto('/brands');
  await siKey.click();
  await expect.poll(readKeyPlacement).toEqual({ belowHeader: true, insideViewport: true });

  // 2) 키 행이 헤더 밑으로 들어가도록 페이지를 내린 뒤 Tab으로 키에 포커스를 옮깁니다.
  await page.goto('/brands');
  await page.getByRole('searchbox', { name: '브랜드 검색' }).focus();
  await page.evaluate(() => window.scrollBy(0, 160));
  for (let step = 0; step < 60; step += 1) {
    if (await siKey.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(siKey).toBeFocused();
  await expect.poll(readKeyPlacement).toEqual({ belowHeader: true, insideViewport: true });
});

/** 화면에 그려진 요소의 박스를 가져오고, 없으면 원인을 드러내며 실패합니다. */
async function requireBox(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('화면에 그려진 박스를 찾지 못했습니다.');
  return box;
}

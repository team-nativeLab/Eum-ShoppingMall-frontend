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

test('선택 브랜드 밴드의 긴 무공백 문구는 밴드 안에서 넘치지 않고, 사진 열은 모바일에서 위·데스크톱에서 오른쪽에 놓입니다', async ({
  page,
}, testInfo) => {
  await page.goto('/brands');
  await page.getByRole('button', { name: /^워크핏, 제품 \d+개$/ }).click();

  // 밴드는 CTA 링크를 가진 가장 안쪽 region으로 찾습니다. 제목 이름은 긴 문자열로 바뀌므로 이름에 기대지 않습니다.
  const band = page
    .getByRole('region')
    .filter({ has: page.getByRole('link', { name: '제품 보기' }) })
    .filter({ hasNot: page.getByRole('region') });
  await expect(band).toBeVisible();
  // 로고 플레이트는 상세 조회가 끝난 뒤에만 그려지므로, 사진 열이 채워진 것을 먼저 기다립니다.
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
    expect(plateBox.y, '모바일: 사진 열이 제목보다 위에 있어야 합니다').toBeLessThan(titleBox.y);
    // 모바일 밴드 높이는 텍스트 열 최소 높이로 고정되어, 긴 문구가 와도 높이가 변하지 않습니다.
    expect((await requireBox(band)).height, '모바일: 긴 문구에도 밴드 높이 유지').toBe(
      heightBeforeChange,
    );
  } else {
    expect(plateBox.x, '데스크톱: 사진 열이 제목 열의 오른쪽에 있어야 합니다').toBeGreaterThan(
      titleBox.x,
    );
  }
});

test('모바일에서 맨 아래 카드를 고르면 밴드가 화면 안으로 옮겨집니다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'web-mobile', '모바일 화면에서만 밴드가 화면 밖에 놓입니다.');
  await page.goto('/brands');
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

/** 화면에 그려진 요소의 박스를 가져오고, 없으면 원인을 드러내며 실패합니다. */
async function requireBox(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('화면에 그려진 박스를 찾지 못했습니다.');
  return box;
}

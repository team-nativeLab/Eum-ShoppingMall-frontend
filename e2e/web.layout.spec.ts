import { expect, test, type Page } from '@playwright/test';

test('데스크톱 상품 상세에서도 주요 메뉴(GNB)와 본문 바로가기를 보여 줍니다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'web-desktop', '데스크톱(1440) GNB 확인');
  await page.goto('/products/prd-1001');

  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeVisible();
  await expect(page.getByRole('button', { name: '이전 화면' })).toBeHidden();
  await expect(page.getByRole('link', { name: '본문 바로가기' })).toHaveCount(1);
});

test('모바일 상품 상세는 상세 전용 헤더를 쓰고 GNB는 숨깁니다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'web-mobile', '모바일(390) 상세 헤더 확인');
  await page.goto('/products/prd-1001');

  await expect(page.getByRole('button', { name: '이전 화면' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeHidden();
});

/** 보이는 영역 안의 같은 사이트 링크 경로(쿼리·해시 제외)를 모읍니다. */
async function collectInternalPaths(page: Page, containerSelector: string): Promise<string[]> {
  return page.locator(containerSelector).evaluateAll((containers) =>
    containers.flatMap((container) =>
      [...container.querySelectorAll<HTMLAnchorElement>('a[href]')]
        .map((anchor) => new URL(anchor.href, window.location.origin))
        .filter((linkUrl) => linkUrl.origin === window.location.origin)
        .map((linkUrl) => linkUrl.pathname),
    ),
  );
}

test('헤더·푸터·전체 메뉴의 모든 내부 링크는 404가 아닌 화면으로 연결됩니다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '베스트 셀러' })).toBeVisible();

  const headerAndFooterPaths = await collectInternalPaths(page, 'header, footer');
  const menuTrigger = page.locator(
    'button[aria-controls="site-header-all-menu"]:visible, button[aria-haspopup="dialog"]:visible',
  );
  await expect(menuTrigger).toHaveCount(1);
  await menuTrigger.click();
  const allMenu = page.locator('#site-header-all-menu');
  await expect(allMenu).toBeVisible();
  await expect(allMenu.getByRole('link', { name: '전체 브랜드' })).toHaveAttribute(
    'href',
    '/brands',
  );
  const menuPaths = await collectInternalPaths(page, '#site-header-all-menu');

  const uniquePaths = [...new Set([...headerAndFooterPaths, ...menuPaths])].sort();
  expect(uniquePaths).toEqual(
    expect.arrayContaining(['/about', '/brands', '/cart', '/support/faq']),
  );
  for (const linkPath of uniquePaths) {
    const linkResponse = await page.request.get(linkPath);
    expect(linkResponse.status(), `${linkPath} 응답 상태`).toBe(200);
  }
});

test('준비 중 화면은 안내 문구와 홈 링크를 보여 주고 색인하지 않습니다', async ({ page }) => {
  await page.goto('/support/notices');

  await expect(page.getByRole('heading', { level: 1, name: '공지사항' })).toBeVisible();
  await expect(page.getByText('이 화면은 준비하고 있습니다.')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.getByRole('link', { name: '홈으로 가기' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('목 모드에서는 데모 안내 띠를 표시합니다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: '데모 안내' })).toContainText(
    '데모(목 데이터)',
  );
});

test('전체 메뉴는 Escape로 닫으면 연 버튼으로 포커스를 돌려줍니다', async ({ page }) => {
  await page.goto('/');
  const menuTrigger = page.locator(
    'button[aria-controls="site-header-all-menu"]:visible, button[aria-haspopup="dialog"]:visible',
  );
  await expect(menuTrigger).toHaveCount(1);
  await menuTrigger.click();
  const openerElement = await menuTrigger.elementHandle();
  if (!openerElement) throw new Error('보이는 전체 메뉴 열기 버튼을 찾지 못했습니다.');

  const allMenu = page.locator('#site-header-all-menu');
  await expect(allMenu).toBeVisible();
  const menuLink = allMenu.getByRole('link', { name: '이용 안내' });
  await expect(menuLink).toBeVisible();
  await menuLink.focus();
  await expect(menuLink).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(allMenu).toBeHidden();
  const focusResult = await page.evaluate((trigger) => {
    const activeElement = document.activeElement;
    return {
      isOpener: activeElement === trigger,
      activeElement:
        activeElement instanceof HTMLElement
          ? {
              tagName: activeElement.tagName,
              ariaLabel: activeElement.getAttribute('aria-label'),
              ariaControls: activeElement.getAttribute('aria-controls'),
            }
          : null,
    };
  }, openerElement);
  expect(
    focusResult.isOpener,
    `Escape 후 activeElement: ${JSON.stringify(focusResult.activeElement)}`,
  ).toBe(true);
  await expect(menuTrigger).toBeFocused();
});

for (const viewportWidth of [1024, 1280]) {
  test(`${viewportWidth} 폭 데스크톱 GNB에서 마지막 메뉴와 검색창이 겹치지 않습니다`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'web-desktop', '데스크톱 GNB 배치 확인');
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    await page.goto('/');

    const mainNavigation = page.getByRole('navigation', { name: '주요 메뉴' });
    const lastMenuLink = mainNavigation.getByRole('link').last();
    const desktopSearchForm = page.getByRole('search').locator('visible=true');
    await expect(lastMenuLink).toBeVisible();
    await expect(desktopSearchForm).toBeVisible();

    const lastMenuBox = await lastMenuLink.boundingBox();
    const searchBox = await desktopSearchForm.boundingBox();
    expect(lastMenuBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    if (!lastMenuBox || !searchBox) return;
    // 메뉴 오른쪽 끝과 검색창 왼쪽 끝 사이에 최소 24px 간격이 있어야 합니다.
    expect(searchBox.x - (lastMenuBox.x + lastMenuBox.width)).toBeGreaterThanOrEqual(24);
    // 메뉴 글자가 잘리지 않았는지(스크롤 폭 = 보이는 폭) 확인합니다.
    expect(
      await lastMenuLink.evaluate(
        (linkElement) => linkElement.scrollWidth <= linkElement.clientWidth,
      ),
    ).toBe(true);
  });
}

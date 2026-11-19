import { expect, test, type Page } from '@playwright/test';

async function installHomeCarouselFixture(page: Page, productCount: number) {
  await page.addInitScript((count: number) => {
    const clone = window.structuredClone.bind(window);
    window.structuredClone = ((value: unknown, options?: StructuredSerializeOptions) => {
      const cloned = clone(value, options) as { featuredProducts?: Array<Record<string, unknown>> };
      if (Array.isArray(cloned?.featuredProducts) && cloned.featuredProducts.length > 0) {
        const source = cloned.featuredProducts;
        cloned.featuredProducts = Array.from({ length: count }, (_, index) => ({
          ...source[index % source.length],
          id: `e2e-carousel-product-${index + 1}`,
        }));
      }
      return cloned;
    }) as typeof window.structuredClone;
  }, productCount);
}

test.describe('홈 히어로 슬라이드 전환', () => {
  test('다음 배너로 넘기면 next 방향으로 들어오고 이전 배너는 나갑니다', async ({ page }) => {
    await page.goto('/');
    const hero = page.getByTestId('home-hero');
    await expect(hero).toHaveAttribute('data-direction', 'none');

    // 모바일은 화살표가 없어 인디케이터 번호로 이동합니다(인덱스 차이로 방향 결정).
    const nextButton = page.getByRole('button', { name: '다음 배너' });
    if (await nextButton.isVisible()) await nextButton.click();
    else await page.getByRole('button', { name: '2번째 배너 보기' }).click();

    await expect(hero).toHaveAttribute('data-direction', 'next');
    await expect(page.getByRole('button', { name: '2번째 배너 보기' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    // 전환이 끝나면 나가는 레이어가 정리되고, 숨은 배너 문구는 포커스되지 않습니다.
    await expect(hero.locator('[data-state="leaving"]')).toHaveCount(0);
    await expect(hero.locator('[data-slide-layer="text"][inert]')).toHaveCount(2);

    await page.getByRole('button', { name: '1번째 배너 보기' }).click();
    await expect(hero).toHaveAttribute('data-direction', 'previous');
  });

  test('감속 모드에서는 애니메이션 없이 즉시 바뀝니다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const hero = page.getByTestId('home-hero');
    await page.getByRole('button', { name: '2번째 배너 보기' }).click();

    await expect(hero).toHaveAttribute('data-direction', 'next');
    // 나가는 레이어 없이 새 배너가 바로 active가 됩니다.
    await expect(hero.locator('[data-state="leaving"]')).toHaveCount(0);
    const activeTextLayer = hero.locator('[data-slide-layer="text"][data-state="active"]');
    await expect(activeTextLayer).toHaveCount(1);
    await expect(activeTextLayer).toHaveCSS('animation-name', 'none');
  });
});

test.describe('베스트 셀러 캐러셀', () => {
  test('다음을 누르면 실제 카드 폭만큼 한 페이지 이동하고 현재 페이지만 활성화합니다', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'web-desktop', '데스크톱 이전/다음 버튼 확인');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [1024, 1280]) {
      await installHomeCarouselFixture(page, 11);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      const columns = width >= 1280 ? 5 : 4;
      const pageSize = columns * 2;
      const carousel = page.getByTestId('product-carousel').first();
      const track = carousel.getByTestId('product-carousel-track');
      const cards = track.getByRole('listitem');
      const firstCard = cards.first();
      const firstCardOnNextPage = cards.nth(pageSize);
      const firstBox = await firstCard.boundingBox();
      const trackBox = await carousel.boundingBox();
      if (!firstBox || !trackBox) throw new Error('첫 상품 geometry가 없습니다.');
      await expect(cards).toHaveCount(11);
      await expect(firstCard).not.toHaveAttribute('inert', '');
      await expect(firstCardOnNextPage).toHaveAttribute('inert', '');

      await page.getByRole('button', { name: '다음 베스트 상품' }).click();
      await expect(carousel).toHaveAttribute('data-direction', 'next');
      await expect(firstCardOnNextPage).not.toHaveAttribute('inert', '');
      await expect(firstCard).toHaveAttribute('inert', '');
      await expect(cards.nth(10)).not.toHaveAttribute('inert', '');
      const movedFirstBox = await firstCard.boundingBox();
      const nextBox = await firstCardOnNextPage.boundingBox();
      if (!movedFirstBox || !nextBox) throw new Error('페이지 이동 상품 geometry가 없습니다.');
      expect(firstBox.x - movedFirstBox.x).toBeCloseTo(columns * (firstBox.width + 16), 0);
      expect(firstBox.x - nextBox.x).toBeCloseTo(0, 0);
      expect(nextBox.x).toBeGreaterThanOrEqual(trackBox.x);
      expect(nextBox.x + nextBox.width).toBeLessThanOrEqual(trackBox.x + trackBox.width);
      for (let productIndex = pageSize; productIndex < 11; productIndex += 1) {
        const pageCard = await cards.nth(productIndex).boundingBox();
        if (!pageCard) throw new Error('다음 페이지 상품 geometry가 없습니다.');
        expect(pageCard.x).toBeGreaterThanOrEqual(trackBox.x);
        expect(pageCard.x + pageCard.width).toBeLessThanOrEqual(trackBox.x + trackBox.width);
      }

      await page.getByRole('button', { name: '이전 베스트 상품' }).click();
      await expect(carousel).toHaveAttribute('data-direction', 'previous');
      await expect(firstCard).not.toHaveAttribute('inert', '');
      await expect(firstCardOnNextPage).toHaveAttribute('inert', '');
    }
  });

  test('감속 모드에서는 트랙 전환 애니메이션이 없습니다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'web-desktop', '데스크톱 트랙 전환 확인');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const track = page.getByTestId('product-carousel-track').first();
    await page.getByRole('button', { name: '다음 베스트 상품' }).click();
    await expect(page.getByTestId('product-carousel').first()).toHaveAttribute(
      'data-direction',
      'next',
    );
    // transition이 붙지 않아(지속 시간 0) 즉시 이동합니다.
    await expect(track).toHaveCSS('transition-duration', '0s');
  });

  test('모바일은 가로 스와이프(scroll-snap)로 넘깁니다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'web-mobile', '모바일 스와이프 확인');
    await page.goto('/');
    const carousel = page.getByTestId('product-carousel').first();
    await expect(carousel).toHaveCSS('scroll-snap-type', 'x mandatory');
    const canScroll = await carousel.evaluate(
      (carouselElement) => carouselElement.scrollWidth > carouselElement.clientWidth,
    );
    expect(canScroll).toBe(true);
  });
});

test.describe('고정 카테고리와 홈 상품 레일 배치', () => {
  test('데스크톱 카테고리 버튼은 스크롤과 검색 화면 전환에도 고정됩니다', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'web-desktop', '데스크톱 고정 카테고리 확인');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');

    const launcher = page.locator('[data-menu-trigger-location="global"]');
    await expect(launcher).toBeVisible();
    await expect(launcher).toHaveCount(1);
    await expect(launcher).toContainText('카테고리');
    await expect(page.locator('[data-menu-trigger-location="hero"]')).toHaveCount(0);
    await expect(launcher).toHaveCSS('position', 'fixed');
    await expect(launcher).toHaveCSS('left', '26px');
    await expect(launcher).toHaveCSS('top', '113px');
    await expect(launcher).toHaveCSS('width', '96px');
    await expect(launcher).toHaveCSS('height', '96px');

    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(launcher).toHaveCSS('top', '113px');
    await page.goto('/search?q=test');
    await expect(page.locator('[data-menu-trigger-location="global"]')).toBeVisible();
  });

  test('로그인·회원가입·체크아웃에는 버튼을 숨기고 모바일 헤더 버튼을 유지합니다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const pathname of ['/login', '/signup', '/checkout/shipping', '/checkout/payment']) {
      await page.goto(pathname);
      await expect(page.locator('[data-menu-trigger-location="global"]')).toHaveCount(0);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('[data-menu-trigger-location="global"]')).toBeHidden();
    await expect(page.getByRole('button', { name: '전체 메뉴 열기' })).toBeVisible();
  });

  test('홈 상품 레일은 2행으로 배치되고 고정 버튼과 화살표가 상품을 가리지 않습니다', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'web-desktop', '데스크톱 상품 레일 geometry 확인');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [1024, 1279, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.goto('/');
      const launcher = page.locator('[data-menu-trigger-location="global"]');
      const carousel = page.getByTestId('product-carousel').first();
      const track = carousel.getByTestId('product-carousel-track');
      const rail = carousel.locator('..');
      const cards = track.getByRole('listitem');
      await expect(cards.first()).toBeVisible();

      const expectedColumns = width >= 1280 ? 5 : 4;
      const firstRowBoxes = await Promise.all(
        Array.from({ length: expectedColumns }, async (_, cardIndex) =>
          cards.nth(cardIndex).boundingBox(),
        ),
      );
      const secondRowBox = await cards.nth(expectedColumns).boundingBox();
      const launcherBox = await launcher.boundingBox();
      const railBox = await rail.boundingBox();
      const trackBox = await carousel.boundingBox();
      const firstCardBox = firstRowBoxes[0];
      if (!firstCardBox || !secondRowBox || !launcherBox || !railBox || !trackBox) {
        throw new Error('홈 캐러셀 또는 카테고리 버튼 geometry가 없습니다.');
      }

      expect(secondRowBox.y).toBeGreaterThan(firstCardBox.y);
      expect(firstRowBoxes.every((box) => box !== null)).toBe(true);
      expect(launcherBox.x + launcherBox.width).toBeLessThanOrEqual(firstCardBox.x);
      expect(railBox.width - trackBox.width).toBeCloseTo(128, 0);
      for (const [cardIndex, cardBox] of firstRowBoxes.entries()) {
        if (!cardBox) throw new Error('첫 행 상품 geometry가 없습니다.');
        expect(cardBox.y).toBeCloseTo(firstCardBox.y, 0);
        if (cardIndex > 0) {
          const previousCardBox = firstRowBoxes[cardIndex - 1];
          if (!previousCardBox) throw new Error('이전 상품 geometry가 없습니다.');
          expect(cardBox.x).toBeGreaterThan(previousCardBox.x + previousCardBox.width);
          expect(cardBox.x - previousCardBox.x - previousCardBox.width).toBeCloseTo(16, 0);
        }
      }
      expect(firstRowBoxes[0]?.width).toBeCloseTo(
        Math.min(220, (trackBox.width - (expectedColumns - 1) * 16) / expectedColumns),
        0,
      );

      // Exercise the same responsive CSS variables used by React when paging. This verifies that
      // Chromium resolves the track movement from the rendered card width, including narrow lg.
      await track.evaluate((element, columns) => {
        const strideTerms = Array.from({ length: columns }, () => [
          'var(--home-carousel-card-width)',
          'var(--home-carousel-gap)',
        ]).flat();
        (element as HTMLElement).style.setProperty(
          '--carousel-page-translate',
          `calc(0px - ${strideTerms.join(' - ')})`,
        );
      }, expectedColumns);
      const expectedPageDistance = expectedColumns * (firstCardBox.width + 16);
      const movedFirstCard = await cards.first().boundingBox();
      if (!movedFirstCard) throw new Error('이동한 첫 상품 geometry가 없습니다.');
      expect(firstCardBox.x - movedFirstCard.x).toBeCloseTo(expectedPageDistance, 0);
      await track.evaluate((element) => {
        (element as HTMLElement).style.removeProperty('--carousel-page-translate');
      });

      const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(pageWidth).toBeLessThanOrEqual(width);

      const nextArrow = page.getByRole('button', { name: '다음 베스트 상품' });
      if (await nextArrow.isVisible()) {
        const arrowBox = await nextArrow.boundingBox();
        const lastFirstRowBox = firstRowBoxes[expectedColumns - 1];
        if (!arrowBox || !lastFirstRowBox) throw new Error('캐러셀 화살표 geometry가 없습니다.');
        expect(lastFirstRowBox.x + lastFirstRowBox.width).toBeLessThanOrEqual(arrowBox.x);
        await expect(nextArrow).toHaveCSS('width', '52px');
        await expect(nextArrow.locator('svg')).toHaveAttribute('width', '24');
      }
    }
  });
});

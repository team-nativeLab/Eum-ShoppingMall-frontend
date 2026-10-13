import { expect, test } from '@playwright/test';

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
  test('다음을 누르면 트랙이 next 방향으로 한 페이지 이동합니다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'web-desktop', '데스크톱 이전/다음 버튼 확인');
    await page.goto('/');
    const carousel = page.getByTestId('product-carousel').first();
    const track = carousel.getByTestId('product-carousel-track');
    const firstCard = track.getByRole('listitem').first();
    const sixthCard = track.getByRole('listitem').nth(5);
    await expect(sixthCard).toHaveAttribute('inert', '');

    await page.getByRole('button', { name: '다음 베스트 상품' }).click();
    await expect(carousel).toHaveAttribute('data-direction', 'next');
    await expect(sixthCard).not.toHaveAttribute('inert', '');
    await expect(firstCard).toHaveAttribute('inert', '');
    await expect(track).toHaveCSS('transition-property', 'translate');

    await page.getByRole('button', { name: '이전 베스트 상품' }).click();
    await expect(carousel).toHaveAttribute('data-direction', 'previous');
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
